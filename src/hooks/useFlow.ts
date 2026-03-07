import { useMemo } from 'react';
import { flowInstanceManager, FlowInstanceManager } from '../FlowInstanceManager';
import type { ObjectType } from '../interfaces';
import type { StateFlowV3 } from '../core/StateFlowV3';

export interface UseFlowOptions {
  flowId?: string;
  /** Use a custom manager instead of the default singleton */
  manager?: FlowInstanceManager;
}

export interface UseFlowReturn<M extends ObjectType = ObjectType> {
  /**
   * Advance to the next node.
   * No rootTag or popCount needed — handled internally.
   */
  next: (data?: Record<string, unknown>) => void;
  /**
   * Go back to the previous page node.
   * The engine decides whether to pop or re-push the target page.
   */
  goBack: (data?: Record<string, unknown>) => void;
  /**
   * Abort (exit) the entire flow. All flow pages are closed.
   */
  abort: (data?: Record<string, unknown>) => void;
  /**
   * The underlying StateFlowV3 instance (or null if not found).
   */
  flow: StateFlowV3<M> | null;
}

/**
 * React hook for interacting with a StateFlowV3 instance.
 *
 * Replaces V2's `useStateFlowV2()`. Key improvements:
 * - No rootTag parameter needed
 * - No popCount / extraPopCount parameters
 * - goBack() is a first-class operation
 * - Explicit abort() vs goBack() semantics
 *
 * @example
 * ```tsx
 * const { next, goBack, abort } = useFlow();
 *
 * <Button onPress={() => next({ result: 'success' })} title="Continue" />
 * <Button onPress={() => goBack()} title="Back" />
 * <Button onPress={() => abort({ reason: 'cancel' })} title="Cancel" />
 * ```
 */
export function useFlow<M extends ObjectType = ObjectType>(
  options?: UseFlowOptions
): UseFlowReturn<M> {
  const mgr = options?.manager ?? flowInstanceManager;
  const flowId = options?.flowId;

  const flow = useMemo(() => {
    return mgr.tryGet<M>(flowId) ?? null;
  }, [mgr, flowId]);

  const next = useMemo(
    () => (data?: Record<string, unknown>) => {
      if (!flow) {
        if (__DEV__) {
          console.warn('[useFlow] No flow instance found. Call next() ignored.');
        }
        return;
      }
      flow.next(data);
    },
    [flow]
  );

  const goBack = useMemo(
    () => (data?: Record<string, unknown>) => {
      if (!flow) {
        if (__DEV__) {
          console.warn('[useFlow] No flow instance found. Call goBack() ignored.');
        }
        return;
      }
      flow.goBack(data);
    },
    [flow]
  );

  const abort = useMemo(
    () => (data?: Record<string, unknown>) => {
      if (!flow) {
        if (__DEV__) {
          console.warn('[useFlow] No flow instance found. Call abort() ignored.');
        }
        return;
      }
      flow.abort(data);
    },
    [flow]
  );

  return { next, goBack, abort, flow };
}

declare const __DEV__: boolean;
