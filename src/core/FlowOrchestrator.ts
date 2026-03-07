import { FlowEngine } from './FlowEngine';
import { FlowContext } from './FlowContext';
import { NavigationController } from '../navigation/NavigationController';
import { MiddlewarePipeline } from '../middleware/MiddlewarePipeline';
import {
  FlowEventName,
  FlowStatus,
  type FlowEventMap,
  type FlowNode,
  type MiddlewareContext,
  type ObjectType,
  type FlowOrchestratorOptions,
  type TransitionResult,
} from '../interfaces';
import { SimpleEventEmitter } from './SimpleEventEmitter';

/**
 * Main orchestrator — the single public API for the flow engine.
 *
 * Coordinates:
 * - FlowEngine (state machine logic)
 * - NavigationController (page stack & navigation)
 * - MiddlewarePipeline (cross-cutting concerns)
 *
 * @example
 * ```ts
 * const flow = new FlowOrchestrator({
 *   flowId: 'onboarding',
 *   nodes: [...],
 *   meta: { source: 'home' },
 *   adapter: myNavigationAdapter,
 *   middleware: [new LoggingMiddleware(logger)],
 * });
 *
 * flow.events.on('end', ({ history }) => { ... });
 * await flow.start();
 * ```
 */
export class FlowOrchestrator<M extends ObjectType = ObjectType> {
  readonly flowId: string;
  readonly events: SimpleEventEmitter<FlowEventMap>;

  private engine: FlowEngine<M>;
  private navigation: NavigationController;
  private pipeline: MiddlewarePipeline;
  private _disposed = false;

  constructor(options: FlowOrchestratorOptions<M>) {
    this.flowId = options.flowId;
    this.events = new SimpleEventEmitter<FlowEventMap>();

    this.engine = new FlowEngine<M>({
      flowId: options.flowId,
      nodes: cloneNodes(options.nodes),
      meta: options.meta,
    });

    const getPropsData = options.getPropsData
      ? (node: FlowNode, extra?: Record<string, unknown>) =>
          options.getPropsData!(node, this.engine.flowContext.meta as M, extra)
      : (node: FlowNode, extra?: Record<string, unknown>) =>
          defaultGetPropsData(node, this.engine.flowContext.meta, extra);

    this.navigation = new NavigationController({
      adapter: options.adapter,
      getPropsData,
    });

    this.pipeline = new MiddlewarePipeline(options.middleware);
  }

  // ---- Public API ----

  async start(): Promise<void> {
    this.assertNotDisposed();
    this.events.emit(FlowEventName.Start);
    await this.pipeline.run('start', this.createMiddlewareContext());
    await this.next();
  }

  async next(data?: Record<string, unknown>): Promise<void> {
    this.assertNotDisposed();

    try {
      await this.pipeline.run('before:next', this.createMiddlewareContext());

      const fromNode = this.engine.currentNode;
      const result = await this.engine.moveForward(data);

      await this.handleResult(result, fromNode);

      await this.pipeline.run('after:next', this.createMiddlewareContext(), result);
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  async goBack(data?: Record<string, unknown>): Promise<void> {
    this.assertNotDisposed();

    try {
      await this.pipeline.run('before:goBack', this.createMiddlewareContext());

      const fromNode = this.engine.currentNode;
      const result = this.engine.moveBackward(data);

      await this.handleResult(result, fromNode);

      await this.pipeline.run('after:goBack', this.createMiddlewareContext(), result);
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  async abort(data?: Record<string, unknown>): Promise<void> {
    this.assertNotDisposed();

    try {
      await this.pipeline.run('before:abort', this.createMiddlewareContext());

      const result = this.engine.abort(data);
      this.navigation.navigateExit(data);

      this.events.emit(FlowEventName.Abort, {
        reason: 'user_abort',
        data,
      });

      await this.pipeline.run('after:abort', this.createMiddlewareContext(), result);
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  // ---- State accessors ----

  get status(): FlowStatus {
    return this.engine.status;
  }

  get currentNode(): FlowNode | undefined {
    return this.engine.currentNode;
  }

  get currentIndex(): number {
    return this.engine.currentIndex;
  }

  get context(): FlowContext<M> {
    return this.engine.flowContext;
  }

  get history(): readonly FlowNode[] {
    return this.engine.history;
  }

  getNodes(): readonly FlowNode[] {
    return this.engine.getNodes();
  }

  // ---- Dynamic node mutation ----

  insertNodeAfter(afterIndex: number, node: FlowNode): boolean {
    return this.engine.insertNodeAfter(afterIndex, node);
  }

  removeNode(nodeId: string | number): boolean {
    return this.engine.removeNode(nodeId);
  }

  replaceNode(nodeId: string | number, newNode: FlowNode): boolean {
    return this.engine.replaceNode(nodeId, newNode);
  }

  // ---- Misc ----

  dispose(): void {
    this.events.removeAllListeners();
    this._disposed = true;
  }

  get isDisposed(): boolean {
    return this._disposed;
  }

  // ---- Internal ----

  private async handleResult(
    result: TransitionResult,
    fromNode: FlowNode | undefined
  ): Promise<void> {
    switch (result.type) {
      case 'navigate':
        this.navigation.navigateForward(result.node, result.data);
        this.events.emit(FlowEventName.Next, {
          node: result.node,
          fromNode,
          data: result.data,
        });
        break;

      case 'navigate_back': {
        const { wasReCreated } = this.navigation.navigateBackward(
          result.node,
          result.data
        );
        this.events.emit(FlowEventName.GoBack, {
          node: result.node,
          fromNode,
          wasReCreated,
          data: result.data,
        });
        break;
      }

      case 'end':
        this.navigation.navigateExit(result.data);
        this.events.emit(FlowEventName.End, {
          history: this.engine.history,
          data: result.data,
        });
        break;

      case 'abort':
        this.navigation.navigateExit(result.data);
        this.events.emit(FlowEventName.Abort, {
          reason: result.reason,
          data: result.data,
        });
        break;

      case 'exit':
        this.navigation.navigateExit(result.data);
        this.events.emit(FlowEventName.Abort, {
          reason: 'exit_from_first_node',
          data: result.data,
        });
        break;
    }
  }

  private handleError(error: Error): void {
    this.pipeline.runOnError(error, this.createMiddlewareContext());
    this.events.emit(FlowEventName.Error, error);
  }

  private createMiddlewareContext(): MiddlewareContext {
    const engine = this.engine;
    return {
      flowId: this.flowId,
      meta: engine.flowContext.meta,
      currentIndex: engine.currentIndex,
      currentNode: engine.currentNode,
      status: engine.status,
      toSnapshot: () =>
        engine.flowContext.toSnapshot(engine.currentIndex, engine.status),
    };
  }

  private assertNotDisposed(): void {
    if (this._disposed) {
      throw new Error(`FlowOrchestrator "${this.flowId}" has been disposed.`);
    }
  }
}

// ---- Helpers ----

function cloneNodes(nodes: FlowNode[]): FlowNode[] {
  return nodes.map(node => ({
    ...node,
    data: node.data != null ? { ...(node.data as object) } : undefined,
    presentation: node.presentation ? { ...node.presentation } : undefined,
  }));
}

function defaultGetPropsData(
  node: FlowNode,
  meta: ObjectType,
  extra?: Record<string, unknown>
): Record<string, unknown> {
  return {
    flowMeta: meta,
    flowNode: { id: node.id, name: node.name, data: node.data },
    ...(extra ?? {}),
  };
}
