import type {
  INavigationAdapter,
  NavigationPopOptions,
  NavigationPushOptions,
} from '../interfaces';

export interface MockPushRecord {
  rootTag: number;
  pageName: string;
  propsData?: Record<string, unknown>;
  options?: NavigationPushOptions;
}

export interface MockPopRecord {
  rootTag: number;
  options?: NavigationPopOptions;
}

/**
 * In-memory navigation adapter for testing.
 * Records all push/pop calls for assertion.
 */
export class MockNavigationAdapter implements INavigationAdapter {
  readonly pushHistory: MockPushRecord[] = [];
  readonly popHistory: MockPopRecord[] = [];

  push(
    rootTag: number,
    pageName: string,
    propsData?: Record<string, unknown>,
    options?: NavigationPushOptions
  ): void {
    this.pushHistory.push({ rootTag, pageName, propsData, options });
  }

  pop(rootTag: number, options?: NavigationPopOptions): void {
    this.popHistory.push({ rootTag, options });
  }

  get lastPush(): MockPushRecord | undefined {
    return this.pushHistory[this.pushHistory.length - 1];
  }

  get lastPop(): MockPopRecord | undefined {
    return this.popHistory[this.popHistory.length - 1];
  }

  reset(): void {
    this.pushHistory.length = 0;
    this.popHistory.length = 0;
  }
}
