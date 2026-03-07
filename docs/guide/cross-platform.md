---
title: 跨平台扩展
order: 4
---

# 跨平台扩展

flow-orchestrator 的核心引擎（FlowEngine）零平台依赖，通过三个关键接口实现跨平台扩展：

| 接口 | 职责 | 扩展场景 |
|------|------|---------|
| `INavigationAdapter` | 页面导航 | RN Navigator / React Router / 微信小程序路由 |
| `IFlowStorage` | 状态持久化 | AsyncStorage / localStorage / IndexedDB / MMKV |
| `ILogger` | 日志输出 | console / 自定义 Logger / 远程日志服务 |

## INavigationAdapter — 导航适配

实现 `push` 和 `pop` 两个方法即可对接任何导航系统：

```ts
interface INavigationAdapter {
  push(
    pageName: string,
    propsData?: Record<string, unknown>,
    options?: NavigationPushOptions,
  ): void;

  pop(
    options?: NavigationPopOptions,
  ): void;
}
```

### React Native 实现

```ts
import { NativeNavigator } from 'your-rn-navigator';

export class RNNavigationAdapter implements INavigationAdapter {
  private rootTag: number;

  constructor(rootTag: number) {
    this.rootTag = rootTag;
  }

  push(pageName, propsData, options) {
    NativeNavigator.push(this.rootTag, pageName, propsData, options);
  }
  pop(options) {
    NativeNavigator.pop(this.rootTag, options);
  }
}
```

### Web (React Router) 实现

```ts
export class WebNavigationAdapter implements INavigationAdapter {
  private navigate: NavigateFunction;
  private routeMap: Map<string, string>;

  constructor(navigate: NavigateFunction, routeMap: Map<string, string>) {
    this.navigate = navigate;
    this.routeMap = routeMap;
  }

  push(pageName, propsData) {
    const path = this.routeMap.get(pageName) ?? `/${pageName}`;
    this.navigate(path, { state: propsData });
  }

  pop(options) {
    const count = options?.count ?? 1;
    this.navigate(-count);
  }
}
```

### 测试用 Mock

库已内置 `MockNavigationAdapter`，记录所有 push/pop 调用，方便单元测试：

```ts
import { MockNavigationAdapter } from '@lichenbuliren/flow-orchestrator';

const mock = new MockNavigationAdapter();
// ... 运行流程后
expect(mock.pushHistory).toHaveLength(3);
expect(mock.lastPush?.pageName).toBe('ConfirmPage');
```

## IFlowStorage — 存储适配

`PersistenceMiddleware` 通过 `IFlowStorage` 接口实现存储解耦，支持任意平台的持久化方案：

```ts
interface IFlowStorage {
  get(key: string): Promise<FlowSnapshot | null>;
  set(key: string, value: FlowSnapshot): Promise<void>;
  delete(key: string): Promise<void>;
}
```

### React Native — AsyncStorage

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { IFlowStorage, FlowSnapshot } from '@lichenbuliren/flow-orchestrator';

const STORAGE_PREFIX = 'flow-orchestrator:';

export const asyncFlowStorage: IFlowStorage = {
  async get(key) {
    const raw = await AsyncStorage.getItem(STORAGE_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  },
  async set(key, value) {
    await AsyncStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  },
  async delete(key) {
    await AsyncStorage.removeItem(STORAGE_PREFIX + key);
  },
};
```

### React Native — MMKV（高性能）

```ts
import { MMKV } from 'react-native-mmkv';
import type { IFlowStorage } from '@lichenbuliren/flow-orchestrator';

const mmkv = new MMKV({ id: '@lichenbuliren/flow-orchestrator' });

export const mmkvFlowStorage: IFlowStorage = {
  async get(key) {
    const raw = mmkv.getString(key);
    return raw ? JSON.parse(raw) : null;
  },
  async set(key, value) {
    mmkv.set(key, JSON.stringify(value));
  },
  async delete(key) {
    mmkv.delete(key);
  },
};
```

### Web — localStorage

```ts
import type { IFlowStorage } from '@lichenbuliren/flow-orchestrator';

export const localFlowStorage: IFlowStorage = {
  async get(key) {
    const raw = localStorage.getItem(`flow:${key}`);
    return raw ? JSON.parse(raw) : null;
  },
  async set(key, value) {
    localStorage.setItem(`flow:${key}`, JSON.stringify(value));
  },
  async delete(key) {
    localStorage.removeItem(`flow:${key}`);
  },
};
```

### Web — IndexedDB（大数据量）

```ts
import type { IFlowStorage, FlowSnapshot } from '@lichenbuliren/flow-orchestrator';

export class IndexedDBFlowStorage implements IFlowStorage {
  private dbName = '@lichenbuliren/flow-orchestrator';
  private storeName = 'snapshots';

  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(this.storeName);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async get(key: string): Promise<FlowSnapshot | null> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const req = tx.objectStore(this.storeName).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async set(key: string, value: FlowSnapshot): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async delete(key: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
```

### 使用方式

将存储实现传入 `PersistenceMiddleware`：

```ts
import { FlowOrchestrator, PersistenceMiddleware } from '@lichenbuliren/flow-orchestrator';
import { asyncFlowStorage } from './storage/asyncFlowStorage';

const persistence = new PersistenceMiddleware(
  asyncFlowStorage,
  30 * 60 * 1000, // 快照 TTL：30 分钟
);

const snapshot = await persistence.restoreIfExists('my-flow');
if (snapshot) {
  // 恢复流程...
}

const flow = new FlowOrchestrator({
  flowId: 'my-flow',
  nodes,
  meta,
  adapter,
  middleware: [persistence],
});
```

## ILogger — 日志适配

`LoggingMiddleware` 接受一个 `ILogger` 实现：

```ts
interface ILogger {
  log(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: unknown): void;
}
```

### 内置 console 适配

```ts
import { LoggingMiddleware } from '@lichenbuliren/flow-orchestrator';

// 最简用法：直接传 console
new LoggingMiddleware(console);
```

### 自定义 Logger

```ts
import { LoggingMiddleware } from '@lichenbuliren/flow-orchestrator';
import type { ILogger } from '@lichenbuliren/flow-orchestrator';

const remoteLogger: ILogger = {
  log(message, data) {
    analytics.track('flow_action', { message, ...data });
  },
  error(message, data) {
    errorReporter.captureMessage(message, { extra: data });
  },
};

new LoggingMiddleware(remoteLogger);
```

## 页面交互 API — 跨平台的流程控制

React Hooks（`useFlow` / `useFlowNode`）是针对 React 的便捷封装。对于非 React 平台，直接使用核心 SDK 即可获得完全等价的能力。

### API 对照表

| 能力 | React Hook | 核心 SDK（平台无关） |
|------|-----------|---------------------|
| 获取流程实例 | `useFlow()` | `flowInstanceManager.get(flowId?)` |
| 前进 | `next(data?)` | `flow.next(data?)` |
| 回退 | `goBack(data?)` | `flow.goBack(data?)` |
| 中止 | `abort(data?)` | `flow.abort(data?)` |
| 提取节点数据 | `useFlowNode(props)` | 从 `propsData` 中手动提取 |
| 监听流程事件 | `flow.events.on(...)` | `flow.events.on(...)` |

### 各平台示例

#### Vue 3 — Composition API

```ts | pure
import { ref, onMounted } from 'vue';
import { flowInstanceManager } from '@lichenbuliren/flow-orchestrator';
import type { FlowOrchestrator } from '@lichenbuliren/flow-orchestrator';

export function useFlow(flowId?: string) {
  const flow = ref<FlowOrchestrator | null>(null);

  onMounted(() => {
    flow.value = flowInstanceManager.tryGet(flowId) ?? null;
  });

  return {
    next: (data?: Record<string, unknown>) => flow.value?.next(data),
    goBack: (data?: Record<string, unknown>) => flow.value?.goBack(data),
    abort: (data?: Record<string, unknown>) => flow.value?.abort(data),
    flow,
  };
}
```

#### Flutter / Dart — 直接调用（通过 Bridge）

```dart | pure
// 假设通过 MethodChannel 桥接 JS 引擎（如 JavaScriptCore / Hermes）
class FlowBridge {
  static const _channel = MethodChannel('flow_orchestrator');

  static Future<void> next(String flowId, [Map<String, dynamic>? data]) {
    return _channel.invokeMethod('next', {'flowId': flowId, 'data': data});
  }

  static Future<void> goBack(String flowId, [Map<String, dynamic>? data]) {
    return _channel.invokeMethod('goBack', {'flowId': flowId, 'data': data});
  }

  static Future<void> abort(String flowId, [Map<String, dynamic>? data]) {
    return _channel.invokeMethod('abort', {'flowId': flowId, 'data': data});
  }
}
```

#### 纯 TypeScript / Node.js — 无 UI 框架

```ts | pure
import {
  FlowOrchestrator,
  FlowEventName,
  flowInstanceManager,
  MockNavigationAdapter,
} from '@lichenbuliren/flow-orchestrator';

const adapter = new MockNavigationAdapter();
const flow = new FlowOrchestrator({
  flowId: 'cli-flow',
  nodes,
  meta: { userId: 1 },
  adapter,
});

flowInstanceManager.register(flow);

flow.events.on(FlowEventName.End, ({ history }) => {
  console.log('Flow completed', history);
});

await flow.start();

// 在任意位置通过 manager 获取实例并操作
const f = flowInstanceManager.get('cli-flow');
f.next({ answer: 'yes' });
```

### 提取节点数据（通用工具函数）

`useFlowNode` 的逻辑非常轻量，非 React 平台可直接复用同样的提取逻辑：

```ts | pure
import type { ObjectType } from '@lichenbuliren/flow-orchestrator';

interface FlowNodeInfo<TData = unknown, TMeta = ObjectType> {
  meta: TMeta | undefined;
  node: { id: string | number; name: string; data?: TData } | undefined;
  data: TData | undefined;
  isGoBack: boolean;
}

/**
 * 从页面参数中提取流程节点数据。
 * 适用于任何平台 —— NavigationController push 页面时，
 * 会将 flowMeta、flowNode、__isGoBack 放入 propsData。
 */
export function extractFlowNode<TData = unknown, TMeta = ObjectType>(
  propsData?: Record<string, unknown>,
): FlowNodeInfo<TData, TMeta> {
  return {
    meta: propsData?.flowMeta as TMeta | undefined,
    node: propsData?.flowNode as FlowNodeInfo<TData, TMeta>['node'],
    data: (propsData?.flowNode as any)?.data,
    isGoBack: Boolean(propsData?.__isGoBack),
  };
}
```

> **总结**：`useFlow` 和 `useFlowNode` 只是 `React.useMemo` 的薄封装，核心能力完全在平台无关的 `FlowOrchestrator` + `FlowInstanceManager` 层。任何平台只需 10-20 行代码即可实现等价绑定。

## 架构总览

```
┌──────────────────────────────────────────────────┐
│                  FlowOrchestrator                      │
│           (平台无关的编排器)                       │
│                                                   │
│  FlowEngine ← 纯状态机，零依赖                    │
│  FlowContext ← 跨节点共享状态                     │
│  MiddlewarePipeline ← 可插拔中间件               │
│                                                   │
├──────────────────────────────────────────────────┤
│        通过接口抽象，支持任意平台                   │
│                                                   │
│  INavigationAdapter    IFlowStorage    ILogger    │
│       ↓                     ↓             ↓       │
│  ┌─────────┐          ┌──────────┐   ┌────────┐  │
│  │ RN Nav  │          │AsyncStore│   │console │  │
│  │ Router  │          │ MMKV    │   │Sentry  │  │
│  │ 小程序  │          │ locStor │   │自定义  │  │
│  └─────────┘          └──────────┘   └────────┘  │
└──────────────────────────────────────────────────┘
```
