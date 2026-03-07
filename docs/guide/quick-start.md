---
title: 快速开始
order: 1
---

# 快速开始

## 安装

```bash
npm install @lichenbuliren/flow-orchestrator
# or
pnpm add @lichenbuliren/flow-orchestrator
```

## 核心概念

flow-orchestrator 由以下模块组成：

| 模块 | 职责 |
|------|------|
| **FlowEngine** | 纯状态机，管理节点推进、回退、中止 |
| **FlowOrchestrator** | 编排器，整合引擎 + 导航 + 中间件 |
| **FlowContext** | 共享上下文，跨节点传递 meta 和临时数据 |
| **NavigationController** | 页面栈管理 + 平台导航适配 |
| **MiddlewarePipeline** | 可插拔中间件（日志、持久化、超时等） |

## 基础用法

### 1. 定义流程节点

```ts
import { BeforeEnterCode, ActionResultType } from '@lichenbuliren/flow-orchestrator';
import type { FlowNode } from '@lichenbuliren/flow-orchestrator';

const nodes: FlowNode[] = [
  {
    id: 'terms',
    name: 'TermsPage',
    type: 'page',
  },
  {
    id: 'verify',
    name: 'OTPVerify',
    type: 'page',
    beforeEnter: async (ctx) => {
      // 满足条件时跳过此节点
      if (ctx.meta.isVerified) {
        return { code: BeforeEnterCode.Skip };
      }
      return { code: BeforeEnterCode.Continue };
    },
  },
  {
    id: 'kyc',
    name: 'KYCCheck',
    type: 'action',
    execute: async (ctx) => {
      const result = await fetchKYCStatus(ctx.meta.userId);
      if (!result.ok) {
        return { type: ActionResultType.Abort, reason: 'kyc_failed' };
      }
      ctx.updateMeta({ kycResult: result });
      return { type: ActionResultType.Next };
    },
  },
  {
    id: 'pin',
    name: 'SetupPIN',
    type: 'page',
  },
];
```

### 2. 创建并启动流程

```ts
import { FlowOrchestrator, FlowEventName, flowInstanceManager } from '@lichenbuliren/flow-orchestrator';

const flow = new FlowOrchestrator({
  flowId: 'onboarding',
  nodes,
  meta: { userId: 123, source: 'home' },
  adapter: yourNavigationAdapter,
});

// 注册到全局管理器（供 React Hooks 使用）
flowInstanceManager.register(flow);

// 监听事件
flow.events.on(FlowEventName.End, ({ history }) => {
  console.log('Flow completed', history);
});

flow.events.on(FlowEventName.Abort, ({ reason }) => {
  console.log('Flow aborted:', reason);
});

// 启动流程
await flow.start();
```

### 3. 在页面组件中使用 Hooks

```tsx | pure
import { useFlow, useFlowNode } from '@lichenbuliren/flow-orchestrator';

function MyFlowPage(props) {
  const { next, goBack, abort } = useFlow();
  const { data, meta, isGoBack } = useFlowNode(props);

  return (
    <div>
      <h1>{isGoBack ? '返回到此页面' : '首次进入'}</h1>
      <button onClick={() => goBack()}>返回</button>
      <button onClick={() => next({ result: 'ok' })}>继续</button>
      <button onClick={() => abort()}>取消</button>
    </div>
  );
}
```

### 4. 非 React 平台：直接使用核心 API

React Hooks 只是对核心 API 的薄封装，非 React 环境（如原生 iOS/Android、Flutter、Vue、命令行工具等）可直接使用平台无关的核心 SDK：

```ts | pure
import {
  flowInstanceManager,
  type FlowOrchestrator,
} from '@lichenbuliren/flow-orchestrator';

// ---- 等价于 useFlow() ----
const flow = flowInstanceManager.get('onboarding');
flow.next({ result: 'ok' });   // 前进
flow.goBack();                  // 回退
flow.abort({ reason: 'cancel' }); // 中止

// ---- 等价于 useFlowNode(props) ----
// NavigationController 推页面时会把 propsData 传入页面，
// 框架层自行从页面参数中提取即可：
function extractFlowNode(propsData: Record<string, unknown>) {
  return {
    meta: propsData.flowMeta,
    node: propsData.flowNode,
    data: (propsData.flowNode as any)?.data,
    isGoBack: Boolean(propsData.__isGoBack),
  };
}
```

> **设计原则**：`FlowEngine`、`FlowOrchestrator`、`FlowInstanceManager`、`FlowContext` 均不依赖任何 UI 框架。React Hooks 只是其中一种上层便捷封装，各平台可按需提供自己的绑定层。详见 [跨平台扩展](/guide/cross-platform)。

## 两种节点类型

### Page 节点（页面节点）

渲染 UI，等待用户操作后调用 `next()` / `goBack()` 推进流程。

### Action 节点（动作节点）

纯逻辑节点，执行 `execute()` 后自动前进。适合 API 调用、数据校验等场景。

```ts
{
  id: 'submit',
  name: 'SubmitData',
  type: 'action',
  execute: async (ctx) => {
    await api.submit(ctx.meta);
    return { type: ActionResultType.Next };
  },
}
```

## 下一步

- 查看 [核心概念](/guide/concepts) 了解架构设计
- 体验 [在线演示](/demos/basic-flow) 感受流程引擎
- 阅读 [API 参考](/api) 了解完整接口
