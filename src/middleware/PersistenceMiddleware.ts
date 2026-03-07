import type {
  FlowSnapshot,
  IFlowStorage,
  Middleware,
  MiddlewareAction,
  MiddlewareContext,
} from '../interfaces';

/**
 * Persists flow state after each navigation so the flow can be
 * resumed if the app is killed unexpectedly.
 *
 * Usage:
 * ```ts
 * const persistence = new PersistenceMiddleware(myStorage, 30 * 60 * 1000);
 * const flow = new StateFlowV3({ ..., middleware: [persistence] });
 *
 * // Before starting a new flow, check for existing snapshot:
 * const snapshot = await persistence.restoreIfExists('my-flow-id');
 * ```
 */
export class PersistenceMiddleware implements Middleware {
  readonly name = 'persistence';

  private storage: IFlowStorage;
  private snapshotTTL: number;

  /**
   * @param storage  Async storage adapter
   * @param snapshotTTL  Max age (ms) for a snapshot to be considered valid. Default: 30 minutes.
   */
  constructor(storage: IFlowStorage, snapshotTTL = 30 * 60 * 1000) {
    this.storage = storage;
    this.snapshotTTL = snapshotTTL;
  }

  async run(action: MiddlewareAction, context: MiddlewareContext): Promise<void> {
    switch (action) {
      case 'after:next':
      case 'after:goBack':
        await this.save(context);
        break;
      case 'after:abort':
        await this.clear(context.flowId);
        break;
    }
  }

  /**
   * Attempt to restore a previously saved snapshot.
   * Returns null if no snapshot exists or if it has expired.
   */
  async restoreIfExists(flowId: string): Promise<FlowSnapshot | null> {
    try {
      const snapshot = await this.storage.get(flowId);
      if (!snapshot) return null;

      if (Date.now() - snapshot.timestamp > this.snapshotTTL) {
        await this.clear(flowId);
        return null;
      }

      return snapshot;
    } catch {
      return null;
    }
  }

  async clear(flowId: string): Promise<void> {
    try {
      await this.storage.delete(flowId);
    } catch {
      // Swallow storage errors
    }
  }

  private async save(context: MiddlewareContext): Promise<void> {
    try {
      const snapshot = context.toSnapshot();
      await this.storage.set(context.flowId, snapshot);
    } catch {
      // Swallow storage errors
    }
  }
}
