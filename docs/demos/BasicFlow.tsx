import React, { useCallback, useRef, useState } from 'react';
import { FlowEngine, FlowStatus, type FlowNode, type TransitionResult } from '@lichenbuliren/flow-orchestrator';

interface StepInfo {
  title: string;
  desc: string;
  icon: string;
}

const STEP_MAP: Record<string, StepInfo> = {
  welcome: {
    title: '欢迎',
    desc: '欢迎体验 flow-orchestrator 流程引擎。这是一个高内聚、低耦合的多步骤流程编排库，适用于注册引导、KYC 验证、多步表单等场景。',
    icon: '👋',
  },
  features: {
    title: '核心功能',
    desc: 'flow-orchestrator 支持两种节点类型（page / action），提供 beforeEnter 前置钩子、onLeave 离开钩子、FlowContext 上下文共享、中间件管道等能力。',
    icon: '⚡',
  },
  complete: {
    title: '流程完成',
    desc: '你已完成基础流程演示！在实际应用中，每个 page 节点对应一个独立页面，FlowEngine 负责驱动状态流转，NavigationController 负责页面跳转。',
    icon: '🎉',
  },
};

const NODES: FlowNode[] = [
  { id: 'welcome', name: 'Welcome', type: 'page' },
  { id: 'features', name: 'Features', type: 'page' },
  { id: 'complete', name: 'Complete', type: 'page' },
];

const STATUS_LABELS: Record<string, string> = {
  [FlowStatus.Idle]: '未开始',
  [FlowStatus.Running]: '进行中',
  [FlowStatus.Ended]: '已结束',
  [FlowStatus.Aborted]: '已中止',
  [FlowStatus.Error]: '错误',
};

const STATUS_COLORS: Record<string, string> = {
  [FlowStatus.Idle]: '#94a3b8',
  [FlowStatus.Running]: '#3b82f6',
  [FlowStatus.Ended]: '#10b981',
  [FlowStatus.Aborted]: '#f59e0b',
  [FlowStatus.Error]: '#ef4444',
};

export default function BasicFlowDemo() {
  const engineRef = useRef<FlowEngine | null>(null);
  const [currentNode, setCurrentNode] = useState<FlowNode | undefined>();
  const [status, setStatus] = useState<FlowStatus>(FlowStatus.Idle);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${time}] ${msg}`]);
  }, []);

  const getEngine = useCallback(() => {
    if (!engineRef.current) {
      engineRef.current = new FlowEngine({
        flowId: 'basic-demo',
        nodes: NODES.map((n) => ({ ...n })),
        meta: {},
      });
    }
    return engineRef.current;
  }, []);

  const syncState = useCallback(
    (engine: FlowEngine, result: TransitionResult) => {
      setCurrentNode(engine.currentNode ? { ...engine.currentNode } : undefined);
      setStatus(engine.status);
      setCurrentIndex(engine.currentIndex);

      if (result.type === 'navigate' || result.type === 'navigate_back') {
        addLog(`${result.type} → ${result.node.name}`);
      } else {
        addLog(result.type);
      }
    },
    [addLog],
  );

  const handleNext = useCallback(async () => {
    const engine = getEngine();
    const result = await engine.moveForward();
    syncState(engine, result);
  }, [getEngine, syncState]);

  const handleBack = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const result = engine.moveBackward();
    syncState(engine, result);
  }, [syncState]);

  const handleReset = useCallback(() => {
    engineRef.current = null;
    setCurrentNode(undefined);
    setStatus(FlowStatus.Idle);
    setCurrentIndex(-1);
    setLogs([]);
  }, []);

  const isIdle = status === FlowStatus.Idle;
  const isEnded = status === FlowStatus.Ended;
  const canBack = currentIndex > 0 && !isEnded;
  const stepInfo = currentNode ? STEP_MAP[currentNode.id as string] : null;

  return (
    <div style={styles.container}>
      {/* Step indicator */}
      <div style={styles.stepBar}>
        {NODES.map((node, i) => {
          const isActive = i === currentIndex;
          const isDone = i < currentIndex || isEnded;
          return (
            <React.Fragment key={node.id}>
              {i > 0 && (
                <div
                  style={{
                    ...styles.stepLine,
                    backgroundColor: isDone || isActive ? '#3b82f6' : '#e2e8f0',
                  }}
                />
              )}
              <div style={styles.stepItem}>
                <div
                  style={{
                    ...styles.stepCircle,
                    backgroundColor: isActive ? '#3b82f6' : isDone ? '#10b981' : '#e2e8f0',
                    color: isActive || isDone ? '#fff' : '#94a3b8',
                    transform: isActive ? 'scale(1.15)' : 'scale(1)',
                    boxShadow: isActive ? '0 0 0 4px rgba(59,130,246,0.2)' : 'none',
                  }}
                >
                  {isDone ? '✓' : i + 1}
                </div>
                <div
                  style={{
                    ...styles.stepLabel,
                    color: isActive ? '#1e293b' : '#94a3b8',
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {STEP_MAP[node.id as string]?.title}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Page content */}
      <div style={styles.pageCard}>
        {stepInfo ? (
          <>
            <div style={styles.pageIcon}>{stepInfo.icon}</div>
            <div style={styles.pageTitle}>{stepInfo.title}</div>
            <div style={styles.pageDesc}>{stepInfo.desc}</div>
          </>
        ) : (
          <div style={styles.pageEmpty}>
            {isEnded ? '流程已结束，点击「重置」重新开始' : '点击「开始流程」启动演示'}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div style={styles.statusBar}>
        <span>
          状态：
          <span style={{ color: STATUS_COLORS[status], fontWeight: 600 }}>
            {STATUS_LABELS[status]}
          </span>
        </span>
        <span>节点：{currentNode?.name ?? '—'}</span>
        <span>
          进度：{Math.max(0, currentIndex + 1)} / {NODES.length}
        </span>
      </div>

      {/* Control buttons */}
      <div style={styles.buttonRow}>
        <button
          onClick={handleBack}
          disabled={!canBack}
          style={{
            ...styles.btn,
            ...styles.btnSecondary,
            opacity: canBack ? 1 : 0.4,
            cursor: canBack ? 'pointer' : 'not-allowed',
          }}
        >
          ◀ 上一步
        </button>
        {isIdle ? (
          <button onClick={handleNext} style={{ ...styles.btn, ...styles.btnPrimary }}>
            开始流程 ▶
          </button>
        ) : isEnded ? (
          <button onClick={handleReset} style={{ ...styles.btn, ...styles.btnWarning }}>
            ↺ 重置
          </button>
        ) : (
          <button onClick={handleNext} style={{ ...styles.btn, ...styles.btnPrimary }}>
            下一步 ▶
          </button>
        )}
      </div>

      {/* Event log */}
      {logs.length > 0 && (
        <div style={styles.logSection}>
          <div style={styles.logTitle}>事件日志</div>
          <div style={styles.logContent}>
            {logs.map((log, i) => (
              <div key={i} style={styles.logLine}>
                {log}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    maxWidth: 600,
    margin: '0 auto',
    padding: 24,
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #e2e8f0',
  },
  stepBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    gap: 0,
  },
  stepItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    minWidth: 70,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 600,
    transition: 'all 0.25s ease',
  },
  stepLine: {
    flex: 1,
    height: 2,
    minWidth: 40,
    maxWidth: 80,
    transition: 'background-color 0.25s ease',
    marginBottom: 24,
  },
  stepLabel: {
    fontSize: 12,
    transition: 'all 0.2s ease',
  },
  pageCard: {
    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
    borderRadius: 10,
    padding: '32px 24px',
    textAlign: 'center' as const,
    minHeight: 140,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
    border: '1px solid #e2e8f0',
  },
  pageIcon: {
    fontSize: 40,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: '#1e293b',
  },
  pageDesc: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 1.6,
    maxWidth: 460,
  },
  pageEmpty: {
    fontSize: 14,
    color: '#94a3b8',
  },
  statusBar: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 13,
    color: '#64748b',
    padding: '8px 4px',
    marginBottom: 12,
  },
  buttonRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 8,
  },
  btn: {
    padding: '10px 24px',
    borderRadius: 8,
    border: 'none',
    fontSize: 14,
    fontWeight: 600,
    transition: 'all 0.2s ease',
  },
  btnPrimary: {
    background: '#3b82f6',
    color: '#fff',
    cursor: 'pointer',
  },
  btnSecondary: {
    background: '#f1f5f9',
    color: '#475569',
    border: '1px solid #e2e8f0',
  },
  btnWarning: {
    background: '#f59e0b',
    color: '#fff',
    cursor: 'pointer',
  },
  logSection: {
    marginTop: 16,
    borderRadius: 8,
    overflow: 'hidden',
    border: '1px solid #e2e8f0',
  },
  logTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: '#64748b',
    padding: '8px 12px',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
  },
  logContent: {
    background: '#1e293b',
    padding: '10px 14px',
    maxHeight: 120,
    overflowY: 'auto' as const,
  },
  logLine: {
    fontSize: 12,
    fontFamily: '"SF Mono", Monaco, Consolas, monospace',
    color: '#a5f3fc',
    lineHeight: 1.7,
  },
};
