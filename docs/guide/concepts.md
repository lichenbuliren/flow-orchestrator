---
title: 核心概念
order: 2
---

# 核心概念

## 架构总览

```
FlowOrchestrator (编排器)
├── FlowEngine (纯状态机，无平台依赖)
├── NavigationController (页面栈 + 导航适配)
│   ├── PageStack (跟踪页面在原生栈中的状态)
│   └── INavigationAdapter (平台导航实现)
├── FlowContext (meta + 共享状态)
└── MiddlewarePipeline (日志、持久化、超时等)
```

## FlowNode — 流程节点

每个流程由有序的 `FlowNode` 数组定义，节点分为两种类型：

| 属性 | 类型 | 说明 |
|------|------|------|
| `id` | `string \| number` | 唯一标识 |
| `name` | `string` | 节点名称（通常对应页面组件名） |
| `type` | `'page' \| 'action'` | 页面节点 / 动作节点 |
| `beforeEnter` | `(ctx) => Promise<BeforeEnterResult>` | 前置钩子：Continue / Skip / Abort |
| `onLeave` | `(ctx, direction) => void` | 离开钩子：forward / backward |
| `execute` | `(ctx) => Promise<ActionResult>` | 动作节点的执行函数 |
| `data` | `unknown` | 节点携带的自定义数据 |
| `presentation` | `NodePresentation` | 导航展示方式 |

## 生命周期

一个节点的完整生命周期：

```
beforeEnter (前一个节点)
    ↓
  Continue? ──→ Skip: 跳过此节点，递归 moveForward
    ↓           Abort: 中止整个流程
  进入节点
    ↓
  Action 节点: 自动执行 execute()，根据结果 Next / Abort
  Page 节点:   等待用户调用 next() / goBack()
    ↓
  onLeave (离开此节点)
    ↓
  进入下一个节点...
```

## FlowContext — 上下文

`FlowContext` 管理流程级别的共享状态：

- **meta** — 流程元数据，通过 `updateMeta(partial)` 合并更新
- **KV Store** — 通过 `get<T>(key)` / `set<T>(key, value)` 存取临时数据

所有节点的 `beforeEnter`、`execute`、`onLeave` 钩子都会收到 `NodeContext`，其中包含 meta 读写和 KV 存取方法。

## TransitionResult — 转换结果

`FlowEngine.moveForward()` / `moveBackward()` 返回的结果：

| 类型 | 含义 |
|------|------|
| `navigate` | 前进到新的页面节点 |
| `navigate_back` | 回退到之前的页面节点 |
| `end` | 流程正常结束 |
| `abort` | 流程被中止 |
| `exit` | 在第一个节点调用 goBack，退出流程 |

## 中间件

中间件在流程转换前后执行自定义逻辑：

```ts
interface Middleware {
  readonly name: string;
  run?(action: MiddlewareAction, context: MiddlewareContext, result?: TransitionResult): Promise<void> | void;
  onError?(error: Error, context: MiddlewareContext): void;
}
```

内置中间件：

- **LoggingMiddleware** — 记录每次转换的时间线
- **PersistenceMiddleware** — 将流程状态持久化到存储
- **TimeoutMiddleware** — 节点超时自动回调

## 动态节点操作

在运行时修改流程结构：

```ts
flow.insertNodeAfter(afterIndex, newNode);  // 在指定位置后插入节点
flow.removeNode(nodeId);                    // 移除未经过的节点
flow.replaceNode(nodeId, newNode);          // 替换未经过的节点
```

> 注意：只能操作当前节点之后的节点，已经过的节点不可修改。
