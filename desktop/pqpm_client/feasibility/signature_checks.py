"""ML-DSA 可行性檢查（Stage 1 測試目標：ML-DSA-65）。

注意：ML-DSA-65 是第 1 階段的「測試選擇」，不是已批准的最終參數。
若 identifier 不支援，回報 blocked 及可用選項；禁止把 legacy Dilithium
名稱標記為 ML-DSA。

安全邊界：私鑰只存在 native 物件內；報告只含公鑰長度／指紋、簽章長度
與各項狀態。不對 native 層做無限制 fuzzing，只測明確的 malformed 長度。
"""
from __future__ import annotations

import hashlib

from . import models
from .kem_checks import detect_liboqs

#: Stage 1 測試選擇（非最終核定參數）
SIG_IDENTIFIER = "ML-DSA-65"

_TEST_MESSAGE = b"PQPM stage 1 ML-DSA synthetic test message"


def run_signature_checks(group: dict) -> None:
    """就地更新 ml_dsa 分組；所有路徑都只寫入非秘密欄位。"""
    group["algorithm"] = SIG_IDENTIFIER
    detection = detect_liboqs()

    if not detection["available"]:
        group["status"] = "blocked"
        detail = detection.get("error_type")
        group["note"] = (
            f"{detection['reason']}（{detail}）。"
            if detail
            else f"{detection['reason']}。"
        ) + "此為 B 模式預期狀態：安裝 native liboqs 前如實顯示受阻。"
        for check in group["checks"].values():
            check["status"] = "blocked"
        return

    import oqs

    try:
        identifiers = list(oqs.get_enabled_sig_mechanisms())
    except Exception as exc:
        group["status"] = "blocked"
        group["note"] = f"無法列出 enabled signature identifiers（{type(exc).__name__}）"
        for check in group["checks"].values():
            check["status"] = "blocked"
        return
    group["enabled_identifiers"] = identifiers

    # 只接受明確的 ML-DSA 名稱；Dilithium legacy 名稱不得替代
    if SIG_IDENTIFIER not in identifiers:
        group["status"] = "blocked"
        group["note"] = (
            f"測試目標 {SIG_IDENTIFIER} 不在 enabled identifiers 中；不擅自替換"
            "（legacy Dilithium 不會被標記為 ML-DSA）。"
        )
        for check in group["checks"].values():
            check["status"] = "blocked"
        return

    with oqs.Signature(SIG_IDENTIFIER) as signer:
        public_key = signer.generate_keypair()
        signature = signer.sign(_TEST_MESSAGE)
        with oqs.Signature(SIG_IDENTIFIER, public_key) as verifier:
            ok_same = verifier.verify(_TEST_MESSAGE, signature)
            bad_message = verifier.verify(_TEST_MESSAGE + b"x", signature)

    with oqs.Signature(SIG_IDENTIFIER) as other_party:
        other_public_key = other_party.generate_keypair()
        with oqs.Signature(SIG_IDENTIFIER, other_public_key) as wrong_verifier:
            ok_wrong_key = wrong_verifier.verify(_TEST_MESSAGE, signature)

    group["public_key_bytes"] = len(public_key)
    group["public_key_fingerprint_sha256"] = hashlib.sha256(public_key).hexdigest()
    group["signature_bytes"] = len(signature)

    group["checks"]["keygen"] = models.new_check("passed")
    group["checks"]["sign_verify_correct"] = models.new_check(
        "passed" if ok_same else "failed",
        note=None if ok_same else "正確訊息＋正確公鑰驗證失敗",
    )
    group["checks"]["modified_message_rejected"] = models.new_check(
        "passed" if not bad_message else "failed",
        note=None if not bad_message else "修改後的訊息未被拒絕",
    )
    group["checks"]["wrong_key_rejected"] = models.new_check(
        "passed" if not ok_wrong_key else "failed",
        note=None if not ok_wrong_key else "錯誤公鑰竟驗證成功",
    )
    group["checks"]["signature_length"] = models.new_check(
        "passed", note=f"{len(signature)} bytes"
    )

    # malformed 長度簽章的安全處理（例外或回 False 都視為拒絕）
    try:
        with oqs.Signature(SIG_IDENTIFIER, public_key) as verifier:
            verdict = verifier.verify(_TEST_MESSAGE, signature[:-1])
        malformed_rejected = not verdict
    except Exception:
        malformed_rejected = True

    group["note"] = (
        f"ML-DSA-65 為第 1 階段測試選擇（非最終核定參數）。"
        f"Malformed 長度簽章{'已拒絕' if malformed_rejected else '未被拒絕'}。"
    )

    group["status"] = (
        "passed"
        if all(c["status"] == "passed" for c in group["checks"].values())
        else "failed"
    )
