import { PresentationType, type FlowNode, type StackBehavior } from '../interfaces';

export interface PageStackEntry {
  nodeId: string | number;
  nodeName: string;
  isInStack: boolean;
  presentation: PresentationType;
  stackBehavior: StackBehavior;
}

/**
 * Tracks which flow pages are currently in the native navigation stack.
 *
 * This is the single source of truth for:
 * - How many pages to pop when pushing a new page (popCount)
 * - Whether a target page is still in the stack (for goBack decisions)
 * - How many pages to pop when exiting the flow
 */
export class PageStack {
  private entries: PageStackEntry[] = [];

  /**
   * Record a new page being pushed into the navigation stack.
   * Returns the popCount that should be used for the push call.
   */
  pushPage(node: FlowNode): { popCount: number } {
    const presentation = node.presentation?.type ?? PresentationType.Push;
    const stackBehavior = node.presentation?.stackBehavior ?? 'replace';
    const isTransparent = presentation === PresentationType.Transparent;

    let popCount = 0;

    if (!isTransparent && stackBehavior === 'replace') {
      popCount = this.countInStackPages();
      this.markAllAsPopped();
    }

    this.entries.push({
      nodeId: node.id,
      nodeName: node.name,
      isInStack: true,
      presentation,
      stackBehavior,
    });

    return { popCount };
  }

  isNodeInStack(nodeId: string | number): boolean {
    const entry = this.findEntry(nodeId);
    return entry?.isInStack ?? false;
  }

  /**
   * Calculate how to navigate back to a target node.
   *
   * @returns popCount - pages to pop, isInStack - whether target page is still mounted
   */
  popToNode(nodeId: string | number): { popCount: number; isInStack: boolean } {
    const targetEntry = this.findEntry(nodeId);
    const isInStack = targetEntry?.isInStack ?? false;

    if (isInStack) {
      const targetIdx = this.entries.indexOf(targetEntry!);
      const pagesToPop = this.entries
        .slice(targetIdx + 1)
        .filter(e => e.isInStack)
        .length;

      this.entries = this.entries.slice(0, targetIdx + 1);
      return { popCount: pagesToPop, isInStack: true };
    }

    // Target is not in stack — need to pop current pages and re-push target
    const currentPopCount = this.countInStackPages();
    const targetIdx = this.entries.findIndex(e => e.nodeId === nodeId);

    if (targetIdx >= 0) {
      this.entries = this.entries.slice(0, targetIdx + 1);
      this.entries[targetIdx].isInStack = true;
    }

    return { popCount: currentPopCount, isInStack: false };
  }

  getTotalPopCount(): number {
    return this.countInStackPages();
  }

  getEntries(): readonly PageStackEntry[] {
    return this.entries;
  }

  clear(): void {
    this.entries = [];
  }

  private findEntry(nodeId: string | number): PageStackEntry | undefined {
    return this.entries.find(e => e.nodeId === nodeId);
  }

  private countInStackPages(): number {
    return this.entries.filter(e => e.isInStack).length;
  }

  private markAllAsPopped(): void {
    for (const entry of this.entries) {
      entry.isInStack = false;
    }
  }
}
