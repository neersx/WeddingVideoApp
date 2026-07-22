"""Ledger-first wallet: db.wallets.balance is a cached aggregate, never
written directly except through the atomic conditional updates below. The
append-only db.wallet_transactions collection is the source of truth and
what makes every operation here idempotent and auditable.

Render credits follow reserve -> capture | release so a render is only ever
charged for on success; a failed render refunds its hold. Top-ups (and
promo/admin adjustments) use grant(), which commits immediately.
"""
import uuid
from datetime import datetime, timezone

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError


class InsufficientCreditsError(Exception):
    def __init__(self, required: int, balance: int):
        self.required = required
        self.balance = balance
        super().__init__(f"Requires {required} credits, wallet has {balance}")


def _now():
    return datetime.now(timezone.utc).isoformat()


async def _get_or_create_wallet(db, user_id: str):
    wallet = await db.wallets.find_one({"_id": user_id})
    if wallet:
        return wallet
    wallet = {"_id": user_id, "balance": 0, "currency": "CREDITS", "updated_at": _now()}
    try:
        await db.wallets.insert_one(wallet)
    except DuplicateKeyError:
        # Lost a race to create it; the other writer's doc is authoritative.
        wallet = await db.wallets.find_one({"_id": user_id})
    return wallet


async def get_wallet(db, user_id: str) -> dict:
    return await _get_or_create_wallet(db, user_id)


async def list_transactions(db, user_id: str, limit: int = 50) -> list:
    cursor = db.wallet_transactions.find({"userId": user_id}).sort("created_at", -1)
    return await cursor.to_list(limit)


async def _find_by_idempotency_key(db, idempotency_key: str):
    return await db.wallet_transactions.find_one({"idempotencyKey": idempotency_key})


async def reserve(db, user_id: str, amount: int, ref_id: str) -> dict:
    """Places a hold for `amount` credits against a render (ref_id). Raises
    InsufficientCreditsError if the wallet can't cover it. Idempotent: a
    repeat call with the same ref_id returns the original hold untouched."""
    if amount <= 0:
        raise ValueError("reserve amount must be positive")

    idempotency_key = f"hold:{ref_id}"
    existing = await _find_by_idempotency_key(db, idempotency_key)
    if existing:
        return existing

    await _get_or_create_wallet(db, user_id)
    updated = await db.wallets.find_one_and_update(
        {"_id": user_id, "balance": {"$gte": amount}},
        {"$inc": {"balance": -amount}},
        return_document=ReturnDocument.AFTER,
    )
    if updated is None:
        wallet = await get_wallet(db, user_id)
        raise InsufficientCreditsError(required=amount, balance=wallet["balance"])

    entry = {
        "_id": uuid.uuid4().hex,
        "userId": user_id,
        "type": "hold",
        "amount": -amount,
        "balanceAfter": updated["balance"],
        "status": "pending",
        "refType": "render",
        "refId": ref_id,
        "idempotencyKey": idempotency_key,
        "created_at": _now(),
    }
    try:
        await db.wallet_transactions.insert_one(entry)
    except DuplicateKeyError:
        return await _find_by_idempotency_key(db, idempotency_key)
    return entry


async def capture(db, user_id: str, ref_id: str) -> None:
    """Commits a hold on render success. No balance change (already debited
    at reserve time) — just flips the hold from pending to committed."""
    hold = await _find_by_idempotency_key(db, f"hold:{ref_id}")
    if not hold or hold["status"] != "pending":
        return  # already captured/released, or never held (free render)
    await db.wallet_transactions.update_one(
        {"_id": hold["_id"]}, {"$set": {"status": "committed"}}
    )


async def release(db, user_id: str, ref_id: str) -> None:
    """Refunds a hold on render failure. Idempotent no-op if already
    captured/released or never held."""
    hold = await _find_by_idempotency_key(db, f"hold:{ref_id}")
    if not hold or hold["status"] != "pending":
        return
    amount = -hold["amount"]  # hold.amount is negative; refund the positive
    updated = await db.wallets.find_one_and_update(
        {"_id": user_id}, {"$inc": {"balance": amount}},
        return_document=ReturnDocument.AFTER,
    )
    await db.wallet_transactions.update_one(
        {"_id": hold["_id"]}, {"$set": {"status": "released"}}
    )
    await db.wallet_transactions.insert_one({
        "_id": uuid.uuid4().hex,
        "userId": user_id,
        "type": "release",
        "amount": amount,
        "balanceAfter": updated["balance"],
        "status": "committed",
        "refType": "render",
        "refId": ref_id,
        "idempotencyKey": f"release:{ref_id}",
        "created_at": _now(),
    })


async def grant(db, user_id: str, amount: int, ref_type: str, ref_id: str, idempotency_key: str) -> dict:
    """Immediately credits (or, with a negative amount, debits) the wallet —
    used for top-ups, promo credits, and admin adjustments. Idempotent on
    idempotency_key: a repeat call (e.g. a replayed webhook) is a no-op."""
    existing = await _find_by_idempotency_key(db, idempotency_key)
    if existing:
        return existing

    await _get_or_create_wallet(db, user_id)
    updated = await db.wallets.find_one_and_update(
        {"_id": user_id}, {"$inc": {"balance": amount}},
        return_document=ReturnDocument.AFTER,
    )

    entry = {
        "_id": uuid.uuid4().hex,
        "userId": user_id,
        "type": "topup" if ref_type == "payment" else ref_type,
        "amount": amount,
        "balanceAfter": updated["balance"],
        "status": "committed",
        "refType": ref_type,
        "refId": ref_id,
        "idempotencyKey": idempotency_key,
        "created_at": _now(),
    }
    try:
        await db.wallet_transactions.insert_one(entry)
    except DuplicateKeyError:
        return await _find_by_idempotency_key(db, idempotency_key)
    return entry
