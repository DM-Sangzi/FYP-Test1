/**
 * 第 1 階段診斷結果型別 — 與 desktop/pqpm_client/feasibility/models.py 的
 * 非秘密 schema 一一對應（schema_version 1）。
 *
 * 安全邊界：schema 本身就不存在私鑰、shared secret、derived key 欄位；
 * UI 只依本檔案 render，不自行生成假的成功結果。
 */

/** 單一檢查項狀態（running 為 UI 暫態，Python 不會回傳）。 */
export type CheckStatus = 'not_run' | 'running' | 'passed' | 'failed' | 'blocked';

/** 整體狀態：任何分組受阻時整體為 blocked，不得顯示全部通過。 */
export type OverallStatus = 'not_run' | 'passed' | 'partial' | 'failed' | 'blocked';

export interface CheckEntry {
  status: CheckStatus;
  note: string | null;
}

export interface PqcGroupResult {
  status: CheckStatus;
  algorithm: string | null;
  enabled_identifiers: string[];
  public_key_bytes: number | null;
  public_key_fingerprint_sha256: string | null;
  ciphertext_bytes: number | null;
  signature_bytes: number | null;
  checks: Record<string, CheckEntry>;
  note: string | null;
}

export interface SimpleGroupResult {
  status: CheckStatus;
  checks: Record<string, CheckEntry>;
  note: string | null;
}

export interface FeasibilityReport {
  schema_version: number;
  /** 由 Python 產生的非秘密 run ID。 */
  run_id: string;
  source: 'local_python';
  started_at: string | null;
  finished_at: string | null;
  overall: OverallStatus;
  overall_note: string | null;
  /** 固定聲明：目前為「尚未實作」，UI 必須原樣顯示。 */
  e2ee_session: string;
  groups: {
    ml_kem: PqcGroupResult;
    ml_dsa: PqcGroupResult;
    hkdf: SimpleGroupResult;
    aes_gcm: SimpleGroupResult;
  };
}

/** 「檢查環境」按鈕的回傳（全部為可安全顯示的非秘密資訊）。 */
export interface HealthInfo {
  bridge_version: number;
  mode: 'diagnostics';
  python_version: string;
  platform_summary: string;
  cryptography_version: string | null;
  liboqs_python_version: string | null;
  native_liboqs_available: boolean;
  native_liboqs_note: string | null;
  enabled_kem_identifiers: string[];
  enabled_sig_identifiers: string[];
}

/** Python 端 busy 回覆（平行點擊時第二個請求收到這個）。 */
export interface BusyResponse {
  busy: true;
  detail?: string;
}

/** Python 端錯誤回覆（只含錯誤類別，不含 traceback）。 */
export interface FailedResponse {
  failed: true;
  detail?: string;
}
