import { FlowEngine } from '../core/FlowEngine';
import {
  ActionResultType,
  BeforeEnterCode,
  FlowStatus,
  type FlowNode,
} from '../interfaces';

function createPageNode(
  id: number,
  name: string,
  overrides?: Partial<FlowNode>
): FlowNode {
  return { id, name, type: 'page', ...overrides };
}

function createActionNode(
  id: number,
  name: string,
  execute: FlowNode['execute'],
  overrides?: Partial<FlowNode>
): FlowNode {
  return { id, name, type: 'action', execute, ...overrides };
}

describe('FlowEngine', () => {
  describe('moveForward', () => {
    it('should navigate through page nodes sequentially', async () => {
      const engine = new FlowEngine({
        flowId: 'test',
        nodes: [
          createPageNode(1, 'PageA'),
          createPageNode(2, 'PageB'),
          createPageNode(3, 'PageC'),
        ],
        meta: {},
      });

      const r1 = await engine.moveForward();
      expect(r1.type).toBe('navigate');
      if (r1.type === 'navigate') {
        expect(r1.node.name).toBe('PageA');
      }
      expect(engine.currentIndex).toBe(0);

      const r2 = await engine.moveForward();
      expect(r2.type).toBe('navigate');
      if (r2.type === 'navigate') {
        expect(r2.node.name).toBe('PageB');
      }

      const r3 = await engine.moveForward();
      expect(r3.type).toBe('navigate');
      if (r3.type === 'navigate') {
        expect(r3.node.name).toBe('PageC');
      }

      const r4 = await engine.moveForward();
      expect(r4.type).toBe('end');
      expect(engine.status).toBe(FlowStatus.Ended);
    });

    it('should return end when no nodes exist', async () => {
      const engine = new FlowEngine({ flowId: 'test', nodes: [], meta: {} });
      const result = await engine.moveForward();
      expect(result.type).toBe('end');
    });

    it('should pass data through transitions', async () => {
      const engine = new FlowEngine({
        flowId: 'test',
        nodes: [createPageNode(1, 'A')],
        meta: {},
      });

      const result = await engine.moveForward({ key: 'value' });
      expect(result.type).toBe('navigate');
      if (result.type === 'navigate') {
        expect(result.data).toEqual({ key: 'value' });
      }
    });

    it('should track history', async () => {
      const engine = new FlowEngine({
        flowId: 'test',
        nodes: [createPageNode(1, 'A'), createPageNode(2, 'B')],
        meta: {},
      });

      await engine.moveForward();
      await engine.moveForward();

      expect(engine.history).toHaveLength(2);
      expect(engine.history[0].name).toBe('A');
      expect(engine.history[1].name).toBe('B');
    });
  });

  describe('beforeEnter', () => {
    it('should skip node when beforeEnter returns Skip', async () => {
      const engine = new FlowEngine({
        flowId: 'test',
        nodes: [
          createPageNode(1, 'Skippable', {
            beforeEnter: async () => ({ code: BeforeEnterCode.Skip }),
          }),
          createPageNode(2, 'Target'),
        ],
        meta: {},
      });

      const result = await engine.moveForward();
      expect(result.type).toBe('navigate');
      if (result.type === 'navigate') {
        expect(result.node.name).toBe('Target');
      }
      expect(engine.currentIndex).toBe(1);
    });

    it('should abort flow when beforeEnter returns Abort', async () => {
      const engine = new FlowEngine({
        flowId: 'test',
        nodes: [
          createPageNode(1, 'Blocker', {
            beforeEnter: async () => ({
              code: BeforeEnterCode.Abort,
              reason: 'not_eligible',
            }),
          }),
          createPageNode(2, 'Unreachable'),
        ],
        meta: {},
      });

      const result = await engine.moveForward();
      expect(result.type).toBe('abort');
      if (result.type === 'abort') {
        expect(result.reason).toBe('not_eligible');
      }
      expect(engine.status).toBe(FlowStatus.Aborted);
    });

    it('should continue normally when beforeEnter returns Continue', async () => {
      const engine = new FlowEngine({
        flowId: 'test',
        nodes: [
          createPageNode(1, 'Normal', {
            beforeEnter: async () => ({ code: BeforeEnterCode.Continue }),
          }),
        ],
        meta: {},
      });

      const result = await engine.moveForward();
      expect(result.type).toBe('navigate');
      if (result.type === 'navigate') {
        expect(result.node.name).toBe('Normal');
      }
    });

    it('should skip multiple consecutive nodes', async () => {
      const engine = new FlowEngine({
        flowId: 'test',
        nodes: [
          createPageNode(1, 'Skip1', {
            beforeEnter: async () => ({ code: BeforeEnterCode.Skip }),
          }),
          createPageNode(2, 'Skip2', {
            beforeEnter: async () => ({ code: BeforeEnterCode.Skip }),
          }),
          createPageNode(3, 'Target'),
        ],
        meta: {},
      });

      const result = await engine.moveForward();
      expect(result.type).toBe('navigate');
      if (result.type === 'navigate') {
        expect(result.node.name).toBe('Target');
      }
    });

    it('should end flow when all nodes are skipped', async () => {
      const engine = new FlowEngine({
        flowId: 'test',
        nodes: [
          createPageNode(1, 'Skip1', {
            beforeEnter: async () => ({ code: BeforeEnterCode.Skip }),
          }),
        ],
        meta: {},
      });

      const result = await engine.moveForward();
      expect(result.type).toBe('end');
    });
  });

  describe('action nodes', () => {
    it('should auto-advance through action nodes', async () => {
      const engine = new FlowEngine({
        flowId: 'test',
        nodes: [
          createActionNode(1, 'Check', async () => ({
            type: ActionResultType.Next,
            data: { checked: true },
          })),
          createPageNode(2, 'Target'),
        ],
        meta: {},
      });

      const result = await engine.moveForward();
      expect(result.type).toBe('navigate');
      if (result.type === 'navigate') {
        expect(result.node.name).toBe('Target');
        expect(result.data).toEqual({ checked: true });
      }
    });

    it('should abort when action node returns Abort', async () => {
      const engine = new FlowEngine({
        flowId: 'test',
        nodes: [
          createActionNode(1, 'FailCheck', async () => ({
            type: ActionResultType.Abort,
            reason: 'api_error',
          })),
          createPageNode(2, 'Unreachable'),
        ],
        meta: {},
      });

      const result = await engine.moveForward();
      expect(result.type).toBe('abort');
      if (result.type === 'abort') {
        expect(result.reason).toBe('api_error');
      }
    });

    it('should chain multiple action nodes', async () => {
      const calls: string[] = [];

      const engine = new FlowEngine({
        flowId: 'test',
        nodes: [
          createActionNode(1, 'Action1', async () => {
            calls.push('action1');
            return { type: ActionResultType.Next };
          }),
          createActionNode(2, 'Action2', async () => {
            calls.push('action2');
            return { type: ActionResultType.Next };
          }),
          createPageNode(3, 'Target'),
        ],
        meta: {},
      });

      const result = await engine.moveForward();
      expect(result.type).toBe('navigate');
      if (result.type === 'navigate') {
        expect(result.node.name).toBe('Target');
      }
      expect(calls).toEqual(['action1', 'action2']);
    });

    it('should throw when action node has no execute function', async () => {
      const engine = new FlowEngine({
        flowId: 'test',
        nodes: [{ id: 1, name: 'Broken', type: 'action' }],
        meta: {},
      });

      await expect(engine.moveForward()).rejects.toThrow(
        'must provide an execute()'
      );
    });
  });

  describe('moveBackward', () => {
    it('should move back to the previous page node', async () => {
      const engine = new FlowEngine({
        flowId: 'test',
        nodes: [
          createPageNode(1, 'PageA'),
          createPageNode(2, 'PageB'),
        ],
        meta: {},
      });

      await engine.moveForward(); // -> PageA
      await engine.moveForward(); // -> PageB

      const result = engine.moveBackward();
      expect(result.type).toBe('navigate_back');
      if (result.type === 'navigate_back') {
        expect(result.node.name).toBe('PageA');
      }
      expect(engine.currentIndex).toBe(0);
    });

    it('should skip action nodes when moving backward', async () => {
      const engine = new FlowEngine({
        flowId: 'test',
        nodes: [
          createPageNode(1, 'PageA'),
          createActionNode(2, 'Check', async () => ({
            type: ActionResultType.Next,
          })),
          createPageNode(3, 'PageB'),
        ],
        meta: {},
      });

      await engine.moveForward(); // -> PageA
      await engine.moveForward(); // -> Check -> auto -> PageB

      const result = engine.moveBackward();
      expect(result.type).toBe('navigate_back');
      if (result.type === 'navigate_back') {
        expect(result.node.name).toBe('PageA');
      }
    });

    it('should return exit when at the first page node', async () => {
      const engine = new FlowEngine({
        flowId: 'test',
        nodes: [createPageNode(1, 'PageA')],
        meta: {},
      });

      await engine.moveForward(); // -> PageA

      const result = engine.moveBackward();
      expect(result.type).toBe('exit');
    });

    it('should update history on backward movement', async () => {
      const engine = new FlowEngine({
        flowId: 'test',
        nodes: [
          createPageNode(1, 'A'),
          createPageNode(2, 'B'),
        ],
        meta: {},
      });

      await engine.moveForward();
      await engine.moveForward();
      expect(engine.history).toHaveLength(2);

      engine.moveBackward();
      expect(engine.history).toHaveLength(1);
      expect(engine.history[0].name).toBe('A');
    });
  });

  describe('onLeave', () => {
    it('should call onLeave with correct direction when moving forward', async () => {
      const onLeave = jest.fn();

      const engine = new FlowEngine({
        flowId: 'test',
        nodes: [
          createPageNode(1, 'A', { onLeave }),
          createPageNode(2, 'B'),
        ],
        meta: {},
      });

      await engine.moveForward(); // -> A
      await engine.moveForward(); // leave A -> B

      expect(onLeave).toHaveBeenCalledTimes(1);
      expect(onLeave).toHaveBeenCalledWith(
        expect.objectContaining({ currentIndex: 0 }),
        'forward'
      );
    });

    it('should call onLeave with backward direction when going back', async () => {
      const onLeaveB = jest.fn();

      const engine = new FlowEngine({
        flowId: 'test',
        nodes: [
          createPageNode(1, 'A'),
          createPageNode(2, 'B', { onLeave: onLeaveB }),
        ],
        meta: {},
      });

      await engine.moveForward(); // -> A
      await engine.moveForward(); // -> B
      engine.moveBackward(); // B -> A

      expect(onLeaveB).toHaveBeenCalledWith(
        expect.objectContaining({ currentIndex: 1 }),
        'backward'
      );
    });
  });

  describe('FlowContext integration', () => {
    it('should provide meta to node context', async () => {
      let capturedMeta: unknown;

      const engine = new FlowEngine({
        flowId: 'test',
        nodes: [
          createPageNode(1, 'A', {
            beforeEnter: async (ctx) => {
              capturedMeta = ctx.meta;
              return { code: BeforeEnterCode.Continue };
            },
          }),
        ],
        meta: { source: 'home', userId: 123 },
      });

      await engine.moveForward();
      expect(capturedMeta).toEqual({ source: 'home', userId: 123 });
    });

    it('should allow updating meta from node context', async () => {
      const engine = new FlowEngine({
        flowId: 'test',
        nodes: [
          createActionNode(1, 'UpdateMeta', async (ctx) => {
            ctx.updateMeta({ token: 'abc' });
            return { type: ActionResultType.Next };
          }),
          createPageNode(2, 'ReadMeta', {
            beforeEnter: async (ctx) => {
              expect((ctx.meta as any).token).toBe('abc');
              return { code: BeforeEnterCode.Continue };
            },
          }),
        ],
        meta: { source: 'test' },
      });

      await engine.moveForward();
    });

    it('should support shared state between nodes', async () => {
      const engine = new FlowEngine({
        flowId: 'test',
        nodes: [
          createActionNode(1, 'Write', async (ctx) => {
            ctx.set('result', { status: 'ok' });
            return { type: ActionResultType.Next };
          }),
          createPageNode(2, 'Read', {
            beforeEnter: async (ctx) => {
              const result = ctx.get<{ status: string }>('result');
              expect(result?.status).toBe('ok');
              return { code: BeforeEnterCode.Continue };
            },
          }),
        ],
        meta: {},
      });

      await engine.moveForward();
    });
  });

  describe('dynamic mutation', () => {
    it('should insert a node after the specified index', async () => {
      const engine = new FlowEngine({
        flowId: 'test',
        nodes: [
          createPageNode(1, 'A'),
          createPageNode(3, 'C'),
        ],
        meta: {},
      });

      await engine.moveForward(); // -> A (index 0)

      const success = engine.insertNodeAfter(0, createPageNode(2, 'B'));
      expect(success).toBe(true);
      expect(engine.getNodeCount()).toBe(3);

      const result = await engine.moveForward();
      expect(result.type).toBe('navigate');
      if (result.type === 'navigate') {
        expect(result.node.name).toBe('B');
      }
    });

    it('should not insert before or at current index', async () => {
      const engine = new FlowEngine({
        flowId: 'test',
        nodes: [
          createPageNode(1, 'A'),
          createPageNode(2, 'B'),
        ],
        meta: {},
      });

      await engine.moveForward(); // index 0
      const success = engine.insertNodeAfter(-1, createPageNode(99, 'X'));
      expect(success).toBe(false);
    });

    it('should remove a future node', async () => {
      const engine = new FlowEngine({
        flowId: 'test',
        nodes: [
          createPageNode(1, 'A'),
          createPageNode(2, 'B'),
          createPageNode(3, 'C'),
        ],
        meta: {},
      });

      await engine.moveForward(); // -> A
      const success = engine.removeNode(2); // remove B
      expect(success).toBe(true);

      const result = await engine.moveForward();
      if (result.type === 'navigate') {
        expect(result.node.name).toBe('C');
      }
    });

    it('should not remove the current or past node', async () => {
      const engine = new FlowEngine({
        flowId: 'test',
        nodes: [createPageNode(1, 'A'), createPageNode(2, 'B')],
        meta: {},
      });

      await engine.moveForward(); // -> A (index 0)
      expect(engine.removeNode(1)).toBe(false);
    });
  });
});
