import { PageStack } from '../navigation/PageStack';
import { PresentationType, type FlowNode } from '../interfaces';

function page(id: number, name: string, overrides?: Partial<FlowNode>): FlowNode {
  return { id, name, type: 'page', ...overrides };
}

function transparentPage(id: number, name: string): FlowNode {
  return page(id, name, {
    presentation: { type: PresentationType.Transparent },
  });
}

function keepPage(id: number, name: string): FlowNode {
  return page(id, name, {
    presentation: { stackBehavior: 'keep' },
  });
}

describe('PageStack', () => {
  describe('pushPage — replace mode (default)', () => {
    it('should return popCount=0 for the first page', () => {
      const stack = new PageStack();
      const { popCount } = stack.pushPage(page(1, 'A'));
      expect(popCount).toBe(0);
    });

    it('should return popCount=1 for the second non-transparent page', () => {
      const stack = new PageStack();
      stack.pushPage(page(1, 'A'));
      const { popCount } = stack.pushPage(page(2, 'B'));
      expect(popCount).toBe(1);
    });

    it('should return popCount=1 for each subsequent page', () => {
      const stack = new PageStack();
      stack.pushPage(page(1, 'A'));
      stack.pushPage(page(2, 'B'));
      const { popCount } = stack.pushPage(page(3, 'C'));
      expect(popCount).toBe(1);
    });

    it('should mark previous pages as popped', () => {
      const stack = new PageStack();
      stack.pushPage(page(1, 'A'));
      stack.pushPage(page(2, 'B'));
      expect(stack.isNodeInStack(1)).toBe(false);
      expect(stack.isNodeInStack(2)).toBe(true);
    });
  });

  describe('pushPage — transparent pages', () => {
    it('should return popCount=0 for transparent pages', () => {
      const stack = new PageStack();
      stack.pushPage(page(1, 'A'));
      const { popCount } = stack.pushPage(transparentPage(2, 'TransB'));
      expect(popCount).toBe(0);
    });

    it('should keep previous pages in stack', () => {
      const stack = new PageStack();
      stack.pushPage(page(1, 'A'));
      stack.pushPage(transparentPage(2, 'TransB'));
      expect(stack.isNodeInStack(1)).toBe(true);
      expect(stack.isNodeInStack(2)).toBe(true);
    });

    it('should pop transparent + previous when followed by a replace page', () => {
      const stack = new PageStack();
      stack.pushPage(page(1, 'A'));
      stack.pushPage(transparentPage(2, 'TransB'));
      const { popCount } = stack.pushPage(page(3, 'C'));
      // Both A and TransB are in stack, so popCount=2
      expect(popCount).toBe(2);
    });
  });

  describe('pushPage — keep mode', () => {
    it('should return popCount=0 for keep mode pages', () => {
      const stack = new PageStack();
      stack.pushPage(page(1, 'A'));
      const { popCount } = stack.pushPage(keepPage(2, 'B'));
      expect(popCount).toBe(0);
    });

    it('should keep previous pages in stack', () => {
      const stack = new PageStack();
      stack.pushPage(page(1, 'A'));
      stack.pushPage(keepPage(2, 'B'));
      expect(stack.isNodeInStack(1)).toBe(true);
      expect(stack.isNodeInStack(2)).toBe(true);
    });
  });

  describe('popToNode — target in stack', () => {
    it('should pop pages above the target (transparent scenario)', () => {
      const stack = new PageStack();
      stack.pushPage(page(1, 'A'));
      stack.pushPage(transparentPage(2, 'TransB'));

      const result = stack.popToNode(1);
      expect(result.isInStack).toBe(true);
      expect(result.popCount).toBe(1); // pop TransB
    });

    it('should pop pages above the target (keep mode scenario)', () => {
      const stack = new PageStack();
      stack.pushPage(keepPage(1, 'A'));
      stack.pushPage(keepPage(2, 'B'));
      stack.pushPage(keepPage(3, 'C'));

      const result = stack.popToNode(1);
      expect(result.isInStack).toBe(true);
      expect(result.popCount).toBe(2); // pop C and B
    });

    it('should truncate entries after target', () => {
      const stack = new PageStack();
      stack.pushPage(keepPage(1, 'A'));
      stack.pushPage(keepPage(2, 'B'));
      stack.pushPage(keepPage(3, 'C'));

      stack.popToNode(1);
      expect(stack.getEntries()).toHaveLength(1);
    });
  });

  describe('popToNode — target not in stack', () => {
    it('should return isInStack=false for popped pages', () => {
      const stack = new PageStack();
      stack.pushPage(page(1, 'A'));
      stack.pushPage(page(2, 'B')); // pops A

      const result = stack.popToNode(1);
      expect(result.isInStack).toBe(false);
      expect(result.popCount).toBe(1); // pop B
    });

    it('should mark target as re-entered in stack', () => {
      const stack = new PageStack();
      stack.pushPage(page(1, 'A'));
      stack.pushPage(page(2, 'B'));

      stack.popToNode(1);
      expect(stack.isNodeInStack(1)).toBe(true);
    });
  });

  describe('getTotalPopCount', () => {
    it('should count only pages currently in stack', () => {
      const stack = new PageStack();
      stack.pushPage(page(1, 'A'));
      stack.pushPage(page(2, 'B')); // pops A
      stack.pushPage(transparentPage(3, 'TransC'));

      // B and TransC are in stack
      expect(stack.getTotalPopCount()).toBe(2);
    });
  });

  describe('mixed scenarios', () => {
    it('should handle A(replace) → TransB(transparent) → C(replace)', () => {
      const stack = new PageStack();

      const r1 = stack.pushPage(page(1, 'A'));
      expect(r1.popCount).toBe(0);

      const r2 = stack.pushPage(transparentPage(2, 'TransB'));
      expect(r2.popCount).toBe(0);

      const r3 = stack.pushPage(page(3, 'C'));
      expect(r3.popCount).toBe(2); // pops A + TransB

      expect(stack.isNodeInStack(1)).toBe(false);
      expect(stack.isNodeInStack(2)).toBe(false);
      expect(stack.isNodeInStack(3)).toBe(true);
    });

    it('should handle goBack from TransB to A', () => {
      const stack = new PageStack();
      stack.pushPage(page(1, 'A'));
      stack.pushPage(transparentPage(2, 'TransB'));

      const result = stack.popToNode(1);
      expect(result.isInStack).toBe(true);
      expect(result.popCount).toBe(1);
    });

    it('should handle A(keep) → B(keep) → C(keep) → goBack to A', () => {
      const stack = new PageStack();
      stack.pushPage(keepPage(1, 'A'));
      stack.pushPage(keepPage(2, 'B'));
      stack.pushPage(keepPage(3, 'C'));

      const result = stack.popToNode(1);
      expect(result.isInStack).toBe(true);
      expect(result.popCount).toBe(2);
      expect(stack.getEntries()).toHaveLength(1);
    });

    it('should handle A(replace) → B(replace) → goBack to A (re-push)', () => {
      const stack = new PageStack();
      stack.pushPage(page(1, 'A'));
      stack.pushPage(page(2, 'B'));

      expect(stack.isNodeInStack(1)).toBe(false);

      const result = stack.popToNode(1);
      expect(result.isInStack).toBe(false);
      expect(result.popCount).toBe(1); // pop B, then caller re-pushes A
      expect(stack.isNodeInStack(1)).toBe(true);
    });
  });
});
