/**
 * 第 1 階段：密碼工具測試（僅開發診斷頁，route /dev/crypto）。
 *
 * 固定聲明（不可移除）：
 * - 「僅測試本機密碼元件。尚未建立 E2EE 聊天 session。」
 * - 本次為短暫測試金鑰，不是正式帳號身分金鑰。
 *
 * 資料來源規則：所有結果都來自本機 Python bridge 的真實執行；
 * 沒有 MSW mock、沒有 setTimeout 假 PASS。bridge 不存在時如實顯示
 * 「不可用」並停用測試按鈕。本頁不寫入 localStorage，重新開啟後
 * 一律顯示「尚未執行」，不從快取恢復舊結果。
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FlaskConical, Loader2, ShieldQuestion } from 'lucide-react';
import {
  BridgeTimeoutError,
  callHealthCheck,
  callRunFeasibilityChecks,
  isBusyResponse,
  isDiagnosticsMode,
  waitForBridge,
} from '../bridge/desktop';
import type {
  CheckStatus,
  FeasibilityReport,
  HealthInfo,
  OverallStatus,
  PqcGroupResult,
  SimpleGroupResult,
} from '../types/crypto';
import styles from './CryptoDiagnostics.module.css';

type BridgeState = 'checking' | 'ready' | 'unavailable';

const STATUS_LABELS: Record<CheckStatus | OverallStatus, string> = {
  not_run: '未執行',
  running: '執行中',
  passed: '通過',
  failed: '失敗',
  blocked: '受阻',
  partial: '部分',
};

const CHECK_LABELS: Record<string, string> = {
  keygen: '金鑰生成',
  secret_equality: 'Shared-secret equality（封裝／解封裝一致）',
  ciphertext_length: 'Ciphertext 長度',
  malformed_ciphertext_rejected: '錯誤長度 ciphertext 拒絕',
  sign_verify_correct: '正確簽章驗證',
  modified_message_rejected: '修改訊息後拒絕',
  wrong_key_rejected: '錯誤公鑰／key 拒絕',
  signature_length: 'Signature 長度',
  deterministic_same_inputs: '相同輸入（新 instance）派生一致',
  context_separation: '不同 context 派生不同結果',
  roundtrip: '正常加解密還原（byte-for-byte）',
  tampered_ciphertext_rejected: '修改密文／tag 拒絕',
  wrong_nonce_rejected: '錯誤 nonce 拒絕',
  wrong_aad_rejected: '錯誤 AAD 拒絕',
};

const GROUP_TITLES: Record<string, string> = {
  ml_kem: 'ML-KEM（金鑰封裝）',
  ml_dsa: 'ML-DSA（數位簽章）',
  hkdf: 'HKDF-SHA-256（金鑰派生）',
  aes_gcm: 'AES-256-GCM（對稱加密）',
};

function StatusBadge({ status }: { status: CheckStatus | OverallStatus }) {
  const variant =
    status === 'passed'
      ? styles.badgePassed
      : status === 'failed'
        ? styles.badgeFailed
        : status === 'blocked'
          ? styles.badgeBlocked
          : status === 'running'
            ? styles.badgeRunning
            : styles.badgeIdle;
  return (
    <span className={`${styles.badge} ${variant}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function CheckList({ checks }: { checks: Record<string, { status: CheckStatus; note: string | null }> }) {
  return (
    <ul className={styles.checks}>
      {Object.entries(checks).map(([name, check]) => (
        <li key={name} className={styles.checkRow}>
          <span className={styles.checkName}>{CHECK_LABELS[name] ?? name}</span>
          <span className={styles.checkRight}>
            {check.note && <span className={styles.checkNote}>{check.note}</span>}
            <StatusBadge status={check.status} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function PqcCard({ title, group }: { title: string; group: PqcGroupResult }) {
  return (
    <section className={styles.card}>
      <header className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>
          {title}
          {group.algorithm && <span className={styles.algo}>{group.algorithm}</span>}
        </h3>
        <StatusBadge status={group.status} />
      </header>
      <div className={styles.meta}>
        {group.public_key_bytes !== null && (
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>公鑰長度</span>
            <span className={styles.metaValue}>{group.public_key_bytes} bytes</span>
          </div>
        )}
        {group.ciphertext_bytes !== null && (
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>Ciphertext 長度</span>
            <span className={styles.metaValue}>{group.ciphertext_bytes} bytes</span>
          </div>
        )}
        {group.signature_bytes !== null && (
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>Signature 長度</span>
            <span className={styles.metaValue}>{group.signature_bytes} bytes</span>
          </div>
        )}
        <div className={styles.metaRow}>
          <span className={styles.metaLabel}>公鑰 SHA-256 指紋</span>
          <span className={`${styles.metaValue} ${styles.fingerprint}`}>
            {group.public_key_fingerprint_sha256 ?? '—（未執行或受阻）'}
          </span>
        </div>
      </div>
      <CheckList checks={group.checks} />
      {group.note && <p className={styles.groupNote}>{group.note}</p>}
    </section>
  );
}

function SimpleCard({ title, group }: { title: string; group: SimpleGroupResult }) {
  return (
    <section className={styles.card}>
      <header className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>{title}</h3>
        <StatusBadge status={group.status} />
      </header>
      <CheckList checks={group.checks} />
      {group.note && <p className={styles.groupNote}>{group.note}</p>}
    </section>
  );
}

export function CryptoDiagnostics() {
  // Constant per mount: lazy useState initializer (not a ref).
  const [diagnosticsMode] = useState(isDiagnosticsMode);
  const apiRef = useRef<Awaited<ReturnType<typeof waitForBridge>> | null>(null);
  const [bridgeState, setBridgeState] = useState<BridgeState>(
    diagnosticsMode ? 'checking' : 'unavailable',
  );
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [report, setReport] = useState<FeasibilityReport | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [busyNotice, setBusyNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!diagnosticsMode) return;
    let cancelled = false;
    waitForBridge()
      .then((api) => {
        if (cancelled) return;
        apiRef.current = api;
        setBridgeState('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setBridgeState('unavailable');
        setBridgeError(
          error instanceof BridgeTimeoutError
            ? '等待本機 Python bridge 逾時（pywebviewready 未在限期內觸發）'
            : error instanceof Error
              ? error.message
              : '未知錯誤',
        );
      });
    return () => {
      cancelled = true;
    };
  }, [diagnosticsMode]);

  const bridgeReady = bridgeState === 'ready';

  async function handleHealth() {
    const api = apiRef.current;
    if (!api) return;
    setHealthLoading(true);
    setHealthError(null);
    try {
      setHealth(await callHealthCheck(api));
    } catch (error) {
      setHealth(null);
      setHealthError(error instanceof Error ? error.message : '檢查環境失敗');
    } finally {
      setHealthLoading(false);
    }
  }

  async function handleRun() {
    const api = apiRef.current;
    if (!api || running) return;
    setRunning(true);
    setRunError(null);
    setBusyNotice(null);
    setReport(null); // 新 run：舊結果立即清空，不得殘留舊的綠色結果
    try {
      const result = await callRunFeasibilityChecks(api);
      if (isBusyResponse(result)) {
        setBusyNotice(
          `Python 端已有一個測試 suite 執行中（busy）；本次請求沒有重複執行。${result.detail ? `（${result.detail}）` : ''}`,
        );
      } else {
        setReport(result);
      }
    } catch (error) {
      setRunError(error instanceof Error ? error.message : '測試執行失敗');
    } finally {
      setRunning(false);
    }
  }

  function handleClear() {
    // 僅清除「畫面」上的結果與訊息；不聲稱任何安全抹除
    setHealth(null);
    setHealthError(null);
    setReport(null);
    setRunError(null);
    setBusyNotice(null);
  }

  const sourceLabel = !diagnosticsMode
    ? '一般瀏覽器（?diagnostics=1 未設定），bridge 不可用'
    : bridgeState === 'ready'
      ? '本機 Python bridge（診斷模式）'
      : bridgeState === 'checking'
        ? '正在偵測本機 Python bridge…'
        : '偵測不到本機 Python bridge（不可用）';

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Link to="/" className={styles.backLink}>
          ← 返回首頁
        </Link>

        <header className={styles.header}>
          <h1 className={styles.title}>
            <FlaskConical size={26} aria-hidden="true" /> 第 1 階段：密碼工具測試
          </h1>
          <p className={styles.fixedNotice}>
            僅測試本機密碼元件。<strong>尚未建立 E2EE 聊天 session。</strong>
          </p>
          <p className={styles.fixedNoticeMuted}>
            本次為短暫測試金鑰，不是正式帳戶身分金鑰；結果只代表本機元件可行性。
          </p>
        </header>

        <div
          className={`${styles.sourceStrip} ${bridgeReady ? styles.sourceOk : styles.sourceBad}`}
          role="status"
        >
          <span className={styles.sourceLabel}>執行來源：{sourceLabel}</span>
          <span className={styles.sourceSub}>
            結果來源：本機真實測試（非 MSW／非 mock）
          </span>
        </div>

        {bridgeState === 'unavailable' && (
          <div className={styles.warnBanner}>
            <ShieldQuestion size={18} aria-hidden="true" />
            <div>
              <p className={styles.warnTitle}>測試功能不可用</p>
              <p className={styles.warnText}>
                {diagnosticsMode
                  ? bridgeError ?? 'bridge 不可用；測試按鈕已停用，不會以假結果代替。'
                  : '此頁在一般瀏覽器開啟時沒有本機 Python bridge；測試按鈕已停用。請以診斷模式啟動 desktop 視窗（python -m pqpm_client --diagnostics）使用本頁。'}
              </p>
            </div>
          </div>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={handleHealth}
            disabled={!bridgeReady || healthLoading || running}
          >
            {healthLoading && <Loader2 size={16} className={styles.spin} aria-hidden="true" />}
            檢查環境
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={handleRun}
            disabled={!bridgeReady || running || healthLoading}
          >
            {running && <Loader2 size={16} className={styles.spin} aria-hidden="true" />}
            產生測試金鑰並執行檢查
          </button>
          <button type="button" className={styles.btnGhost} onClick={handleClear}>
            清除畫面結果
          </button>
        </div>

        {running && (
          <div className={styles.runningBanner} role="status">
            <Loader2 size={16} className={styles.spin} aria-hidden="true" />
            測試執行中…（本機 Python 正在執行真實密碼測試）
          </div>
        )}

        {busyNotice && <p className={styles.notice}>{busyNotice}</p>}
        {runError && (
          <p className={styles.errorText} role="alert">
            {runError}（按鈕已恢復可用）
          </p>
        )}
        {healthError && (
          <p className={styles.errorText} role="alert">
            {healthError}
          </p>
        )}

        {health && (
          <section className={styles.card}>
            <header className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>環境檢查（health check）</h3>
              <span className={styles.badge}>{`bridge v${health.bridge_version}`}</span>
            </header>
            <div className={styles.meta}>
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Python</span>
                <span className={styles.metaValue}>{health.python_version}</span>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>平台</span>
                <span className={styles.metaValue}>{health.platform_summary}</span>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>cryptography</span>
                <span className={styles.metaValue}>
                  {health.cryptography_version ?? '未安裝'}
                </span>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>liboqs-python</span>
                <span className={styles.metaValue}>
                  {health.liboqs_python_version ?? '未安裝'}
                </span>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>native liboqs</span>
                <span className={styles.metaValue}>
                  {health.native_liboqs_available ? '可用' : '不可用'} —{' '}
                  {health.native_liboqs_note ?? ''}
                </span>
              </div>
              {health.enabled_kem_identifiers.length > 0 && (
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>enabled KEM</span>
                  <span className={styles.metaValue}>
                    {health.enabled_kem_identifiers.join(', ')}
                  </span>
                </div>
              )}
              {health.enabled_sig_identifiers.length > 0 && (
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>enabled signatures</span>
                  <span className={styles.metaValue}>
                    {health.enabled_sig_identifiers.join(', ')}
                  </span>
                </div>
              )}
            </div>
          </section>
        )}

        {report && (
          <>
            <div className={styles.overallBar}>
              <div className={styles.overallRow}>
                <span className={styles.overallLabel}>
                  執行編號：<code>{report.run_id}</code>
                </span>
                <span className={styles.overallLabel}>
                  整體狀態：
                  <StatusBadge status={report.overall} />
                </span>
              </div>
              {report.overall_note && (
                <p className={styles.overallNote}>{report.overall_note}</p>
              )}
              <p className={styles.e2eeLine}>
                E2EE session：<strong>{report.e2ee_session}</strong>
                （本頁任何通過都不代表 E2EE 聊天已完成）
              </p>
            </div>

            <PqcCard title={GROUP_TITLES.ml_kem} group={report.groups.ml_kem} />
            <PqcCard title={GROUP_TITLES.ml_dsa} group={report.groups.ml_dsa} />
            <SimpleCard title={GROUP_TITLES.hkdf} group={report.groups.hkdf} />
            <SimpleCard title={GROUP_TITLES.aes_gcm} group={report.groups.aes_gcm} />
          </>
        )}

        {!report && !running && (
          <p className={styles.idleText}>
            尚未執行測試。按「產生測試金鑰並執行檢查」後，每項會先顯示未執行，
            再由本機 Python 回報真實的 passed／failed／blocked 狀態。
          </p>
        )}

        <footer className={styles.footer}>
          <p>
            畫面不會顯示（也不存在於回傳 schema 中）：私鑰、shared secret、derived
            AES key。「清除畫面結果」僅清除畫面，不聲稱物理安全抹除。
          </p>
        </footer>
      </div>
    </div>
  );
}
