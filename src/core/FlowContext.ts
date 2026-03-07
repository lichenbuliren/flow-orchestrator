import type { FlowSnapshot, FlowStatus, ObjectType } from '../interfaces';

/**
 * Manages shared state across the entire flow lifecycle.
 *
 * Provides:
 * - `meta`: Flow-level metadata (e.g., source, partner_business_id)
 * - `sharedState`: Key-value store for inter-node communication
 * - Serializable snapshots for persistence
 */
export class FlowContext<M extends ObjectType = ObjectType> {
  readonly flowId: string;
  private _meta: M;
  private sharedState: Map<string, unknown> = new Map();

  constructor(flowId: string, meta: M) {
    this.flowId = flowId;
    this._meta = { ...meta };
  }

  get meta(): Readonly<M> {
    return this._meta;
  }

  updateMeta(partial: Partial<M>): void {
    this._meta = { ...this._meta, ...partial };
  }

  get<T>(key: string): T | undefined {
    return this.sharedState.get(key) as T | undefined;
  }

  set<T>(key: string, value: T): void {
    this.sharedState.set(key, value);
  }

  has(key: string): boolean {
    return this.sharedState.has(key);
  }

  delete(key: string): boolean {
    return this.sharedState.delete(key);
  }

  toSnapshot(currentNodeIndex: number, status: FlowStatus): FlowSnapshot {
    return {
      flowId: this.flowId,
      currentNodeIndex,
      meta: { ...this._meta } as ObjectType,
      status,
      timestamp: Date.now(),
    };
  }
}
