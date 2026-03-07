import { StateFlowV3 } from './core/StateFlowV3';
import { FlowEventName, type ObjectType } from './interfaces';

/**
 * Registry for managing multiple concurrent StateFlowV3 instances.
 *
 * Features:
 * - Auto-cleanup when a flow ends or is aborted
 * - Retrieve by flowId, or get the most recently registered instance
 * - Safe dispose of all instances
 *
 * @example
 * ```ts
 * const manager = new FlowInstanceManager();
 *
 * // Register
 * manager.register(flow);
 *
 * // Retrieve (in hooks or pages)
 * const flow = manager.get('my-flow');
 * const flow = manager.get(); // latest instance
 * ```
 */
export class FlowInstanceManager {
  private instances = new Map<string, StateFlowV3>();

  /**
   * Register a flow instance. If one with the same flowId already exists,
   * the old instance is disposed first.
   */
  register<M extends ObjectType>(flow: StateFlowV3<M>): void {
    const existing = this.instances.get(flow.flowId);
    if (existing) {
      existing.dispose();
    }

    this.instances.set(flow.flowId, flow as StateFlowV3);

    const cleanup = () => {
      if (this.instances.get(flow.flowId) === (flow as StateFlowV3)) {
        this.instances.delete(flow.flowId);
      }
    };

    flow.events.on(FlowEventName.End, cleanup);
    flow.events.on(FlowEventName.Abort, cleanup);
  }

  /**
   * Get a flow instance by flowId.
   * If flowId is omitted, returns the most recently registered instance.
   *
   * @throws If no instance is found
   */
  get<M extends ObjectType = ObjectType>(flowId?: string): StateFlowV3<M> {
    if (flowId) {
      const instance = this.instances.get(flowId);
      if (!instance) {
        throw new Error(`[StateFlowV3] Flow instance not found: "${flowId}"`);
      }
      return instance as StateFlowV3<M>;
    }

    const entries = Array.from(this.instances.values());
    if (entries.length === 0) {
      throw new Error('[StateFlowV3] No flow instance registered.');
    }

    return entries[entries.length - 1] as StateFlowV3<M>;
  }

  /**
   * Safely try to get an instance. Returns undefined instead of throwing.
   */
  tryGet<M extends ObjectType = ObjectType>(flowId?: string): StateFlowV3<M> | undefined {
    try {
      return this.get<M>(flowId);
    } catch {
      return undefined;
    }
  }

  has(flowId: string): boolean {
    return this.instances.has(flowId);
  }

  dispose(flowId: string): void {
    const instance = this.instances.get(flowId);
    if (instance) {
      instance.dispose();
      this.instances.delete(flowId);
    }
  }

  disposeAll(): void {
    for (const instance of this.instances.values()) {
      instance.dispose();
    }
    this.instances.clear();
  }

  get size(): number {
    return this.instances.size;
  }
}

/**
 * Default singleton instance for convenience.
 * Apps that need multiple managers can create their own FlowInstanceManager instances.
 */
export const flowInstanceManager = new FlowInstanceManager();
