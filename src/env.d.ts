/**
 * Ambient declarations for runtime globals that exist in all target
 * environments (browser, Node.js, React Native) but are not included
 * in the "ESNext" lib.
 */

// Timers
declare function setTimeout(callback: (...args: unknown[]) => void, ms?: number): number;
declare function clearTimeout(id: number | undefined): void;

// Console
declare const console: {
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
};
