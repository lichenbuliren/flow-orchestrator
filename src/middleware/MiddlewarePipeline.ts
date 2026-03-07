import type {
  Middleware,
  MiddlewareAction,
  MiddlewareContext,
  TransitionResult,
} from '../interfaces';

/**
 * Executes an ordered chain of middleware on each flow action.
 * Middleware run sequentially; errors in one middleware do not prevent others from running.
 */
export class MiddlewarePipeline {
  private middlewares: Middleware[];

  constructor(middlewares: Middleware[] = []) {
    this.middlewares = middlewares;
  }

  async run(
    action: MiddlewareAction,
    context: MiddlewareContext,
    result?: TransitionResult
  ): Promise<void> {
    for (const mw of this.middlewares) {
      if (mw.run) {
        try {
          await mw.run(action, context, result);
        } catch {
          // Middleware errors should not break the flow
        }
      }
    }
  }

  runOnError(error: Error, context: MiddlewareContext): void {
    for (const mw of this.middlewares) {
      if (mw.onError) {
        try {
          mw.onError(error, context);
        } catch {
          // swallow
        }
      }
    }
  }

  add(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  remove(name: string): boolean {
    const idx = this.middlewares.findIndex(m => m.name === name);
    if (idx >= 0) {
      this.middlewares.splice(idx, 1);
      return true;
    }
    return false;
  }

  getMiddleware(name: string): Middleware | undefined {
    return this.middlewares.find(m => m.name === name);
  }
}
