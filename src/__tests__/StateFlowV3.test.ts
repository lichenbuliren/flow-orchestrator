import { StateFlowV3 } from '../core/StateFlowV3';
import { MockNavigationAdapter } from '../navigation/MockNavigationAdapter';
import {
  ActionResultType,
  BeforeEnterCode,
  FlowEventName,
  FlowStatus,
  PresentationType,
  type FlowNode,
} from '../interfaces';

function page(id: number, name: string, overrides?: Partial<FlowNode>): FlowNode {
  return { id, name, type: 'page', ...overrides };
}

function createFlow(nodes: FlowNode[], meta: Record<string, unknown> = {}) {
  const adapter = new MockNavigationAdapter();
  const flow = new StateFlowV3({
    flowId: 'test',
    nodes,
    meta,
    adapter,
    rootTag: 1,
  });
  return { flow, adapter };
}

describe('StateFlowV3', () => {
  describe('basic flow lifecycle', () => {
    it('should start and navigate to the first node', async () => {
      const { flow, adapter } = createFlow([page(1, 'PageA'), page(2, 'PageB')]);

      const startSpy = jest.fn();
      const nextSpy = jest.fn();
      flow.events.on(FlowEventName.Start, startSpy);
      flow.events.on(FlowEventName.Next, nextSpy);

      await flow.start();

      expect(startSpy).toHaveBeenCalledTimes(1);
      expect(nextSpy).toHaveBeenCalledTimes(1);
      expect(nextSpy).toHaveBeenCalledWith(
        expect.objectContaining({ node: expect.objectContaining({ name: 'PageA' }) })
      );
      expect(adapter.pushHistory).toHaveLength(1);
      expect(adapter.pushHistory[0].pageName).toBe('PageA');
    });

    it('should complete flow and emit end event', async () => {
      const { flow } = createFlow([page(1, 'A')]);

      const endSpy = jest.fn();
      flow.events.on(FlowEventName.End, endSpy);

      await flow.start(); // -> A
      await flow.next();  // -> end

      expect(endSpy).toHaveBeenCalledTimes(1);
      expect(endSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          history: expect.arrayContaining([
            expect.objectContaining({ name: 'A' }),
          ]),
        })
      );
      expect(flow.status).toBe(FlowStatus.Ended);
    });

    it('should pass data through next()', async () => {
      const { flow, adapter } = createFlow([page(1, 'A'), page(2, 'B')]);

      await flow.start(); // -> A
      await flow.next({ result: 'success' }); // -> B

      expect(adapter.pushHistory[1].propsData).toEqual(
        expect.objectContaining({ result: 'success' })
      );
    });
  });

  describe('goBack', () => {
    it('should go back to previous page (keep mode)', async () => {
      const { flow, adapter } = createFlow([
        page(1, 'A', { presentation: { stackBehavior: 'keep' } }),
        page(2, 'B', { presentation: { stackBehavior: 'keep' } }),
      ]);

      const goBackSpy = jest.fn();
      flow.events.on(FlowEventName.GoBack, goBackSpy);

      await flow.start(); // -> A
      await flow.next();  // -> B
      await flow.goBack();

      expect(goBackSpy).toHaveBeenCalledTimes(1);
      expect(goBackSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          node: expect.objectContaining({ name: 'A' }),
          wasReCreated: false,
        })
      );
      expect(adapter.popHistory).toHaveLength(1);
    });

    it('should re-push previous page (replace mode)', async () => {
      const { flow, adapter } = createFlow([
        page(1, 'A'),
        page(2, 'B'),
      ]);

      const goBackSpy = jest.fn();
      flow.events.on(FlowEventName.GoBack, goBackSpy);

      await flow.start();
      await flow.next();
      await flow.goBack();

      expect(goBackSpy).toHaveBeenCalledWith(
        expect.objectContaining({ wasReCreated: true })
      );
      // Should push A again (with __isGoBack flag)
      const lastPush = adapter.pushHistory[adapter.pushHistory.length - 1];
      expect(lastPush.pageName).toBe('A');
      expect(lastPush.propsData).toEqual(
        expect.objectContaining({ __isGoBack: true })
      );
    });

    it('should emit abort when going back from first node', async () => {
      const { flow } = createFlow([page(1, 'A')]);

      const abortSpy = jest.fn();
      flow.events.on(FlowEventName.Abort, abortSpy);

      await flow.start();
      await flow.goBack();

      expect(abortSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('abort', () => {
    it('should close all flow pages and emit abort', async () => {
      const { flow, adapter } = createFlow([page(1, 'A'), page(2, 'B')]);

      const abortSpy = jest.fn();
      flow.events.on(FlowEventName.Abort, abortSpy);

      await flow.start(); // -> A
      await flow.abort({ reason: 'user_cancel' });

      expect(abortSpy).toHaveBeenCalledTimes(1);
      expect(adapter.popHistory).toHaveLength(1);
      expect(adapter.popHistory[0].options?.count).toBe(1);
    });
  });

  describe('beforeEnter integration', () => {
    it('should skip nodes based on beforeEnter', async () => {
      const { flow, adapter } = createFlow([
        page(1, 'Skip', {
          beforeEnter: async () => ({ code: BeforeEnterCode.Skip }),
        }),
        page(2, 'Target'),
      ]);

      await flow.start();

      expect(adapter.pushHistory).toHaveLength(1);
      expect(adapter.pushHistory[0].pageName).toBe('Target');
    });

    it('should abort flow from beforeEnter', async () => {
      const { flow } = createFlow([
        page(1, 'Block', {
          beforeEnter: async () => ({
            code: BeforeEnterCode.Abort,
            reason: 'not_eligible',
          }),
        }),
      ]);

      const abortSpy = jest.fn();
      flow.events.on(FlowEventName.Abort, abortSpy);

      await flow.start();

      expect(abortSpy).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'not_eligible' })
      );
    });
  });

  describe('action nodes integration', () => {
    it('should auto-advance through action nodes', async () => {
      const { flow, adapter } = createFlow([
        {
          id: 1,
          name: 'Check',
          type: 'action' as const,
          execute: async () => ({ type: ActionResultType.Next }),
        },
        page(2, 'Target'),
      ]);

      await flow.start();

      // Only the page node should trigger navigation
      expect(adapter.pushHistory).toHaveLength(1);
      expect(adapter.pushHistory[0].pageName).toBe('Target');
    });
  });

  describe('popCount calculation', () => {
    it('should use popCount=0 for the first page', async () => {
      const { flow, adapter } = createFlow([page(1, 'A')]);
      await flow.start();
      expect(adapter.lastPush?.options?.popCount).toBe(0);
    });

    it('should use popCount=1 for non-transparent sequential pages', async () => {
      const { flow, adapter } = createFlow([page(1, 'A'), page(2, 'B')]);
      await flow.start();
      await flow.next();
      expect(adapter.pushHistory[1].options?.popCount).toBe(1);
    });

    it('should use popCount=0 for transparent pages', async () => {
      const { flow, adapter } = createFlow([
        page(1, 'A'),
        page(2, 'TransB', {
          presentation: { type: PresentationType.Transparent },
        }),
      ]);

      await flow.start();
      await flow.next();
      expect(adapter.pushHistory[1].options?.popCount).toBe(0);
    });

    it('should pop all stacked pages when followed by a replace page', async () => {
      const { flow, adapter } = createFlow([
        page(1, 'A'),
        page(2, 'TransB', {
          presentation: { type: PresentationType.Transparent },
        }),
        page(3, 'C'),
      ]);

      await flow.start();  // A: popCount=0
      await flow.next();   // TransB: popCount=0
      await flow.next();   // C: popCount=2 (A + TransB)

      expect(adapter.pushHistory[2].options?.popCount).toBe(2);
    });
  });

  describe('error handling', () => {
    it('should emit error event on beforeEnter exception', async () => {
      const { flow } = createFlow([
        page(1, 'Broken', {
          beforeEnter: async () => {
            throw new Error('API failed');
          },
        }),
      ]);

      const errorSpy = jest.fn();
      flow.events.on(FlowEventName.Error, errorSpy);

      await flow.start();

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'API failed' })
      );
    });

    it('should emit error event on action execute exception', async () => {
      const { flow } = createFlow([
        {
          id: 1,
          name: 'BrokenAction',
          type: 'action' as const,
          execute: async () => {
            throw new Error('execute failed');
          },
        },
      ]);

      const errorSpy = jest.fn();
      flow.events.on(FlowEventName.Error, errorSpy);

      await flow.start();
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('dispose', () => {
    it('should throw on operations after dispose', async () => {
      const { flow } = createFlow([page(1, 'A')]);
      flow.dispose();
      expect(flow.isDisposed).toBe(true);
      await expect(flow.start()).rejects.toThrow('has been disposed');
    });
  });

  describe('node cloning', () => {
    it('should not share references with original nodes', async () => {
      const originalNodes = [page(1, 'A', { data: { value: 1 } })];
      const { flow } = createFlow(originalNodes);

      await flow.start();

      // Mutate the original
      (originalNodes[0].data as any).value = 999;

      // Flow's internal copy should be unaffected
      expect(flow.currentNode?.data).toEqual({ value: 1 });
    });
  });
});
