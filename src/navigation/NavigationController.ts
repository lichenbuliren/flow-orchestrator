import { PageStack } from './PageStack';
import {
  PresentationType,
  type FlowNode,
  type INavigationAdapter,
  type ObjectType,
} from '../interfaces';

export type PropsDataBuilder = (
  node: FlowNode,
  extra?: Record<string, unknown>
) => Record<string, unknown>;

export interface NavigationControllerConfig {
  adapter: INavigationAdapter;
  getPropsData: PropsDataBuilder;
}

/**
 * Owns all navigation-related concerns:
 * - Page stack tracking (via PageStack)
 * - popCount calculation
 * - Forward / backward / exit navigation
 *
 * Business code never touches popCount — this controller computes it
 * automatically from the node's presentation config and stack state.
 */
export class NavigationController {
  private adapter: INavigationAdapter;
  private pageStack: PageStack;
  private getPropsData: PropsDataBuilder;

  constructor(config: NavigationControllerConfig) {
    this.adapter = config.adapter;
    this.pageStack = new PageStack();
    this.getPropsData = config.getPropsData;
  }

  /**
   * Push a new page onto the navigation stack.
   * popCount is computed automatically from the node's presentation settings.
   */
  navigateForward(node: FlowNode, data?: Record<string, unknown>): void {
    const { popCount } = this.pageStack.pushPage(node);
    const propsData = this.getPropsData(node, data);

    this.adapter.push(node.name, propsData, {
      popCount,
      enterType: mapPresentationType(node.presentation?.type),
      secure: node.presentation?.secure,
    });
  }

  /**
   * Navigate back to a target node.
   *
   * If the target page is still in the stack → simple pop.
   * If it was already popped → pop current + re-push target (with __isGoBack marker).
   *
   * @returns wasReCreated - true if the target page had to be re-created
   */
  navigateBackward(
    node: FlowNode,
    data?: Record<string, unknown>
  ): { wasReCreated: boolean } {
    const { popCount, isInStack } = this.pageStack.popToNode(node.id);

    if (isInStack) {
      this.adapter.pop({
        count: popCount,
        data: JSON.stringify(data ?? {}),
      });
      return { wasReCreated: false };
    }

    const propsData = this.getPropsData(node, {
      ...data,
      __isGoBack: true,
    });

    this.adapter.push(node.name, propsData, {
      popCount,
      enterType: mapPresentationType(node.presentation?.type),
      secure: node.presentation?.secure,
    });

    return { wasReCreated: true };
  }

  /**
   * Close all flow pages (used on flow end / abort).
   */
  navigateExit(data?: Record<string, unknown>): void {
    const popCount = this.pageStack.getTotalPopCount();
    if (popCount > 0) {
      this.adapter.pop({
        count: popCount,
        data: JSON.stringify({ ...data, isFlowEnd: true }),
      });
    }
    this.pageStack.clear();
  }

  getPageStack(): PageStack {
    return this.pageStack;
  }
}

function mapPresentationType(type?: PresentationType): number | undefined {
  switch (type) {
    case PresentationType.Push: return 0;
    case PresentationType.Modal: return 1;
    case PresentationType.None: return 2;
    case PresentationType.Transparent: return 3;
    default: return undefined;
  }
}
