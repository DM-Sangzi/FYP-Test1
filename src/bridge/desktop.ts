/**
 * 型別化的 desktop bridge adapter（pywebview）。
 *
 * - 只認識 Python 端 allowlist 的兩個方法：health_check、
 *   run_feasibility_checks（見 desktop/pqpm_client/bridge.py）。
 * - 正確等待 pywebviewready 事件（含逾時處理），不假設 window.onload
 *   時 bridge 已可用；視窗關閉／bridge 例外以明確的錯誤型別回報。
 * - 「bridge 可用」不得推斷為「liboqs 可用」——native 狀態一律由
 *   Python health_check 如實回報。
 */
import type {
  BusyResponse,
  FailedResponse,
  FeasibilityReport,
  HealthInfo,
} from '../types/crypto';

export interface PyWebViewApi {
  health_check(): Promise<HealthInfo | FailedResponse>;
  run_feasibility_checks(): Promise<FeasibilityReport | BusyResponse | FailedResponse>;
}

declare global {
  interface Window {
    pywebview?: { api?: PyWebViewApi };
  }
}

export class BridgeTimeoutError extends Error {}
export class BridgeUnavailableError extends Error {}
export class BridgeCallError extends Error {}

const BRIDGE_READY_TIMEOUT_MS = 5_000;
const BRIDGE_CALL_TIMEOUT_MS = 60_000;

/**
 * ?diagnostics=1 只是 UI 模式標記（顯示「診斷模式」文案用），
 * 不具授權意義；bridge 是否真的存在由 Python --diagnostics 啟動模式決定。
 */
export function isDiagnosticsMode(): boolean {
  return new URLSearchParams(window.location.search).get('diagnostics') === '1';
}

/** 等待 pywebviewready；逾時或 api 缺失時 reject。 */
export function waitForBridge(
  timeoutMs: number = BRIDGE_READY_TIMEOUT_MS,
): Promise<PyWebViewApi> {
  if (window.pywebview?.api) {
    return Promise.resolve(window.pywebview.api);
  }
  return new Promise<PyWebViewApi>((resolve, reject) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new BridgeTimeoutError(`等待 pywebviewready 逾時（${timeoutMs} ms）`));
    }, timeoutMs);

    const onReady = () => {
      if (settled) return;
      settled = true;
      cleanup();
      const api = window.pywebview?.api;
      if (api) resolve(api);
      else reject(new BridgeUnavailableError('pywebviewready 已觸發但 api 不存在'));
    };

    function cleanup() {
      window.clearTimeout(timer);
      window.removeEventListener('pywebviewready', onReady);
    }

    window.addEventListener('pywebviewready', onReady);
  });
}

/** Promise 逾時包裝（視窗關閉導致 promise 永不結束時，UI 仍能恢復）。 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new BridgeTimeoutError(`${label} 呼叫逾時（${ms} ms）`)),
      ms,
    );
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(
          error instanceof Error
            ? error
            : new BridgeCallError(`${label} 呼叫失敗（未知錯誤）`),
        );
      },
    );
  });
}

export async function callHealthCheck(api: PyWebViewApi): Promise<HealthInfo> {
  try {
    const result = await withTimeout(api.health_check(), BRIDGE_CALL_TIMEOUT_MS, 'health_check');
    if (result && 'failed' in result) {
      throw new BridgeCallError(`health_check 失敗（${result.detail ?? '未知'}）`);
    }
    return result;
  } catch (error) {
    if (error instanceof BridgeTimeoutError) throw error;
    throw new BridgeCallError(error instanceof Error ? error.message : 'health_check 呼叫失敗');
  }
}

export async function callRunFeasibilityChecks(
  api: PyWebViewApi,
): Promise<FeasibilityReport | BusyResponse> {
  try {
    const result = await withTimeout(
      api.run_feasibility_checks(),
      BRIDGE_CALL_TIMEOUT_MS,
      'run_feasibility_checks',
    );
    if (result && 'failed' in result) {
      throw new BridgeCallError(`測試執行失敗（${result.detail ?? '未知'}）`);
    }
    return result;
  } catch (error) {
    if (error instanceof BridgeTimeoutError) throw error;
    throw new BridgeCallError(
      error instanceof Error ? error.message : 'run_feasibility_checks 呼叫失敗',
    );
  }
}

export function isBusyResponse(
  value: FeasibilityReport | BusyResponse,
): value is BusyResponse {
  return (value as BusyResponse).busy === true;
}
