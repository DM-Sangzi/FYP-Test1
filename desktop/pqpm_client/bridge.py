"""pywebview js_api 的 allowlist bridge。

- 只暴露兩個明確方法：``health_check`` 與 ``run_feasibility_checks``。
  不提供任意 Python、shell、檔案路徑、演算法程式碼或私鑰輸入。
- 本橋接只會在 app.py 以 ``--diagnostics`` 模式啟動視窗時建立；
  一般啟動不會暴露測試 bridge。
- ``?diagnostics=1`` URL 參數只是前端 UI 模式標記，不具任何授權意義；
  bridge 是否存在完全由 Python 啟動模式決定。
- 所有回傳值都是非秘密 schema（見 feasibility/models.py）。
"""
from __future__ import annotations

from .feasibility.runner import BusyError, FeasibilityService


class DiagnosticsBridge:
    """pywebview js_api 物件（方法即 allowlist）。"""

    METHOD_ALLOWLIST = ("health_check", "run_feasibility_checks")

    def __init__(self, service: FeasibilityService) -> None:
        self._service = service

    def health_check(self) -> dict:
        """回傳可安全顯示的版本／支援演算法／native 狀態（非秘密）。"""
        try:
            return self._service.health_check()
        except Exception as exc:
            return {"failed": True, "detail": type(exc).__name__}

    def run_feasibility_checks(self) -> dict:
        """執行固定的本機測試 suite；平行請求回覆 busy。"""
        try:
            return self._service.run_checks()
        except BusyError:
            return {"busy": True, "detail": "已有一個測試 suite 執行中"}
        except Exception as exc:
            # 只回傳例外類別，不外洩 traceback
            return {"failed": True, "detail": type(exc).__name__}
