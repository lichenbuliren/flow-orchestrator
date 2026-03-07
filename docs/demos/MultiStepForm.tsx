import React, { useCallback, useRef, useState } from 'react';
import { FlowEngine, FlowStatus, BeforeEnterCode, ActionResultType } from '@lichenbuliren/flow-orchestrator';
import type { FlowNode, TransitionResult } from '@lichenbuliren/flow-orchestrator';

interface FormMeta {
  name: string;
  email: string;
  plan: string;
  newsletter: boolean;
  submittedAt?: number;
  [key: string]: unknown;
}

const INITIAL_META: FormMeta = {
  name: '',
  email: '',
  plan: 'free',
  newsletter: false,
};

function createNodes(): FlowNode[] {
  return [
    { id: 'info', name: 'PersonalInfo', type: 'page' },
    {
      id: 'prefs',
      name: 'Preferences',
      type: 'page',
      beforeEnter: async (ctx) => {
        if (!ctx.meta.name || (ctx.meta.name as string).trim() === '') {
          return { code: BeforeEnterCode.Abort, reason: '请先填写姓名' };
        }
        return { code: BeforeEnterCode.Continue };
      },
    },
    {
      id: 'submit',
      name: 'SubmitData',
      type: 'action',
      execute: async () => {
        await new Promise((r) => setTimeout(r, 800));
        return { type: ActionResultType.Next, data: { submittedAt: Date.now() } };
      },
    },
    { id: 'confirm', name: 'Confirmation', type: 'page' },
  ];
}

const STEP_TITLES = ['个人信息', '偏好设置', '提交', '完成'];

export default function MultiStepFormDemo() {
  const engineRef = useRef<FlowEngine<FormMeta> | null>(null);
  const [currentNode, setCurrentNode] = useState<FlowNode | undefined>();
  const [status, setStatus] = useState<FlowStatus>(FlowStatus.Idle);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [meta, setMeta] = useState<FormMeta>({ ...INITIAL_META });
  const [logs, setLogs] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${time}] ${msg}`]);
  }, []);

  const getEngine = useCallback(() => {
    if (!engineRef.current) {
      engineRef.current = new FlowEngine<FormMeta>({
        flowId: 'form-demo',
        nodes: createNodes(),
        meta: { ...INITIAL_META },
      });
    }
    return engineRef.current;
  }, []);

  const syncState = useCallback(
    (engine: FlowEngine<FormMeta>, result: TransitionResult) => {
      setCurrentNode(engine.currentNode ? { ...engine.currentNode } : undefined);
      setStatus(engine.status);
      setCurrentIndex(engine.currentIndex);
      setMeta({ ...engine.flowContext.meta } as FormMeta);

      if (result.type === 'navigate' || result.type === 'navigate_back') {
        addLog(`${result.type} → ${result.node.name}`);
      } else if (result.type === 'abort') {
        addLog(`abort: ${result.reason ?? 'unknown'}`);
      } else {
        addLog(result.type);
      }
    },
    [addLog],
  );

  const saveMeta = useCallback(
    (partial: Partial<FormMeta>) => {
      const engine = engineRef.current;
      if (!engine) return;
      engine.flowContext.updateMeta(partial);
      setMeta({ ...engine.flowContext.meta } as FormMeta);
    },
    [],
  );

  const handleNext = useCallback(async () => {
    const engine = getEngine();
    const isAction = engine.currentIndex >= 0 &&
      engine.currentIndex < engine.getNodeCount() - 1 &&
      engine.getNodes()[engine.currentIndex + 1]?.type === 'action';
    if (isAction) setSubmitting(true);

    const result = await engine.moveForward();
    setSubmitting(false);
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
    setMeta({ ...INITIAL_META });
    setLogs([]);
    setSubmitting(false);
  }, []);

  const isIdle = status === FlowStatus.Idle;
  const isEnded = status === FlowStatus.Ended;
  const isAborted = status === FlowStatus.Aborted;
  const canBack = currentIndex > 0 && !isEnded && !isAborted;
  const nodeId = currentNode?.id as string | undefined;

  return (
    <div style={styles.container}>
      <div style={styles.main}>
        {/* Left: form area */}
        <div style={styles.formArea}>
          {/* Step indicator */}
          <div style={styles.stepBar}>
            {STEP_TITLES.map((title, i) => {
              const isActive = i === currentIndex;
              const isDone = i < currentIndex || isEnded;
              const isActionStep = i === 2;
              return (
                <div key={i} style={styles.stepItem}>
                  <div
                    style={{
                      ...styles.stepDot,
                      backgroundColor: isActive
                        ? '#4f46e5'
                        : isDone
                          ? '#10b981'
                          : '#e2e8f0',
                      transform: isActive ? 'scale(1.3)' : 'scale(1)',
                      boxShadow: isActive ? '0 0 0 4px rgba(79,70,229,0.15)' : 'none',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      color: isActive ? '#4f46e5' : isDone ? '#10b981' : '#94a3b8',
                      fontWeight: isActive ? 600 : 400,
                    }}
                  >
                    {title}
                    {isActionStep ? ' ⚡' : ''}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Page content */}
          <div style={styles.pageCard}>
            {isIdle && (
              <div style={styles.emptyState}>
                <div style={{ fontSize: 36 }}>📝</div>
                <div style={{ fontSize: 15, color: '#64748b' }}>
                  点击「开始」体验多步表单流程
                </div>
              </div>
            )}

            {nodeId === 'info' && (
              <div>
                <div style={styles.formTitle}>个人信息</div>
                <label style={styles.label}>
                  姓名 <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  style={styles.input}
                  placeholder="请输入姓名"
                  value={meta.name}
                  onChange={(e) => saveMeta({ name: e.target.value })}
                />
                <label style={styles.label}>邮箱</label>
                <input
                  style={styles.input}
                  placeholder="请输入邮箱"
                  type="email"
                  value={meta.email}
                  onChange={(e) => saveMeta({ email: e.target.value })}
                />
              </div>
            )}

            {nodeId === 'prefs' && (
              <div>
                <div style={styles.formTitle}>偏好设置</div>
                <label style={styles.label}>套餐方案</label>
                <div style={styles.radioGroup}>
                  {(['free', 'pro', 'enterprise'] as const).map((plan) => (
                    <label
                      key={plan}
                      style={{
                        ...styles.radioCard,
                        borderColor: meta.plan === plan ? '#4f46e5' : '#e2e8f0',
                        background: meta.plan === plan ? '#eef2ff' : '#fff',
                      }}
                    >
                      <input
                        type="radio"
                        name="plan"
                        checked={meta.plan === plan}
                        onChange={() => saveMeta({ plan })}
                        style={{ marginRight: 8 }}
                      />
                      {plan === 'free' && '免费版'}
                      {plan === 'pro' && 'Pro 版'}
                      {plan === 'enterprise' && '企业版'}
                    </label>
                  ))}
                </div>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={meta.newsletter}
                    onChange={(e) => saveMeta({ newsletter: e.target.checked })}
                    style={{ marginRight: 8 }}
                  />
                  订阅产品更新邮件
                </label>
              </div>
            )}

            {submitting && (
              <div style={styles.emptyState}>
                <div style={styles.spinner} />
                <div style={{ fontSize: 14, color: '#64748b', marginTop: 12 }}>
                  正在提交...
                </div>
              </div>
            )}

            {nodeId === 'confirm' && (
              <div>
                <div style={styles.formTitle}>提交成功 🎉</div>
                <div style={styles.summaryCard}>
                  <div style={styles.summaryRow}>
                    <span style={styles.summaryLabel}>姓名</span>
                    <span>{meta.name}</span>
                  </div>
                  <div style={styles.summaryRow}>
                    <span style={styles.summaryLabel}>邮箱</span>
                    <span>{meta.email || '—'}</span>
                  </div>
                  <div style={styles.summaryRow}>
                    <span style={styles.summaryLabel}>套餐</span>
                    <span>{meta.plan}</span>
                  </div>
                  <div style={styles.summaryRow}>
                    <span style={styles.summaryLabel}>订阅</span>
                    <span>{meta.newsletter ? '是' : '否'}</span>
                  </div>
                </div>
              </div>
            )}

            {isAborted && (
              <div style={styles.emptyState}>
                <div style={{ fontSize: 36 }}>⚠️</div>
                <div style={{ fontSize: 15, color: '#f59e0b', fontWeight: 600 }}>
                  流程中止
                </div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
                  {logs[logs.length - 1]}
                </div>
              </div>
            )}
          </div>

          {/* Buttons */}
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
                开始 ▶
              </button>
            ) : isEnded || isAborted ? (
              <button onClick={handleReset} style={{ ...styles.btn, ...styles.btnWarning }}>
                ↺ 重置
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={submitting}
                style={{
                  ...styles.btn,
                  ...styles.btnPrimary,
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                {submitting ? '提交中...' : '下一步 ▶'}
              </button>
            )}
          </div>
        </div>

        {/* Right: context panel */}
        <div style={styles.contextPanel}>
          <div style={styles.panelTitle}>FlowContext Meta</div>
          <pre style={styles.contextPre}>
            {JSON.stringify(meta, null, 2)}
          </pre>

          {logs.length > 0 && (
            <>
              <div style={{ ...styles.panelTitle, marginTop: 16 }}>事件日志</div>
              <div style={styles.logContent}>
                {logs.map((log, i) => (
                  <div key={i} style={styles.logLine}>
                    {log}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    maxWidth: 820,
    margin: '0 auto',
  },
  main: {
    display: 'flex',
    gap: 20,
    alignItems: 'flex-start',
  },
  formArea: {
    flex: 1,
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    padding: 24,
    minWidth: 0,
  },
  contextPanel: {
    width: 240,
    flexShrink: 0,
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    padding: 16,
  },
  stepBar: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  stepItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    transition: 'all 0.25s ease',
  },
  pageCard: {
    background: '#fafbfc',
    borderRadius: 10,
    padding: 24,
    minHeight: 200,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    border: '1px solid #f1f5f9',
    marginBottom: 16,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '20px 0',
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#1e293b',
    marginBottom: 16,
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#475569',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.2s',
  },
  radioGroup: {
    display: 'flex',
    gap: 10,
    marginTop: 4,
  },
  radioCard: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    padding: '10px 12px',
    borderRadius: 8,
    border: '2px solid',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    transition: 'all 0.2s',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    fontSize: 13,
    color: '#475569',
    marginTop: 16,
    cursor: 'pointer',
  },
  summaryCard: {
    background: '#fff',
    borderRadius: 8,
    padding: 16,
    border: '1px solid #e2e8f0',
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #f1f5f9',
    fontSize: 14,
  },
  summaryLabel: {
    color: '#94a3b8',
    fontWeight: 500,
  },
  buttonRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 12,
  },
  btn: {
    padding: '10px 24px',
    borderRadius: 8,
    border: 'none',
    fontSize: 14,
    fontWeight: 600,
    transition: 'all 0.2s ease',
    cursor: 'pointer',
  },
  btnPrimary: {
    background: '#4f46e5',
    color: '#fff',
  },
  btnSecondary: {
    background: '#f1f5f9',
    color: '#475569',
    border: '1px solid #e2e8f0',
  },
  btnWarning: {
    background: '#f59e0b',
    color: '#fff',
  },
  panelTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  contextPre: {
    background: '#1e293b',
    color: '#a5f3fc',
    borderRadius: 8,
    padding: 12,
    fontSize: 12,
    fontFamily: '"SF Mono", Monaco, Consolas, monospace',
    lineHeight: 1.6,
    margin: 0,
    overflowX: 'auto' as const,
    whiteSpace: 'pre-wrap' as const,
  },
  logContent: {
    background: '#1e293b',
    borderRadius: 8,
    padding: '8px 12px',
    maxHeight: 160,
    overflowY: 'auto' as const,
  },
  logLine: {
    fontSize: 11,
    fontFamily: '"SF Mono", Monaco, Consolas, monospace',
    color: '#a5f3fc',
    lineHeight: 1.7,
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid #e2e8f0',
    borderTopColor: '#4f46e5',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
};
