// ============================================================
// Core Types for FlowOrchestrator Flow Orchestration Engine
// ============================================================

export type ObjectType = Record<string, unknown>;

// ---- Presentation & Navigation ----

export enum PresentationType {
  Push = 'push',
  Modal = 'modal',
  Transparent = 'transparent',
  None = 'none',
}

/**
 * Controls whether the previous page stays in the navigation stack
 * when transitioning forward.
 *
 * - `replace`: Pop the previous page when pushing the new one (memory-friendly,
 *   but goBack requires re-creating the previous page).
 * - `keep`: Keep the previous page in the stack (goBack preserves page state).
 */
export type StackBehavior = 'replace' | 'keep';

export interface NodePresentation {
  type?: PresentationType;
  secure?: boolean;
  stackBehavior?: StackBehavior;
}

// ---- BeforeEnter / Action Results ----

export enum BeforeEnterCode {
  Continue = 'continue',
  Skip = 'skip',
  Abort = 'abort',
}

export interface BeforeEnterResult {
  code: BeforeEnterCode;
  data?: Record<string, unknown>;
  reason?: string;
}

export enum ActionResultType {
  Next = 'next',
  Abort = 'abort',
}

export interface ActionResult {
  type: ActionResultType;
  data?: Record<string, unknown>;
  reason?: string;
}

// ---- Node Context ----

export interface NodeContext<M = ObjectType> {
  readonly meta: Readonly<M>;
  updateMeta(partial: Partial<M>): void;
  readonly nodeData: unknown;
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  readonly currentIndex: number;
  readonly remainingCount: number;
  readonly flowId: string;
}

// ---- Flow Node ----

export interface FlowNode<TData = unknown> {
  id: string | number;
  name: string;
  type: 'page' | 'action';
  presentation?: NodePresentation;
  beforeEnter?: (ctx: NodeContext) => Promise<BeforeEnterResult>;
  onLeave?: (ctx: NodeContext, direction: 'forward' | 'backward') => void;
  execute?: (ctx: NodeContext) => Promise<ActionResult>;
  data?: TData;
}

// ---- Transition Result ----

export type TransitionResult =
  | { type: 'navigate'; node: FlowNode; data?: Record<string, unknown> }
  | { type: 'navigate_back'; node: FlowNode; isInStack: boolean; data?: Record<string, unknown> }
  | { type: 'end'; data?: Record<string, unknown> }
  | { type: 'abort'; data?: Record<string, unknown>; reason?: string }
  | { type: 'exit'; data?: Record<string, unknown> };

// ---- Flow Status ----

export enum FlowStatus {
  Idle = 'idle',
  Running = 'running',
  Ended = 'ended',
  Aborted = 'aborted',
  Error = 'error',
}

// ---- Navigation Adapter ----

export interface NavigationPushOptions {
  popCount?: number;
  enterType?: number;
  secure?: boolean;
}

export interface NavigationPopOptions {
  count?: number;
  data?: string;
}

/**
 * Platform-agnostic navigation adapter.
 * Implement this interface to integrate with your navigation system
 * (e.g., React Navigation, RN Navigator, or a custom solution).
 */
export interface INavigationAdapter {
  push(
    pageName: string,
    propsData?: Record<string, unknown>,
    options?: NavigationPushOptions
  ): void;

  pop(
    options?: NavigationPopOptions
  ): void;
}

// ---- Events ----

export enum FlowEventName {
  Start = 'start',
  Next = 'next',
  GoBack = 'goBack',
  End = 'end',
  Abort = 'abort',
  Error = 'error',
}

export interface FlowNextPayload {
  node: FlowNode;
  fromNode?: FlowNode;
  data?: Record<string, unknown>;
}

export interface FlowGoBackPayload {
  node: FlowNode;
  fromNode?: FlowNode;
  wasReCreated: boolean;
  data?: Record<string, unknown>;
}

export interface FlowEndPayload {
  history: readonly FlowNode[];
  data?: Record<string, unknown>;
}

export interface FlowAbortPayload {
  reason?: string;
  data?: Record<string, unknown>;
}

export interface FlowEventMap {
  [FlowEventName.Start]: () => void;
  [FlowEventName.Next]: (payload: FlowNextPayload) => void;
  [FlowEventName.GoBack]: (payload: FlowGoBackPayload) => void;
  [FlowEventName.End]: (payload: FlowEndPayload) => void;
  [FlowEventName.Abort]: (payload: FlowAbortPayload) => void;
  [FlowEventName.Error]: (error: Error) => void;
}

// ---- Middleware ----

export type MiddlewareAction =
  | 'start'
  | 'before:next' | 'after:next'
  | 'before:goBack' | 'after:goBack'
  | 'before:abort' | 'after:abort';

export interface Middleware {
  readonly name: string;
  run?(
    action: MiddlewareAction,
    context: MiddlewareContext,
    result?: TransitionResult
  ): Promise<void> | void;
  onError?(error: Error, context: MiddlewareContext): void;
}

export interface MiddlewareContext {
  readonly flowId: string;
  readonly meta: Readonly<ObjectType>;
  readonly currentIndex: number;
  readonly currentNode?: FlowNode;
  readonly status: FlowStatus;
  toSnapshot(): FlowSnapshot;
}

// ---- Persistence ----

export interface FlowSnapshot {
  flowId: string;
  currentNodeIndex: number;
  meta: ObjectType;
  status: FlowStatus;
  timestamp: number;
}

export interface IFlowStorage {
  get(key: string): Promise<FlowSnapshot | null>;
  set(key: string, value: FlowSnapshot): Promise<void>;
  delete(key: string): Promise<void>;
}

// ---- Logging ----

export interface FlowLogEntry {
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

export interface ILogger {
  log(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: unknown): void;
}

// ---- Constructor Options ----

export interface FlowOrchestratorOptions<M extends ObjectType = ObjectType> {
  flowId: string;
  nodes: FlowNode[];
  meta: M;
  adapter: INavigationAdapter;
  middleware?: Middleware[];
  /**
   * Custom function to build propsData for each page node.
   * Defaults to `{ flowMeta, flowNode, ...extra }`.
   */
  getPropsData?: (node: FlowNode, meta: M, extra?: Record<string, unknown>) => Record<string, unknown>;
}
