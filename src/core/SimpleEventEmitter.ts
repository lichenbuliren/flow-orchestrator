/**
 * Minimal, type-safe event emitter with zero dependencies.
 *
 * Replaces eventemitter3 to keep this package dependency-free.
 * Supports typed event maps for compile-time safety.
 *
 * @example
 * ```ts
 * interface Events {
 *   start: () => void;
 *   data: (payload: { value: number }) => void;
 * }
 *
 * const emitter = new SimpleEventEmitter<Events>();
 * emitter.on('data', (payload) => console.log(payload.value));
 * emitter.emit('data', { value: 42 });
 * ```
 */
export class SimpleEventEmitter<EventMap extends Record<string, (...args: any[]) => void>> {
  private listeners = new Map<keyof EventMap, Set<Function>>();

  on<K extends keyof EventMap>(event: K, listener: EventMap[K]): this {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener);
    return this;
  }

  once<K extends keyof EventMap>(event: K, listener: EventMap[K]): this {
    const wrapper = ((...args: unknown[]) => {
      this.off(event, wrapper as EventMap[K]);
      (listener as Function).apply(null, args);
    }) as EventMap[K];

    return this.on(event, wrapper);
  }

  off<K extends keyof EventMap>(event: K, listener: EventMap[K]): this {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(listener);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
    return this;
  }

  emit<K extends keyof EventMap>(event: K, ...args: Parameters<EventMap[K]>): boolean {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return false;

    for (const listener of set) {
      listener(...args);
    }
    return true;
  }

  removeAllListeners(event?: keyof EventMap): this {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }

  listenerCount(event: keyof EventMap): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}
