import type {
  FlowLogEntry,
  ILogger,
  Middleware,
  MiddlewareAction,
  MiddlewareContext,
  TransitionResult,
} from '../interfaces';

/**
 * Records structured log entries for every flow action.
 * Produces a timeline that can be used for debugging, analytics, or APM reporting.
 *
 * Usage:
 * ```ts
 * const logging = new LoggingMiddleware(myLogger);
 * const flow = new StateFlowV3({ ..., middleware: [logging] });
 *
 * // After flow completes:
 * const timeline = logging.getTimeline();
 * ```
 */
export class LoggingMiddleware implements Middleware {
  readonly name = 'logging';

  private logger: ILogger;
  private timeline: FlowLogEntry[] = [];
  private lastTimestamp = 0;

  constructor(logger: ILogger) {
    this.logger = logger;
  }

  run(
    action: MiddlewareAction,
    context: MiddlewareContext,
    result?: TransitionResult
  ): void {
    const now = Date.now();

    const entry: FlowLogEntry = {
      flowId: context.flowId,
      action,
      timestamp: now,
      duration: this.lastTimestamp > 0 ? now - this.lastTimestamp : 0,
      result: result?.type,
    };

    if (result) {
      if (result.type === 'navigate' || result.type === 'navigate_back') {
        entry.toNode = { id: result.node.id, name: result.node.name };
      }
      if (context.currentNode) {
        entry.fromNode = {
          id: context.currentNode.id,
          name: context.currentNode.name,
        };
      }
    }

    this.timeline.push(entry);
    this.lastTimestamp = now;

    this.logger.log(`[StateFlowV3] ${action}`, entry as unknown as Record<string, unknown>);
  }

  onError(error: Error, context: MiddlewareContext): void {
    const now = Date.now();
    const entry: FlowLogEntry = {
      flowId: context.flowId,
      action: 'error',
      timestamp: now,
      duration: this.lastTimestamp > 0 ? now - this.lastTimestamp : 0,
      error: error.message,
    };

    this.timeline.push(entry);
    this.lastTimestamp = now;

    this.logger.error(`[StateFlowV3] error`, {
      flowId: context.flowId,
      message: error.message,
    });
  }

  getTimeline(): readonly FlowLogEntry[] {
    return this.timeline;
  }

  clearTimeline(): void {
    this.timeline = [];
    this.lastTimestamp = 0;
  }
}
