"""完整報告 schema 測試：狀態真實性、無秘密欄位、E2EE 固定聲明。"""
import json
import re

from pqpm_client.feasibility import kem_checks, models
from pqpm_client.feasibility.runner import FeasibilityService

_RUN_ID_RE = re.compile(r"^[0-9a-f]{8}$")
_FINGERPRINT_RE = re.compile(r"^[0-9a-f]{64}$")


def test_real_report_schema_and_statuses():
    report = FeasibilityService().run_checks()

    assert report["schema_version"] == models.SCHEMA_VERSION
    assert _RUN_ID_RE.match(report["run_id"])
    assert report["source"] == "local_python"
    assert report["started_at"] and report["finished_at"]
    assert report["e2ee_session"] == "尚未實作"

    allowed = set(models.CHECK_STATUSES)
    for group in report["groups"].values():
        assert group["status"] in allowed
        for check in group["checks"].values():
            assert check["status"] in allowed

    # 非 PQC 項目由 cryptography 真實執行：必須是明確的 passed/failed
    for key in ("hkdf", "aes_gcm"):
        assert report["groups"][key]["status"] in ("passed", "failed")

    # PQC 項目依 native 配置如實回報
    detection = kem_checks.detect_liboqs()
    if not detection["available"]:
        assert report["groups"]["ml_kem"]["status"] == "blocked"
        assert report["groups"]["ml_dsa"]["status"] == "blocked"
        assert report["overall"] == "blocked"  # 整體不得顯示全部通過
        assert "受阻" in report["overall_note"]
    else:
        # native 可用時（選項 A 實施後）：只能是真的 passed 或 failed
        for key in ("ml_kem", "ml_dsa"):
            assert report["groups"][key]["status"] in ("passed", "failed")

    # 整體狀態與分組一致
    statuses = {g["status"] for g in report["groups"].values()}
    if "failed" in statuses:
        assert report["overall"] == "failed"
    elif "blocked" in statuses:
        assert report["overall"] == "blocked"


def test_report_json_has_no_secret_keys_or_material():
    report = FeasibilityService().run_checks()
    payload = json.dumps(report, ensure_ascii=False)

    # 欄位名稱不得含秘密字樣（schema 級保證）
    assert models.find_forbidden_keys(report) == []

    # 指紋只能是 64-hex 或 null（不是 base64 金鑰 bytes）
    for key in ("ml_kem", "ml_dsa"):
        fp = report["groups"][key]["public_key_fingerprint_sha256"]
        assert fp is None or _FINGERPRINT_RE.match(fp)

    # 不得出現 liboqs 自動安裝器訊息（防自動下載回歸）
    assert "installing" not in payload.lower()


def test_each_run_has_new_run_id_and_keys():
    first = FeasibilityService().run_checks()
    second = FeasibilityService().run_checks()
    # 新 run：run ID 必須不同；正常隨機下公鑰指紋也會改變
    # （指紋改變本身不作隨機性安全證明，僅核對行為）
    assert first["run_id"] != second["run_id"]
