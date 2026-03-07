// ============================================================
// flow-orchestrator
// A high-cohesion, low-coupling flow orchestration engine
// ============================================================

// ---- Core ----
export { FlowOrchestrator } from './core/FlowOrchestrator';
export { FlowEngine } from './core/FlowEngine';
export { FlowContext } from './core/FlowContext';
export { SimpleEventEmitter } from './core/SimpleEventEmitter';

// ---- Navigation ----
export { NavigationController } from './navigation/NavigationController';
export { PageStack } from './navigation/PageStack';
export { MockNavigationAdapter } from './navigation/MockNavigationAdapter';

// ---- Middleware ----
export { MiddlewarePipeline } from './middleware/MiddlewarePipeline';
export { LoggingMiddleware } from './middleware/LoggingMiddleware';
export { PersistenceMiddleware } from './middleware/PersistenceMiddleware';
export { TimeoutMiddleware } from './middleware/TimeoutMiddleware';

// ---- Instance Management ----
export { FlowInstanceManager, flowInstanceManager } from './FlowInstanceManager';

// ---- React Hooks ----
export { useFlow } from './hooks/useFlow';
export { useFlowNode } from './hooks/useFlowNode';

// ---- Types & Enums ----
export {
  // Enums
  PresentationType,
  BeforeEnterCode,
  ActionResultType,
  FlowStatus,
  FlowEventName,

  // Interfaces & Types
  type ObjectType,
  type StackBehavior,
  type NodePresentation,
  type BeforeEnterResult,
  type ActionResult,
  type NodeContext,
  type FlowNode,
  type TransitionResult,
  type NavigationPushOptions,
  type NavigationPopOptions,
  type INavigationAdapter,
  type FlowNextPayload,
  type FlowGoBackPayload,
  type FlowEndPayload,
  type FlowAbortPayload,
  type FlowEventMap,
  type Middleware,
  type MiddlewareAction,
  type MiddlewareContext,
  type FlowSnapshot,
  type IFlowStorage,
  type FlowLogEntry,
  type ILogger,
  type FlowOrchestratorOptions,
} from './interfaces';

// Re-export sub-types for convenience
export type { PageStackEntry } from './navigation/PageStack';
export type { MockPushRecord, MockPopRecord } from './navigation/MockNavigationAdapter';
export type { UseFlowOptions, UseFlowReturn } from './hooks/useFlow';
export type { UseFlowNodeReturn } from './hooks/useFlowNode';
export type { FlowEngineConfig } from './core/FlowEngine';
export type { PropsDataBuilder, NavigationControllerConfig } from './navigation/NavigationController';
