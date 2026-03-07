# state-flow

A high-cohesion, low-coupling flow orchestration engine for multi-step workflows.

## Features

- **Framework-agnostic core** — FlowEngine is pure logic, zero platform dependencies
- **Pluggable navigation** — Implement `INavigationAdapter` for any navigation system
- **Built-in goBack** — First-class backward navigation with automatic stack tracking
- **Middleware pipeline** — Logging, persistence, timeout as plugins, not core code
- **Declarative node config** — `beforeEnter` hooks replace ad-hoc handler patterns
- **Two node types** — `page` (renders UI) and `action` (logic-only, auto-advances)
- **Type-safe** — Full TypeScript support with generics for meta and node data

## Quick Start

```typescript
import {
  StateFlowV3,
  FlowEventName,
  BeforeEnterCode,
  ActionResultType,
  flowInstanceManager,
  type INavigationAdapter,
} from 'state-flow';

// 1. Implement your navigation adapter
const adapter: INavigationAdapter = {
  push(rootTag, pageName, propsData, options) {
    // Integrate with your navigation system
    // e.g., React Navigation, RN Navigator, etc.
    YourNavigator.push(rootTag, pageName, propsData, options);
  },
  pop(rootTag, options) {
    YourNavigator.pop(rootTag, options);
  },
};

// 2. Define your flow nodes
const nodes = [
  {
    id: 1,
    name: 'TermsPage',
    type: 'page' as const,
  },
  {
    id: 2,
    name: 'OTPVerify',
    type: 'page' as const,
    beforeEnter: async (ctx) => {
      if (canSkipOTP(ctx.meta)) return { code: BeforeEnterCode.Skip };
      return { code: BeforeEnterCode.Continue };
    },
  },
  {
    id: 3,
    name: 'KYCCheck',
    type: 'action' as const,
    execute: async (ctx) => {
      const result = await checkKYC();
      if (!result.ok) return { type: ActionResultType.Abort, reason: 'kyc_failed' };
      ctx.set('kycResult', result);
      return { type: ActionResultType.Next };
    },
  },
  {
    id: 4,
    name: 'SetupPIN',
    type: 'page' as const,
    presentation: { secure: true },
  },
];

// 3. Create and start the flow
const flow = new StateFlowV3({
  flowId: 'onboarding',
  nodes,
  meta: { source: 'home', userId: 123 },
  adapter,
  rootTag: 1,
});

flowInstanceManager.register(flow);

flow.events.on(FlowEventName.End, ({ history }) => {
  console.log('Flow completed', history);
});

flow.events.on(FlowEventName.Abort, ({ reason }) => {
  console.log('Flow aborted', reason);
});

await flow.start();
```

## React Hooks

```tsx
import { useFlow, useFlowNode } from 'state-flow';

function MyFlowPage(props) {
  const { next, goBack, abort } = useFlow();
  const { data, meta, isGoBack } = useFlowNode(props);

  return (
    <View>
      <Button onPress={() => goBack()} title="Back" />
      <Button onPress={() => next({ result: 'ok' })} title="Continue" />
      <Button onPress={() => abort()} title="Cancel" />
    </View>
  );
}
```

## Middleware

```typescript
import {
  LoggingMiddleware,
  PersistenceMiddleware,
  TimeoutMiddleware,
} from 'state-flow';

const flow = new StateFlowV3({
  // ...
  middleware: [
    new LoggingMiddleware(logger),
    new PersistenceMiddleware(asyncStorageAdapter),
    new TimeoutMiddleware(5 * 60 * 1000, (ctx) => {
      console.warn('Node timed out', ctx.currentNode);
    }),
  ],
});
```

## Architecture

```
StateFlowV3 (orchestrator)
├── FlowEngine (pure state machine, no platform deps)
├── NavigationController (page stack + popCount, auto-managed)
│   ├── PageStack (tracks which pages are in the native stack)
│   └── INavigationAdapter (your platform implementation)
├── FlowContext (meta + shared state)
└── MiddlewarePipeline (logging, persistence, timeout, ...)
```

## License

MIT
