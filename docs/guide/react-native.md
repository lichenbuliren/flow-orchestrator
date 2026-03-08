---
title: React Native 集成
order: 3
---

# React Native 集成

flow-orchestrator 天然适配 React Native 多步骤流程场景。本篇以实际生产级别的开户引导流程为例，展示如何在 RN 项目中集成 flow-orchestrator。

## 架构适配

在 RN 中，flow-orchestrator 通过 `INavigationAdapter` 与原生导航系统对接，FlowEngine 本身不依赖任何 RN API：

```
FlowOrchestrator
├── FlowEngine         ← 纯逻辑，零 RN 依赖
├── NavigationController
│   ├── PageStack      ← 追踪页面在原生栈中的状态
│   └── INavigationAdapter  ← 桥接 RN Navigator
└── MiddlewarePipeline
```

## 1. 实现 NavigationAdapter

将 flow-orchestrator 与你的 RN 导航系统对接，只需实现 `push` 和 `pop` 两个方法：

```ts
import { NativeNavigator } from 'your-rn-navigator';
import type { INavigationAdapter, NavigationPushOptions, NavigationPopOptions } from '@lichenbuliren/flow-orchestrator';

export class RNNavigationAdapter implements INavigationAdapter {
  private rootTag: number;

  constructor(rootTag: number) {
    this.rootTag = rootTag;
  }

  push(
    pageName: string,
    propsData?: Record<string, unknown>,
    options?: NavigationPushOptions,
  ) {
    NativeNavigator.push(this.rootTag, pageName, propsData, options);
  }

  pop(options?: NavigationPopOptions) {
    NativeNavigator.pop(this.rootTag, options);
  }
}
```

> 无论底层是自研导航还是 React Navigation，只需桥接这两个方法即可。

## 2. 定义流程节点

以一个典型的开户引导流程为例，展示各种节点类型的组合：

```ts
import {
  BeforeEnterCode,
  ActionResultType,
  PresentationType,
} from '@lichenbuliren/flow-orchestrator';
import type { FlowNode, NodeContext } from '@lichenbuliren/flow-orchestrator';

interface OnboardingMeta {
  userId: number;
  source: string;
  verifyToken?: string;
  [key: string]: unknown;
}

export const onboardingNodes: FlowNode[] = [
  // ---- Page 节点：用户签署协议 ----
  {
    id: 'terms',
    name: 'TermsPage',
    type: 'page',
  },

  // ---- Page 节点 + beforeEnter：OTP 验证（条件跳过） ----
  {
    id: 'otp',
    name: 'OTPVerifyPage',
    type: 'page',
    beforeEnter: async (ctx: NodeContext<OnboardingMeta>) => {
      const { verifyToken } = ctx.meta;

      if (verifyToken) {
        try {
          const resp = await verifyToken(verifyToken);
          if (resp.code === 0) {
            return { code: BeforeEnterCode.Skip };
          }
        } catch (error) {
          return {
            code: BeforeEnterCode.Abort,
            reason: (error as Error).message,
          };
        }
      }
      return { code: BeforeEnterCode.Continue };
    },
  },

  // ---- Action 节点：KYC 状态检查（纯逻辑，不渲染页面） ----
  {
    id: 'kyc-check',
    name: 'CheckKYCStatus',
    type: 'action',
    execute: async (ctx) => {
      const result = await checkKYCStatus(ctx.meta.userId as number);
      if (!result.canContinue) {
        return { type: ActionResultType.Abort, reason: 'kyc_failed' };
      }
      ctx.set('kycResult', result);
      return { type: ActionResultType.Next };
    },
  },

  // ---- Page 节点：设置 PIN（安全页面） ----
  {
    id: 'pin',
    name: 'SetupPINPage',
    type: 'page',
    presentation: { secure: true },
  },

  // ---- Page 节点：设置生物识别（透明弹窗） ----
  {
    id: 'biometrics',
    name: 'SetupBiometricsPage',
    type: 'page',
    presentation: { type: PresentationType.Transparent },
  },
];
```

### 节点类型对照

| 场景 | 节点配置 | 说明 |
|------|---------|------|
| 普通页面 | `type: 'page'` | 渲染 RN 页面，等待用户操作 |
| 条件跳过 | `type: 'page'` + `beforeEnter` → Skip | 满足条件时自动跳过，不渲染页面 |
| 纯逻辑检查 | `type: 'action'` + `execute` | 自动执行，不渲染页面，根据结果决定继续或中止 |
| 透明弹窗 | `presentation: { type: 'transparent' }` | 不 pop 底层页面，覆盖在上方 |
| 安全页面 | `presentation: { secure: true }` | 传递 secure 标记给原生层 |

## 3. 启动流程

```ts
import {
  FlowOrchestrator,
  FlowEventName,
  flowInstanceManager,
  LoggingMiddleware,
} from '@lichenbuliren/flow-orchestrator';
import { RNNavigationAdapter } from './RNNavigationAdapter';

export async function startOnboardingFlow(
  rootTag: number,
  meta: OnboardingMeta,
): Promise<{ code: number; data: Record<string, unknown> }> {
  const flow = new FlowOrchestrator<OnboardingMeta>({
    flowId: 'onboarding',
    nodes: onboardingNodes,
    meta,
    adapter: new RNNavigationAdapter(rootTag),
    middleware: [
      new LoggingMiddleware(console),
    ],
  });

  flowInstanceManager.register(flow);

  return new Promise((resolve) => {
    flow.events.on(FlowEventName.End, ({ history, data }) => {
      resolve({ code: 0, data: data ?? {} });
    });

    flow.events.on(FlowEventName.Abort, ({ reason, data }) => {
      resolve({ code: -1, data: { ...data, reason } });
    });

    flow.events.on(FlowEventName.Error, (error) => {
      resolve({ code: -2, data: { message: error.message } });
    });

    flow.start();
  });
}
```

## 4. RN 页面组件模板

```tsx | pure
import React from 'react';
import { View, Button, Text } from 'react-native';
import { useFlow, useFlowNode } from '@lichenbuliren/flow-orchestrator';

interface BiometricsData {
  supportsFaceId: boolean;
  supportsTouchId: boolean;
}

const SetupBiometricsPage: React.FC<PageProps> = (props) => {
  const { next, goBack, abort } = useFlow();
  const { data, meta, isGoBack } = useFlowNode<BiometricsData>(props);

  const handleSetup = async () => {
    await enableBiometrics();
    next({ biometricsEnabled: true });
  };

  return (
    <View>
      <Text>
        {isGoBack ? '请重新设置生物识别' : '是否开启生物识别？'}
      </Text>
      <Button title="开启" onPress={handleSetup} />
      <Button title="跳过" onPress={() => next({ biometricsEnabled: false })} />
      <Button title="返回上一步" onPress={() => goBack()} />
      <Button title="退出流程" onPress={() => abort()} />
    </View>
  );
};
```

### 设计要点

flow-orchestrator 的 API 简洁明确：

```ts
const { next, goBack, abort } = useFlow();

next();                                   // 前进到下一个节点
next({ result: 'ok' });                   // 前进并传递数据
goBack();                                 // 回到上一步
abort({ reason: 'user_cancel' });         // 退出流程
```

- **页面无需感知导航栈** — `popCount` 由 NavigationController 自动计算
- **goBack 是一等公民** — 自动判断目标页是否在栈中，决定 pop 或 re-push
- **语义清晰** — `next` / `goBack` / `abort` 三个动作各司其职

## 5. popCount 路由模式 — 关闭当前并 push 下一个

在 RN 导航中，一种常见的页面切换模式是「关闭当前页面的同时 push 下一个页面入栈」，即 `popCount` 路由。flow-orchestrator 的 `NavigationController` + `PageStack` 内部已完整支持此模式，页面开发者无需手动计算。

### 什么是 popCount

`popCount` 是 `NavigationPushOptions` 中的一个字段，表示「在 push 新页面之前，先 pop 掉多少个旧页面」。原生导航器收到 `push(pageName, propsData, { popCount: N })` 时，会先关闭栈顶 N 个页面，再 push 新页面。

```
popCount = 0  →  直接在当前页上方 push（叠加）
popCount = 1  →  关闭当前页，再 push（替换）
popCount = 2  →  关闭栈顶 2 个页面，再 push
```

### 自动计算规则

PageStack 根据节点的 `stackBehavior` 和 `presentation.type` 自动计算 popCount：

| 配置 | popCount 行为 | 适用场景 |
|------|-------------|---------|
| `stackBehavior: 'replace'`（默认） | 关闭所有当前栈内页面后 push | 线性流程，不需要保留前序页面 |
| `stackBehavior: 'keep'` | `popCount = 0`，直接叠加 push | 需要保留页面状态以便 goBack |
| `presentation.type: 'transparent'` | `popCount = 0`，覆盖在底层页面上方 | 弹窗、半屏等透明覆盖层 |

### 流程示例

```
Nodes: [A, B, C]  默认 stackBehavior='replace'

start() → push A (popCount=0)
  原生栈: [A]

next()  → push B (popCount=1, 即先关闭 A 再 push B)
  原生栈: [B]

next()  → push C (popCount=1, 即先关闭 B 再 push C)
  原生栈: [C]
```

### 混合模式示例

```
Nodes:
  A → stackBehavior='keep'
  B → presentation.type='transparent'
  C → stackBehavior='replace'（默认）

push A → popCount=0    原生栈: [A]
push B → popCount=0    原生栈: [A, B]      (透明页，不 pop 底层)
push C → popCount=2    原生栈: [C]          (A + B 全部关闭)
```

### 在 Adapter 中使用 popCount

你的 `INavigationAdapter` 实现会收到 `options.popCount`，将其传递给原生导航即可：

```ts | pure
export class RNNavigationAdapter implements INavigationAdapter {
  private rootTag: number;

  constructor(rootTag: number) {
    this.rootTag = rootTag;
  }

  push(pageName: string, propsData?: Record<string, unknown>, options?: NavigationPushOptions) {
    // options.popCount 由 PageStack 自动计算，直接透传给原生导航器
    NativeNavigator.push(this.rootTag, pageName, propsData, {
      popCount: options?.popCount ?? 0,
      enterType: options?.enterType,
      secure: options?.secure,
    });
  }

  pop(options?: NavigationPopOptions) {
    NativeNavigator.pop(this.rootTag, {
      count: options?.count ?? 1,
    });
  }
}
```

> **关键设计**：页面组件只需调用 `next()` / `goBack()` / `abort()`，popCount 的计算完全由 `PageStack` 根据节点配置自动完成，业务代码无需关心导航栈操作细节。

## 6. goBack 场景详解

NavigationController + PageStack 自动处理所有回退场景，页面无需关心底层导航栈：

### 场景 A：replace 模式（默认）

```
Nodes: [A, B, C]  全部 stackBehavior='replace'

push A → 原生栈: [A]
push B → 原生栈: [B]    (A 被 pop)
push C → 原生栈: [C]    (B 被 pop)

goBack C→B:
  → B 不在栈中 → pop C + re-push B (isGoBack=true)
  → 原生栈: [B]
  → wasReCreated=true ← 页面需从缓存恢复状态
```

### 场景 B：keep 模式

```
Nodes: [A, B, C]  全部 stackBehavior='keep'

push A → 原生栈: [A]
push B → 原生栈: [A, B]
push C → 原生栈: [A, B, C]

goBack C→B:
  → B 在栈中 → 直接 pop C
  → 原生栈: [A, B]
  → wasReCreated=false ← 页面状态完整保留 ✅
```

### 场景 C：透明页回退

```
Nodes: [A, TransB]

push A     → 原生栈: [A]
push TransB → 原生栈: [A, TransB]  (透明页不 pop 底层)

goBack TransB→A:
  → A 在栈中 → 直接 pop TransB
  → 原生栈: [A]
  → wasReCreated=false ← 页面状态完整保留 ✅
```

## 7. 后端数据映射

实际业务中，流程节点通常由后端下发。可以将后端数据映射为 FlowNode：

```ts
import type { FlowNode } from '@lichenbuliren/flow-orchestrator';

const nodeConfigMap: Record<string, FlowNode> = {
  SIGN_TERMS: { id: 'terms', name: 'TermsPage', type: 'page' },
  OTP_VERIFY: { id: 'otp', name: 'OTPPage', type: 'page', beforeEnter: ... },
  KYC_CHECK:  { id: 'kyc', name: 'KYCCheck', type: 'action', execute: ... },
  SET_PIN:    { id: 'pin', name: 'PINPage', type: 'page' },
};

export function mapToFlowNodes(backendItems: BackendItem[]): FlowNode[] {
  return backendItems
    .map(item => {
      const config = nodeConfigMap[item.type];
      if (!config) return null;
      return {
        ...config,
        data: { ...item },
      };
    })
    .filter(Boolean) as FlowNode[];
}
```

## 8. 高阶场景：PageStack 内部机制

### isInStack 状态追踪

`PageStack` 维护一个 `entries` 数组，每个 entry 通过 `isInStack` 标记该页面是否仍在原生导航栈中。这是 popCount 自动计算的核心依据：

```ts | pure
interface PageStackEntry {
  nodeId: string | number;
  nodeName: string;
  isInStack: boolean;       // 是否仍在原生栈中
  presentation: PresentationType;
  stackBehavior: StackBehavior;
}
```

当 `stackBehavior: 'replace'` 的页面 push 时，`PageStack` 会：

1. 调用 `countInStackPages()` — 统计所有 `isInStack === true` 的 entry 数量，作为 popCount
2. 调用 `markAllAsPopped()` — 将所有已有 entry 的 `isInStack` 设为 `false`
3. 新增一条 `isInStack: true` 的 entry

这意味着 popCount 始终等于「当前原生栈中仍然存活的页面数」，而不是简单的固定值。

### 复杂混合模式

当 keep、transparent、replace 三种模式混用时，popCount 的计算会反映实际的栈状态：

```
Nodes:
  A → stackBehavior='keep'
  B → stackBehavior='keep'
  C → presentation.type='transparent'
  D → stackBehavior='replace'（默认）

push A(keep)         → popCount=0    原生栈: [A]          isInStack: [A✓]
push B(keep)         → popCount=0    原生栈: [A, B]       isInStack: [A✓, B✓]
push C(transparent)  → popCount=0    原生栈: [A, B, C]    isInStack: [A✓, B✓, C✓]
push D(replace)      → popCount=3    原生栈: [D]          isInStack: [A✗, B✗, C✗, D✓]
```

D 是 replace 模式，`countInStackPages()` 返回 3（A + B + C 都在栈中），所以 popCount=3，原生导航器先关闭 3 个页面再 push D。

### 跳步回退（goBack 跨越多个节点）

`popToNode()` 支持直接跳步回退到任意历史节点，分两种路径：

**路径 A：目标页仍在栈中（keep / transparent 模式下常见）**

```
Nodes: [A(keep), B(keep), C(keep), D(keep)]

push A → 原生栈: [A]
push B → 原生栈: [A, B]
push C → 原生栈: [A, B, C]
push D → 原生栈: [A, B, C, D]

goBack D→A（跳过 C 和 B）:
  → A 在栈中（isInStack=true）
  → popCount = A 之后 isInStack 的 entry 数 = 3（B + C + D）
  → adapter.pop({ count: 3 })
  → 原生栈: [A]
  → wasReCreated=false ← 页面状态完整保留 ✅
```

**路径 B：目标页已被 pop 出栈（replace 模式下常见）**

```
Nodes: [A(replace), B(replace), C(replace)]

push A → 原生栈: [A]
push B → 原生栈: [B]        (A 被 pop, isInStack=false)
push C → 原生栈: [C]        (B 被 pop, isInStack=false)

goBack C→A（A 不在原生栈中）:
  → A 不在栈中（isInStack=false）
  → popCount = countInStackPages() = 1（只有 C 在栈中）
  → adapter.push('A', propsData, { popCount: 1, __isGoBack: true })
  → 原生栈: [A]（先 pop C，再 push A）
  → wasReCreated=true ← 页面需从缓存恢复状态
```

### wasReCreated 与页面状态恢复

当 `wasReCreated=true` 时，目标页面是被重新 push 的，不是从栈中自然回退的。页面组件可通过 `useFlowNode` 的 `isGoBack` 标记感知此状态：

```tsx | pure
const MyPage: React.FC<PageProps> = (props) => {
  const { data, isGoBack } = useFlowNode(props);

  useEffect(() => {
    if (isGoBack) {
      // 页面是被 re-push 的，需要从 flow data 恢复表单状态
      restoreFormState(data);
    }
  }, [isGoBack]);

  // ...
};
```

> **设计原则**：`stackBehavior: 'keep'` 模式下回退不会触发 re-push，页面 React 状态天然保留。如果你的流程需要频繁回退且希望保持表单状态，优先使用 `keep` 模式。

### 流程退出时的 popCount

当流程结束（`end()`）或中止（`abort()`）时，`NavigationController.navigateExit()` 会调用 `PageStack.getTotalPopCount()` 获取当前栈中所有存活页面的数量，一次性全部关闭：

```
场景：keep 模式下积累了多个页面

push A(keep)  → 原生栈: [A]
push B(keep)  → 原生栈: [A, B]
push C(keep)  → 原生栈: [A, B, C]

abort() / end():
  → getTotalPopCount() = 3
  → adapter.pop({ count: 3 })
  → 原生栈: []  ← 流程所有页面全部关闭
```

```
场景：replace 模式下只有最后一个页面存活

push A(replace)  → 原生栈: [A]
push B(replace)  → 原生栈: [B]
push C(replace)  → 原生栈: [C]

abort() / end():
  → getTotalPopCount() = 1（只有 C 在栈中）
  → adapter.pop({ count: 1 })
  → 原生栈: []
```

### stackBehavior 选择指南

| 场景 | 推荐模式 | 理由 |
|------|---------|------|
| 线性引导流程（不需回退） | `replace`（默认） | 栈中只保留一个页面，内存最优 |
| 表单多步骤（需频繁回退） | `keep` | 回退时页面状态天然保留，无需手动恢复 |
| 弹窗 / 半屏确认 | `transparent` | 底层页面可见，pop 即可回退 |
| 分支流程（可能跳过中间步骤） | `replace` + `beforeEnter: Skip` | 跳过的节点不产生页面，栈保持简洁 |
| 混合：前半段需回退，后半段线性 | 前段 `keep` + 后段 `replace` | 按需保留，兼顾内存和体验 |
