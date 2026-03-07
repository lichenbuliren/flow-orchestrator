---
title: API 参考
order: 1
---

# API 参考

## FlowEngine

纯状态机，不依赖任何平台。

```ts
import { FlowEngine } from '@lichenbuliren/flow-orchestrator';

const engine = new FlowEngine({
  flowId: 'my-flow',
  nodes: [...],
  meta: { userId: 1 },
});
```

### 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `currentIndex` | `number` | 当前节点索引（-1 表示未开始） |
| `currentNode` | `FlowNode \| undefined` | 当前节点对象 |
| `status` | `FlowStatus` | 流程状态：idle / running / ended / aborted / error |
| `history` | `readonly FlowNode[]` | 已访问节点的历史记录 |
| `flowContext` | `FlowContext<M>` | 流程上下文实例 |

### 方法

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `moveForward(data?)` | `Promise<TransitionResult>` | 前进到下一个节点 |
| `moveBackward(data?)` | `TransitionResult` | 回退到上一个页面节点 |
| `abort(data?)` | `TransitionResult` | 中止流程 |
| `insertNodeAfter(afterIndex, node)` | `boolean` | 在指定位置后插入节点 |
| `removeNode(nodeId)` | `boolean` | 移除指定节点 |
| `replaceNode(nodeId, newNode)` | `boolean` | 替换指定节点 |
| `getNodes()` | `readonly FlowNode[]` | 获取所有节点 |
| `getNodeCount()` | `number` | 获取节点数量 |

---

## FlowOrchestrator

完整编排器，整合引擎 + 导航 + 中间件。

```ts
import { FlowOrchestrator } from '@lichenbuliren/flow-orchestrator';

const flow = new FlowOrchestrator({
  flowId: 'onboarding',
  nodes,
  meta: { source: 'home' },
  adapter: navigationAdapter,
  middleware: [loggingMiddleware],
});
```

### 方法

| 方法 | 说明 |
|------|------|
| `start()` | 启动流程 |
| `next(data?)` | 前进 |
| `goBack(data?)` | 回退 |
| `abort(data?)` | 中止 |
| `dispose()` | 销毁流程实例 |

### 属性

| 属性 | 说明 |
|------|------|
| `flowId` | 流程 ID |
| `status` | 流程状态 |
| `currentNode` | 当前节点 |
| `currentIndex` | 当前索引 |
| `context` | FlowContext 实例 |
| `history` | 历史记录 |
| `events` | 事件发射器 |

---

## FlowContext

流程级共享上下文。

| 方法 | 说明 |
|------|------|
| `meta` | 只读 meta 对象 |
| `updateMeta(partial)` | 合并更新 meta |
| `get<T>(key)` | 获取 KV 数据 |
| `set<T>(key, value)` | 设置 KV 数据 |
| `has(key)` | 检查 key 是否存在 |
| `delete(key)` | 删除 KV 数据 |

---

## FlowInstanceManager

流程实例注册中心，**平台无关**。支持多流程并发管理，自动清理已结束的实例。是非 React 平台操作流程的核心入口。

```ts
import { flowInstanceManager, FlowInstanceManager } from '@lichenbuliren/flow-orchestrator';
```

### 方法

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `register(flow)` | `void` | 注册流程实例（同 flowId 会先 dispose 旧实例） |
| `get(flowId?)` | `FlowOrchestrator` | 获取实例（不传 flowId 返回最后注册的），未找到则抛异常 |
| `tryGet(flowId?)` | `FlowOrchestrator \| undefined` | 安全获取，未找到返回 `undefined` |
| `has(flowId)` | `boolean` | 检查实例是否存在 |
| `dispose(flowId)` | `void` | 销毁并移除指定实例 |
| `disposeAll()` | `void` | 销毁所有实例 |
| `size` | `number` | 当前注册实例数量 |

> 库导出了一个默认单例 `flowInstanceManager`，也可以 `new FlowInstanceManager()` 创建独立管理器。

### 跨平台用法

```ts | pure
// 任意平台 —— 获取实例后直接操作
const flow = flowInstanceManager.get('onboarding');
flow.next({ result: 'ok' });
flow.goBack();
flow.abort();
```

---

## React Hooks

> React 专用的便捷封装，底层调用 `FlowInstanceManager` + `FlowOrchestrator`。非 React 平台请参考上方 FlowInstanceManager 直接使用核心 API。

### useFlow

```ts
const { next, goBack, abort, flow } = useFlow(options?);
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `options.flowId` | `string?` | 指定流程 ID（不传则取最后注册的） |
| `options.manager` | `FlowInstanceManager?` | 自定义管理器实例 |

### useFlowNode

```ts
const { meta, node, data, isGoBack } = useFlowNode(props);
```

| 返回值 | 说明 |
|--------|------|
| `meta` | 流程 meta |
| `node` | 当前节点信息 |
| `data` | 节点自定义数据 |
| `isGoBack` | 是否是回退进入 |

> **平台无关替代**：对于非 React 平台，可直接从页面参数 `propsData` 中提取 `flowMeta`、`flowNode`、`__isGoBack` 字段，效果等价于 `useFlowNode`。详见 [跨平台扩展 — 提取节点数据](/guide/cross-platform#提取节点数据通用工具函数)。

---

## 枚举

### FlowStatus

```ts
enum FlowStatus {
  Idle = 'idle',
  Running = 'running',
  Ended = 'ended',
  Aborted = 'aborted',
  Error = 'error',
}
```

### BeforeEnterCode

```ts
enum BeforeEnterCode {
  Continue = 'continue',
  Skip = 'skip',
  Abort = 'abort',
}
```

### ActionResultType

```ts
enum ActionResultType {
  Next = 'next',
  Abort = 'abort',
}
```

### FlowEventName

```ts
enum FlowEventName {
  Start = 'start',
  Next = 'next',
  GoBack = 'goBack',
  End = 'end',
  Abort = 'abort',
  Error = 'error',
}
```

---

## 内置中间件

### LoggingMiddleware

```ts
import { LoggingMiddleware } from '@lichenbuliren/flow-orchestrator';

const middleware = new LoggingMiddleware(logger);
middleware.getTimeline();   // 获取时间线
middleware.clearTimeline(); // 清空时间线
```

### PersistenceMiddleware

```ts
import { PersistenceMiddleware } from '@lichenbuliren/flow-orchestrator';

const middleware = new PersistenceMiddleware(storage, ttl?);
await middleware.restoreIfExists(flowId); // 恢复快照
await middleware.clear(flowId);           // 清除快照
```

### TimeoutMiddleware

```ts
import { TimeoutMiddleware } from '@lichenbuliren/flow-orchestrator';

const middleware = new TimeoutMiddleware(
  5 * 60 * 1000,  // 5 分钟超时
  (ctx) => console.warn('Timeout!', ctx.currentNode),
);
middleware.dispose(); // 清除定时器
```
