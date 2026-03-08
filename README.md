# flow-orchestrator

A high-cohesion, low-coupling flow orchestration engine for multi-step workflows.

[Documentation](https://lichenbuliren.github.io/flow-orchestrator/) | [npm](https://www.npmjs.com/package/@lichenbuliren/flow-orchestrator)

## Features

- **Framework-agnostic core** — FlowEngine is pure logic, zero platform dependencies
- **Pluggable navigation** — Implement `INavigationAdapter` for any navigation system
- **Built-in goBack** — First-class backward navigation with automatic stack tracking
- **Middleware pipeline** — Logging, persistence, timeout as plugins, not core code
- **Declarative node config** — `beforeEnter` hooks replace ad-hoc handler patterns
- **Two node types** — `page` (renders UI) and `action` (logic-only, auto-advances)
- **Type-safe** — Full TypeScript support with generics for meta and node data

## Install

```bash
npm install @lichenbuliren/flow-orchestrator
# or
pnpm add @lichenbuliren/flow-orchestrator
```

React is an optional peer dependency — only required when using the React hooks (`useFlow` / `useFlowNode`).

## Quick Start

```typescript
import {
  FlowOrchestrator,
  FlowEventName,
  BeforeEnterCode,
  ActionResultType,
  flowInstanceManager,
  type INavigationAdapter,
} from '@lichenbuliren/flow-orchestrator';

// 1. Implement your navigation adapter
const adapter: INavigationAdapter = {
  push(pageName, propsData, options) {
    YourNavigator.push(pageName, propsData, options);
  },
  pop(options) {
    YourNavigator.pop(options);
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
const flow = new FlowOrchestrator({
  flowId: 'onboarding',
  nodes,
  meta: { source: 'home', userId: 123 },
  adapter,
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
import { useFlow, useFlowNode } from '@lichenbuliren/flow-orchestrator';

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
} from '@lichenbuliren/flow-orchestrator';

const flow = new FlowOrchestrator({
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
FlowOrchestrator (orchestrator)
├── FlowEngine (pure state machine, no platform deps)
├── NavigationController (page stack + popCount, auto-managed)
│   ├── PageStack (tracks which pages are in the native stack)
│   └── INavigationAdapter (your platform implementation)
├── FlowContext (meta + shared state)
└── MiddlewarePipeline (logging, persistence, timeout, ...)
```

## Development

### Prerequisites

- Node.js >= 16
- [pnpm](https://pnpm.io/) (recommended)

### Setup

```bash
pnpm install
```

### Build

```bash
# Production build (outputs CJS + ESM + .d.ts to dist/)
pnpm build

# Watch mode for development
pnpm dev
```

Build is powered by [tsup](https://tsup.egoist.dev/). Configuration lives in `tsup.config.ts`, outputting:

| Format | File |
|--------|------|
| CommonJS | `dist/index.js` |
| ES Module | `dist/index.esm.js` |
| Type declarations | `dist/index.d.ts` |

### Test

```bash
pnpm test
```

Tests use [Jest](https://jestjs.io/) + [ts-jest](https://kulshekhar.github.io/ts-jest/). Test files live in `src/__tests__/`.

### Type Check

```bash
pnpm typecheck
```

## Documentation

The documentation site is built with [dumi](https://d.umijs.org/).

### Local Preview

```bash
pnpm docs:dev
```

This starts a local dev server (usually at `http://localhost:8000`) with hot reload enabled.

### Build Docs

```bash
pnpm docs:build
```

Static files are generated to `docs-dist/`.

### Writing a Demo

Demos live in `docs/demos/` and are referenced from markdown pages. To add a new demo:

1. Create a React component in `docs/demos/`, e.g. `docs/demos/MyDemo.tsx`:

```tsx
import React, { useState } from 'react';
import { FlowEngine, FlowStatus } from '@lichenbuliren/flow-orchestrator';
import type { FlowNode } from '@lichenbuliren/flow-orchestrator';

const NODES: FlowNode[] = [
  { id: 'step1', name: 'Step1', type: 'page' },
  { id: 'step2', name: 'Step2', type: 'page' },
];

export default function MyDemo() {
  // your demo logic here
  return <div>...</div>;
}
```

2. Create a companion markdown file `docs/demos/my-demo.md`:

```markdown
---
title: My Demo
order: 3
---

# My Demo

Brief description of what this demo shows.

<code src="./MyDemo.tsx"></code>
```

3. (Optional) Add the page to navigation in `.dumirc.ts` if you want it in the top nav/sidebar.

The demo can import from `@lichenbuliren/flow-orchestrator` directly — dumi resolves it to `src/index.ts` via the alias configured in `.dumirc.ts`.

## Release

Version management and publishing are handled by [Changesets](https://github.com/changesets/changesets).

### First-time Setup

```bash
# Login to npmjs.org (only needed once per machine)
npm login --registry https://registry.npmjs.org/

# Verify identity
npm whoami --registry https://registry.npmjs.org/
```

### Workflow Overview

```
Code change → pnpm changeset → commit → pnpm version → pnpm release
```

### 1. Add a Changeset

After making changes, describe what changed and the semver impact:

```bash
pnpm changeset
```

Follow the interactive prompts to select the version bump type (`patch` / `minor` / `major`) and write a change summary. This generates a markdown file in `.changeset/` — commit it along with your code.

### 2. Version (Consume Changesets)

When ready to release, consume all pending changesets to bump `package.json` version and update `CHANGELOG.md`:

```bash
pnpm version
```

Review the version bump and changelog, then commit:

```bash
git add .
git commit -m "chore: release v0.2.0"
git tag v0.2.0
```

### 3. Publish

```bash
pnpm release
```

This runs `pnpm build` then `changeset publish`, which publishes to npm with `public` access.

### Prerelease (Alpha / Beta)

For testing unstable versions before an official release:

#### Enter Prerelease Mode

```bash
# Enter alpha prerelease
pnpm changeset pre enter alpha

# Or beta
pnpm changeset pre enter beta
```

#### Publish Prerelease Versions

```bash
# 1. Add changeset as usual
pnpm changeset

# 2. Version — produces e.g. 0.2.0-beta.0, 0.2.0-beta.1, ...
pnpm version

# 3. Commit and publish
git add .
git commit -m "chore: release v0.2.0-beta.0"
pnpm release
```

Repeat steps 1–3 to publish additional prerelease iterations (`.beta.1`, `.beta.2`, ...).

#### Exit Prerelease Mode

When the prerelease is stable and ready for official release:

```bash
pnpm changeset pre exit
```

Then follow the normal version + release flow to publish the stable version.

#### Install a Prerelease Version

```bash
# Users install prerelease with the tag
npm install @lichenbuliren/flow-orchestrator@beta
npm install @lichenbuliren/flow-orchestrator@alpha
```

### Quick Reference

| Command | Description |
|---------|-------------|
| `pnpm changeset` | Add a new changeset |
| `pnpm version` | Bump version & update CHANGELOG |
| `pnpm release` | Build & publish to npm |
| `pnpm changeset pre enter beta` | Enter beta prerelease mode |
| `pnpm changeset pre enter alpha` | Enter alpha prerelease mode |
| `pnpm changeset pre exit` | Exit prerelease mode |
| `pnpm release --dry-run` | Preview publish without uploading |

### Key Points

- Project-level `.npmrc` sets `registry=https://registry.npmjs.org/`, overriding any global config
- `.changeset/config.json` sets `"access": "public"` for scoped package publishing
- `prepack` script auto-runs `pnpm build` before publishing
- `publishConfig` in `package.json` remaps entry points to `dist/`
- Only `dist/`, `package.json`, `CHANGELOG.md`, and `README.md` are included in the tarball (controlled by the `files` field)

## License

MIT
