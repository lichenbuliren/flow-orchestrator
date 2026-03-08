---
title: 多流程管理
order: 3
---

# 多流程管理

flow-orchestrator 通过 `FlowInstanceManager` 原生支持多流程并发，适用于以下场景：

- 主流程中嵌套子流程（如开户流程中嵌套身份验证流程）
- 多个独立流程同时存在（如后台任务流 + 前台用户流）
- A/B 测试不同流程变体

## FlowInstanceManager

`FlowInstanceManager` 是一个流程实例注册表，按 `flowId` 管理所有活跃的 `FlowOrchestrator` 实例。

```ts | pure
import { FlowInstanceManager, flowInstanceManager } from '@lichenbuliren/flow-orchestrator';
```

库导出了一个默认的单例 `flowInstanceManager`，适合大多数场景。如果需要隔离的作用域，也可以 `new FlowInstanceManager()` 创建独立实例。

### 核心 API

| 方法 | 说明 |
|------|------|
| `register(flow)` | 注册实例，同 `flowId` 的旧实例会被自动 dispose |
| `get(flowId?)` | 获取实例，省略 `flowId` 返回最近注册的实例；未找到则抛异常 |
| `tryGet(flowId?)` | 同 `get`，但未找到返回 `undefined` 而非抛异常 |
| `has(flowId)` | 判断是否存在 |
| `dispose(flowId)` | 销毁指定实例 |
| `disposeAll()` | 销毁所有实例 |
| `size` | 当前注册的实例数量 |

### 自动清理

流程结束（`End`）或中止（`Abort`）时，`FlowInstanceManager` 会自动将对应实例从注册表中移除，无需手动清理。

## 使用示例

### 并发运行多个独立流程

```ts | pure
import {
  FlowOrchestrator,
  flowInstanceManager,
  MockNavigationAdapter,
} from '@lichenbuliren/flow-orchestrator';

const adapter = new MockNavigationAdapter();

// 创建并注册流程 A
const flowA = new FlowOrchestrator({
  flowId: 'kyc-flow',
  nodes: kycNodes,
  meta: { userId: 1 },
  adapter,
});
flowInstanceManager.register(flowA);

// 创建并注册流程 B
const flowB = new FlowOrchestrator({
  flowId: 'payment-flow',
  nodes: paymentNodes,
  meta: { orderId: 'ORD-001' },
  adapter,
});
flowInstanceManager.register(flowB);

// 分别启动
await flowA.start();
await flowB.start();

// 在任意位置通过 flowId 获取
const kyc = flowInstanceManager.get('kyc-flow');
const payment = flowInstanceManager.get('payment-flow');
```

### 主流程中嵌套子流程

一个常见场景：主流程的某个 action 节点内部启动一个子流程，子流程完成后主流程继续推进。

```ts | pure
import {
  FlowOrchestrator,
  FlowEventName,
  ActionResultType,
  flowInstanceManager,
} from '@lichenbuliren/flow-orchestrator';

const mainNodes = [
  { id: 'step1', name: 'Welcome', type: 'page' as const },
  {
    id: 'step2',
    name: 'RunSubFlow',
    type: 'action' as const,
    execute: async (ctx) => {
      // 在 action 节点中启动子流程
      const subFlow = new FlowOrchestrator({
        flowId: 'sub-verification',
        nodes: verificationNodes,
        meta: { parentFlowId: 'main-onboarding' },
        adapter,
      });
      flowInstanceManager.register(subFlow);

      // 等待子流程完成
      await new Promise<void>((resolve, reject) => {
        subFlow.events.on(FlowEventName.End, () => resolve());
        subFlow.events.on(FlowEventName.Abort, () =>
          reject(new Error('Sub-flow aborted')),
        );
        subFlow.start();
      });

      return { type: ActionResultType.Next };
    },
  },
  { id: 'step3', name: 'Complete', type: 'page' as const },
];

const mainFlow = new FlowOrchestrator({
  flowId: 'main-onboarding',
  nodes: mainNodes,
  meta: {},
  adapter,
});
flowInstanceManager.register(mainFlow);
await mainFlow.start();
```

### React 中指定 flowId

当存在多个流程时，在 React 组件中通过 `useFlow({ flowId })` 指定要操作的流程：

```tsx | pure
import { useFlow, useFlowNode } from '@lichenbuliren/flow-orchestrator';

// 页面属于 KYC 流程
function KYCPage(props) {
  const { next, goBack } = useFlow({ flowId: 'kyc-flow' });
  const { data, meta } = useFlowNode(props);

  return (
    <View>
      <Button onPress={() => goBack()} title="Back" />
      <Button onPress={() => next()} title="Continue" />
    </View>
  );
}

// 页面属于 Payment 流程
function PaymentPage(props) {
  const { next, abort } = useFlow({ flowId: 'payment-flow' });
  const { data } = useFlowNode(props);

  return (
    <View>
      <Button onPress={() => next({ confirmed: true })} title="Pay" />
      <Button onPress={() => abort()} title="Cancel" />
    </View>
  );
}
```

不传 `flowId` 时，`useFlow()` 默认返回最近注册的流程实例。

### 使用独立的 Manager 实例

如果需要将不同模块的流程完全隔离（例如避免命名冲突），可以创建独立的 `FlowInstanceManager`：

```ts | pure
import { FlowInstanceManager } from '@lichenbuliren/flow-orchestrator';

// 模块 A 有自己的 manager
const moduleAManager = new FlowInstanceManager();
moduleAManager.register(flowA);

// 模块 B 有自己的 manager
const moduleBManager = new FlowInstanceManager();
moduleBManager.register(flowB);
```

在 React 中通过 `manager` 选项指定：

```tsx | pure
const { next } = useFlow({ flowId: 'my-flow', manager: moduleAManager });
```

## 最佳实践

1. **flowId 保持唯一** — 同一个 manager 中注册相同 `flowId` 会自动 dispose 旧实例，确保不会出现幽灵流程
2. **子流程用独立 flowId** — 子流程使用不同的 `flowId`（如 `sub-verification`），避免与主流程冲突
3. **全局清理** — 在 App 退出或用户登出时调用 `flowInstanceManager.disposeAll()` 释放所有资源
4. **检查是否存在** — 使用 `tryGet()` 而非 `get()` 可以安全地处理流程不存在的情况，避免抛异常
