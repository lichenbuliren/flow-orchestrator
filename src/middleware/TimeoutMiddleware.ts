import type {
  Middleware,
  MiddlewareAction,
  MiddlewareContext,
} from '../interfaces';

export type TimeoutCallback = (context: MiddlewareContext) => void;

/**
 * Guards against nodes that hang indefinitely.
 * Resets a timer on each navigation; fires the callback if no transition
 * occurs within the configured duration.
 *
 * Usage:
 * ```ts
 * const timeout = new TimeoutMiddleware(5 * 60 * 1000, (ctx) => {
 *   console.warn('Flow node timed out', ctx.currentNode);
 * });
 * const flow = new FlowOrchestrator({ ..., middleware: [timeout] });
 * ```
 */
export class TimeoutMiddleware implements Middleware {
  readonly name = 'timeout';

  private timeoutMs: number;
  private timer: number | null = null;
  private onTimeout?: TimeoutCallback;

  constructor(timeoutMs = 5 * 60 * 1000, onTimeout?: TimeoutCallback) {
    this.timeoutMs = timeoutMs;
    this.onTimeout = onTimeout;
  }

  run(action: MiddlewareAction, context: MiddlewareContext): void {
    switch (action) {
      case 'after:next':
      case 'after:goBack':
        this.resetTimer(context);
        break;
      case 'after:abort':
        this.clearTimer();
        break;
    }
  }

  dispose(): void {
    this.clearTimer();
  }

  private resetTimer(context: MiddlewareContext): void {
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.onTimeout?.(context);
    }, this.timeoutMs);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
