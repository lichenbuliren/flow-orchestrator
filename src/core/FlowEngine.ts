import { FlowContext } from './FlowContext';
import {
  ActionResultType,
  BeforeEnterCode,
  FlowStatus,
  type FlowNode,
  type NodeContext,
  type ObjectType,
  type TransitionResult,
} from '../interfaces';

export interface FlowEngineConfig<M extends ObjectType = ObjectType> {
  flowId: string;
  nodes: FlowNode[];
  meta: M;
}

/**
 * Pure state machine that manages flow progression.
 *
 * Responsibilities:
 * - Track current node index and visited history
 * - Execute beforeEnter lifecycle hooks
 * - Execute action nodes and auto-advance
 * - Provide moveForward / moveBackward / abort transitions
 *
 * Does NOT:
 * - Handle navigation (no RN dependency)
 * - Know about page stacks or popCount
 * - Emit events (that's the orchestrator's job)
 */
export class FlowEngine<M extends ObjectType = ObjectType> {
  private nodes: FlowNode[];
  private _currentIndex = -1;
  private _status: FlowStatus = FlowStatus.Idle;
  private _history: FlowNode[] = [];
  private _context: FlowContext<M>;

  constructor(config: FlowEngineConfig<M>) {
    this.nodes = config.nodes;
    this._context = new FlowContext<M>(config.flowId, config.meta);
  }

  get currentIndex(): number {
    return this._currentIndex;
  }

  get currentNode(): FlowNode | undefined {
    return this._currentIndex >= 0 ? this.nodes[this._currentIndex] : undefined;
  }

  get status(): FlowStatus {
    return this._status;
  }

  get history(): readonly FlowNode[] {
    return this._history;
  }

  get flowContext(): FlowContext<M> {
    return this._context;
  }

  /**
   * Move to the next node in the flow.
   *
   * Processing order:
   * 1. Check if there's a next node (if not → end)
   * 2. Run beforeEnter hook (Skip → recurse, Abort → abort)
   * 3. If action node → execute() and auto-advance
   * 4. If page node → return navigate intent
   */
  async moveForward(data?: Record<string, unknown>): Promise<TransitionResult> {
    const nextIndex = this._currentIndex + 1;

    if (nextIndex >= this.nodes.length) {
      this._status = FlowStatus.Ended;
      return { type: 'end', data };
    }

    const nextNode = this.nodes[nextIndex];
    const nodeCtx = this.createNodeContext(nextIndex);

    if (nextNode.beforeEnter) {
      const result = await nextNode.beforeEnter(nodeCtx);

      if (result.code === BeforeEnterCode.Skip) {
        this.leaveCurrentNode('forward');
        this._currentIndex = nextIndex;
        return this.moveForward(data);
      }

      if (result.code === BeforeEnterCode.Abort) {
        this._status = FlowStatus.Aborted;
        return { type: 'abort', data: result.data, reason: result.reason };
      }
    }

    if (nextNode.type === 'action') {
      if (!nextNode.execute) {
        throw new Error(
          `[FlowOrchestrator] Action node "${nextNode.name}" (id=${nextNode.id}) must provide an execute() function.`
        );
      }

      this.leaveCurrentNode('forward');
      this._currentIndex = nextIndex;
      this._history.push(nextNode);

      const actionResult = await nextNode.execute(nodeCtx);

      if (actionResult.type === ActionResultType.Next) {
        return this.moveForward({ ...data, ...actionResult.data });
      }

      this._status = FlowStatus.Aborted;
      return { type: 'abort', data: actionResult.data, reason: actionResult.reason };
    }

    // Page node
    this.leaveCurrentNode('forward');
    this._currentIndex = nextIndex;
    this._history.push(nextNode);
    this._status = FlowStatus.Running;

    return { type: 'navigate', node: nextNode, data };
  }

  /**
   * Move back to the previous page node, skipping any action nodes.
   * Returns 'exit' if already at the first page node.
   */
  moveBackward(data?: Record<string, unknown>): TransitionResult {
    let targetIndex = this._currentIndex - 1;

    while (targetIndex >= 0 && this.nodes[targetIndex].type === 'action') {
      targetIndex--;
    }

    if (targetIndex < 0) {
      return { type: 'exit', data };
    }

    const targetNode = this.nodes[targetIndex];

    this.leaveCurrentNode('backward');
    this._history.pop();
    this._currentIndex = targetIndex;

    // isInStack is always false here — the NavigationController will
    // determine the actual value from its PageStack.
    return { type: 'navigate_back', node: targetNode, isInStack: false, data };
  }

  abort(data?: Record<string, unknown>): TransitionResult {
    this.leaveCurrentNode('forward');
    this._status = FlowStatus.Aborted;
    return { type: 'abort', data };
  }

  // ---- Dynamic mutation ----

  insertNodeAfter(afterIndex: number, node: FlowNode): boolean {
    if (afterIndex <= this._currentIndex) return false;
    if (afterIndex >= this.nodes.length) return false;
    this.nodes.splice(afterIndex + 1, 0, node);
    return true;
  }

  removeNode(nodeId: string | number): boolean {
    const index = this.nodes.findIndex(n => n.id === nodeId);
    if (index < 0 || index <= this._currentIndex) return false;
    this.nodes.splice(index, 1);
    return true;
  }

  replaceNode(nodeId: string | number, newNode: FlowNode): boolean {
    const index = this.nodes.findIndex(n => n.id === nodeId);
    if (index < 0 || index <= this._currentIndex) return false;
    this.nodes[index] = newNode;
    return true;
  }

  getNodes(): readonly FlowNode[] {
    return this.nodes;
  }

  getNodeCount(): number {
    return this.nodes.length;
  }

  // ---- Private ----

  private createNodeContext(index: number): NodeContext<M> {
    const node = this.nodes[index];
    const ctx = this._context;
    return {
      meta: ctx.meta,
      updateMeta: (partial) => ctx.updateMeta(partial),
      nodeData: node.data,
      get: <T>(key: string) => ctx.get<T>(key),
      set: <T>(key: string, value: T) => ctx.set(key, value),
      currentIndex: index,
      remainingCount: this.nodes.length - index - 1,
      flowId: ctx.flowId,
    };
  }

  private leaveCurrentNode(direction: 'forward' | 'backward'): void {
    if (this._currentIndex < 0) return;
    const current = this.nodes[this._currentIndex];
    if (current.type === 'page' && current.onLeave) {
      current.onLeave(this.createNodeContext(this._currentIndex), direction);
    }
  }
}
