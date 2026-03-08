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

## FlowNode

流程节点定义，是 flow-orchestrator 的核心数据结构。

```ts
interface FlowNode<TData = unknown> {
  id: string | number;
  name: string;
  type: 'page' | 'action';
  presentation?: NodePresentation;
  beforeEnter?: (ctx: NodeContext) => Promise<BeforeEnterResult>;
  onLeave?: (ctx: NodeContext, direction: 'forward' | 'backward') => void;
  execute?: (ctx: NodeContext) => Promise<ActionResult>;
  data?: TData;
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `id` | `string \| number` | ✅ | 节点唯一标识，用于栈追踪和 goBack 定位 |
| `name` | `string` | ✅ | 页面名称，传递给 `INavigationAdapter.push()` 的第一个参数 |
| `type` | `'page' \| 'action'` | ✅ | `page` — 渲染页面，等待用户操作；`action` — 纯逻辑节点，自动执行不渲染 |
| `presentation` | `NodePresentation` | ❌ | 页面展示配置（导航动画、栈行为、安全模式等） |
| `beforeEnter` | `(ctx: NodeContext) => Promise<BeforeEnterResult>` | ❌ | 进入节点前的拦截钩子，可返回 Continue / Skip / Abort |
| `onLeave` | `(ctx: NodeContext, direction) => void` | ❌ | 离开节点时的回调，`direction` 为 `'forward'` 或 `'backward'` |
| `execute` | `(ctx: NodeContext) => Promise<ActionResult>` | ❌ | `type: 'action'` 节点的执行逻辑，返回 Next 或 Abort |
| `data` | `TData` | ❌ | 节点自定义数据，可通过泛型指定类型，透传给页面组件 |

### NodePresentation

控制页面在导航栈中的展示方式。

```ts
interface NodePresentation {
  type?: PresentationType;
  secure?: boolean;
  stackBehavior?: StackBehavior;
}
```

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `type` | `PresentationType` | `'push'` | 页面进入动画类型 |
| `secure` | `boolean` | `undefined` | 安全页面标记，透传给原生导航器（如禁止截屏等） |
| `stackBehavior` | `StackBehavior` | `'replace'` | 栈行为：`'replace'` 替换前序页面（内存友好）；`'keep'` 保留前序页面（goBack 时状态保留） |

### StackBehavior

```ts
type StackBehavior = 'replace' | 'keep';
```

| 值 | 说明 |
|------|------|
| `'replace'` | push 新页面时关闭当前栈内所有页面（popCount = 栈内页面数）。线性流程推荐 |
| `'keep'` | push 新页面时不关闭任何页面（popCount = 0）。需要频繁回退的场景推荐 |

---

## NodeContext

节点生命周期钩子（`beforeEnter`、`onLeave`、`execute`）的上下文参数，提供流程状态的只读访问和共享数据读写能力。

```ts
interface NodeContext<M = ObjectType> {
  readonly meta: Readonly<M>;
  updateMeta(partial: Partial<M>): void;
  readonly nodeData: unknown;
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  readonly currentIndex: number;
  readonly remainingCount: number;
  readonly flowId: string;
}
```

| 属性 / 方法 | 类型 | 说明 |
|-------------|------|------|
| `meta` | `Readonly<M>` | 只读的流程 meta 数据 |
| `updateMeta(partial)` | `(partial: Partial<M>) => void` | 合并更新 meta（在钩子中动态修改流程元信息） |
| `nodeData` | `unknown` | 当前节点的 `data` 字段值 |
| `get<T>(key)` | `(key: string) => T \| undefined` | 从流程级 KV 存储中读取数据 |
| `set<T>(key, value)` | `(key: string, value: T) => void` | 向流程级 KV 存储中写入数据 |
| `currentIndex` | `number` | 当前节点在 nodes 数组中的索引 |
| `remainingCount` | `number` | 剩余未访问的节点数（含当前节点） |
| `flowId` | `string` | 当前流程 ID |

---

## BeforeEnterResult

`beforeEnter` 钩子的返回值，决定节点是否继续进入。

```ts
interface BeforeEnterResult {
  code: BeforeEnterCode;
  data?: Record<string, unknown>;
  reason?: string;
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | `BeforeEnterCode` | `Continue` — 正常进入；`Skip` — 跳过当前节点；`Abort` — 中止流程 |
| `data` | `Record<string, unknown>` | 附加数据，Skip 时随 next 传递，Abort 时随 abort 事件传递 |
| `reason` | `string` | Abort 时的中止原因 |

---

## ActionResult

`type: 'action'` 节点 `execute` 方法的返回值。

```ts
interface ActionResult {
  type: ActionResultType;
  data?: Record<string, unknown>;
  reason?: string;
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `type` | `ActionResultType` | `Next` — 继续前进到下一个节点；`Abort` — 中止流程 |
| `data` | `Record<string, unknown>` | 附加数据 |
| `reason` | `string` | Abort 时的中止原因 |

---

## TransitionResult

`FlowEngine` 状态转移方法（`moveForward`、`moveBackward`、`abort`）的返回值，描述本次转移的结果类型。

```ts
type TransitionResult =
  | { type: 'navigate'; node: FlowNode; data?: Record<string, unknown> }
  | { type: 'navigate_back'; node: FlowNode; isInStack: boolean; data?: Record<string, unknown> }
  | { type: 'end'; data?: Record<string, unknown> }
  | { type: 'abort'; data?: Record<string, unknown>; reason?: string }
  | { type: 'exit'; data?: Record<string, unknown> };
```

| type | 触发场景 | 关键字段 |
|------|---------|---------|
| `navigate` | `moveForward` 成功，进入下一个页面节点 | `node` — 目标节点 |
| `navigate_back` | `moveBackward` 成功，回退到上一个页面节点 | `node` — 目标节点；`isInStack` — 目标页是否仍在原生栈中 |
| `end` | 已到达最后一个节点，流程正常结束 | `data` — 结束数据 |
| `abort` | 流程被主动中止（用户调用 abort 或 beforeEnter/execute 返回 Abort） | `reason` — 中止原因 |
| `exit` | 非 running 状态下调用 abort | `data` — 退出数据 |

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

## 枚举与类型

### PresentationType

```ts
enum PresentationType {
  Push = 'push',
  Modal = 'modal',
  Transparent = 'transparent',
  None = 'none',
}
```

| 值 | 说明 |
|------|------|
| `Push` | 标准 push 动画（默认） |
| `Modal` | 模态弹出动画 |
| `Transparent` | 透明覆盖层（不 pop 底层页面，popCount 始终为 0） |
| `None` | 无动画 |

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

## INavigationAdapter

平台无关的导航适配器接口。实现此接口即可对接任意导航系统（React Navigation、RN 原生导航、自研方案等）。

```ts
interface INavigationAdapter {
  push(
    pageName: string,
    propsData?: Record<string, unknown>,
    options?: NavigationPushOptions,
  ): void;

  pop(options?: NavigationPopOptions): void;
}
```

### NavigationPushOptions

```ts
interface NavigationPushOptions {
  popCount?: number;
  enterType?: number;
  secure?: boolean;
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `popCount` | `number` | 在 push 前先 pop 的页面数量（由 PageStack 自动计算） |
| `enterType` | `number` | 进入动画类型（由 PresentationType 映射：0=Push, 1=Modal, 2=None, 3=Transparent） |
| `secure` | `boolean` | 安全页面标记，透传给原生层 |

### NavigationPopOptions

```ts
interface NavigationPopOptions {
  count?: number;
  data?: string;
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `count` | `number` | 要 pop 的页面数量，默认 1 |
| `data` | `string` | JSON 序列化的回传数据 |

---

## 事件 Payload

### FlowNextPayload

```ts
interface FlowNextPayload {
  node: FlowNode;
  fromNode?: FlowNode;
  data?: Record<string, unknown>;
}
```

| 字段 | 说明 |
|------|------|
| `node` | 前进到的目标节点 |
| `fromNode` | 出发节点（首次 start 时为 `undefined`） |
| `data` | 随 `next(data)` 传递的数据 |

### FlowGoBackPayload

```ts
interface FlowGoBackPayload {
  node: FlowNode;
  fromNode?: FlowNode;
  wasReCreated: boolean;
  data?: Record<string, unknown>;
}
```

| 字段 | 说明 |
|------|------|
| `node` | 回退到的目标节点 |
| `fromNode` | 出发节点 |
| `wasReCreated` | 目标页是否被重新创建（`true` 表示不在栈中、需 re-push） |
| `data` | 随 `goBack(data)` 传递的数据 |

### FlowEndPayload

```ts
interface FlowEndPayload {
  history: readonly FlowNode[];
  data?: Record<string, unknown>;
}
```

| 字段 | 说明 |
|------|------|
| `history` | 本次流程经过的所有节点记录 |
| `data` | 最后一次 `next(data)` 传递的数据 |

### FlowAbortPayload

```ts
interface FlowAbortPayload {
  reason?: string;
  data?: Record<string, unknown>;
}
```

| 字段 | 说明 |
|------|------|
| `reason` | 中止原因 |
| `data` | 随 `abort(data)` 传递的数据 |

---

## Middleware

中间件接口，可在流程生命周期的各个阶段注入自定义逻辑。

```ts
interface Middleware {
  readonly name: string;
  run?(
    action: MiddlewareAction,
    context: MiddlewareContext,
    result?: TransitionResult,
  ): Promise<void> | void;
  onError?(error: Error, context: MiddlewareContext): void;
}
```

| 属性 / 方法 | 说明 |
|-------------|------|
| `name` | 中间件名称（用于日志和调试） |
| `run` | 在指定 action 阶段被调用，可异步 |
| `onError` | 流程出错时被调用 |

### MiddlewareAction

```ts
type MiddlewareAction =
  | 'start'
  | 'before:next' | 'after:next'
  | 'before:goBack' | 'after:goBack'
  | 'before:abort' | 'after:abort';
```

### MiddlewareContext

```ts
interface MiddlewareContext {
  readonly flowId: string;
  readonly meta: Readonly<ObjectType>;
  readonly currentIndex: number;
  readonly currentNode?: FlowNode;
  readonly status: FlowStatus;
  toSnapshot(): FlowSnapshot;
}
```

| 属性 / 方法 | 说明 |
|-------------|------|
| `flowId` | 流程 ID |
| `meta` | 只读 meta |
| `currentIndex` | 当前节点索引 |
| `currentNode` | 当前节点 |
| `status` | 流程状态 |
| `toSnapshot()` | 生成当前状态快照（用于持久化） |

---

## 持久化接口

### FlowSnapshot

```ts
interface FlowSnapshot {
  flowId: string;
  currentNodeIndex: number;
  meta: ObjectType;
  status: FlowStatus;
  timestamp: number;
}
```

| 字段 | 说明 |
|------|------|
| `flowId` | 流程 ID |
| `currentNodeIndex` | 当前节点索引 |
| `meta` | 流程 meta 快照 |
| `status` | 流程状态快照 |
| `timestamp` | 快照生成时间戳 |

### IFlowStorage

```ts
interface IFlowStorage {
  get(key: string): Promise<FlowSnapshot | null>;
  set(key: string, value: FlowSnapshot): Promise<void>;
  delete(key: string): Promise<void>;
}
```

实现此接口以对接任意存储后端（AsyncStorage、MMKV、localStorage 等），供 `PersistenceMiddleware` 使用。

---

## 日志接口

### FlowLogEntry

`LoggingMiddleware` 生成的时间线条目。

```ts
interface FlowLogEntry {
  flowId: string;
  action: string;
  timestamp: number;
  duration: number;
  result?: string;
  fromNode?: { id: string | number; name: string };
  toNode?: { id: string | number; name: string };
  error?: string;
  extra?: Record<string, unknown>;
}
```

### ILogger

```ts
interface ILogger {
  log(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: unknown): void;
}
```

传入 `LoggingMiddleware` 构造函数的日志器接口。`console` 对象天然满足此接口。

---

## FlowOrchestratorOptions

`FlowOrchestrator` 构造函数的配置项。

```ts
interface FlowOrchestratorOptions<M extends ObjectType = ObjectType> {
  flowId: string;
  nodes: FlowNode[];
  meta: M;
  adapter: INavigationAdapter;
  middleware?: Middleware[];
  getPropsData?: (
    node: FlowNode,
    meta: M,
    extra?: Record<string, unknown>,
  ) => Record<string, unknown>;
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `flowId` | `string` | ✅ | 流程唯一标识 |
| `nodes` | `FlowNode[]` | ✅ | 流程节点数组（按顺序执行） |
| `meta` | `M` | ✅ | 流程元信息，贯穿整个生命周期 |
| `adapter` | `INavigationAdapter` | ✅ | 导航适配器实例 |
| `middleware` | `Middleware[]` | ❌ | 中间件数组 |
| `getPropsData` | `Function` | ❌ | 自定义页面 propsData 构建函数。默认返回 `{ flowMeta, flowNode, ...extra }` |

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
