"""Orchestrates a top-up: reads the pack price from the catalog, opens a
Razorpay order, and — once paid — grants credits exactly once. Knows nothing
about templates, durations, or renders; wallet.grant() is the only bridge
to the spending side.
"""
import os
import uuid
from datetime import datetime, timezone

from billing import catalog, wallet
from billing import gateway_razorpay as gateway

SUPPORTED_CURRENCIES = {"INR", "USD"}


def _usd_enabled() -> bool:
    return os.environ.get("BILLING_USD_ENABLED", "false").strip().lower() in {"1", "true", "yes", "on"}


class PaymentError(Exception):
    pass


def _now():
    return datetime.now(timezone.utc).isoformat()


async def create_topup_order(db, user_id: str, pack_id: str, currency: str) -> dict:
    currency = (currency or "INR").strip().upper()
    if currency not in SUPPORTED_CURRENCIES:
        raise PaymentError(f"Unsupported currency: {currency}")
    if currency == "USD" and not _usd_enabled():
        raise PaymentError("USD payments are not available yet")

    pack = await catalog.get_pack(db, pack_id)
    if not pack or not pack.get("isActive"):
        raise PaymentError("Credit pack not found")
    amount = (pack.get("prices") or {}).get(currency)
    if amount is None:
        raise PaymentError(f"This pack is not available in {currency}")

    payment_id = uuid.uuid4().hex
    razorpay_order = gateway.create_order(
        amount_minor=amount,
        currency=currency,
        receipt=payment_id,
        notes={"userId": user_id, "packId": pack_id},
    )
    doc = {
        "_id": payment_id,
        "userId": user_id,
        "packId": pack_id,
        "credits": int(pack["credits"]) + int(pack.get("bonusCredits", 0)),
        "amount": amount,
        "currency": currency,
        "razorpayOrderId": razorpay_order["id"],
        "razorpayPaymentId": None,
        "status": "created",
        "created_at": _now(),
        "paid_at": None,
    }
    await db.payments.insert_one(doc)
    return {
        "paymentId": payment_id,
        "razorpayOrderId": razorpay_order["id"],
        "amount": amount,
        "currency": currency,
        "keyId": gateway.key_id(),
    }


async def _mark_paid_and_grant(db, payment: dict, razorpay_payment_id: str) -> None:
    # Conditional on status="created" so whichever of (verify callback,
    # webhook) arrives first wins the flip and grants; the other is a no-op.
    result = await db.payments.update_one(
        {"_id": payment["_id"], "status": "created"},
        {"$set": {"status": "paid", "razorpayPaymentId": razorpay_payment_id, "paid_at": _now()}},
    )
    if result.matched_count == 0:
        return
    await wallet.grant(
        db,
        user_id=payment["userId"],
        amount=payment["credits"],
        ref_type="payment",
        ref_id=payment["_id"],
        idempotency_key=f"topup:{payment['_id']}",
    )


async def verify_and_grant(
    db, user_id: str, payment_id: str,
    razorpay_payment_id: str, razorpay_order_id: str, razorpay_signature: str,
) -> dict:
    payment = await db.payments.find_one({"_id": payment_id})
    if not payment or payment["userId"] != user_id:
        raise PaymentError("Payment not found")
    if payment["razorpayOrderId"] != razorpay_order_id:
        raise PaymentError("Order mismatch")
    if not gateway.verify_payment_signature(razorpay_order_id, razorpay_payment_id, razorpay_signature):
        raise PaymentError("Invalid payment signature")
    await _mark_paid_and_grant(db, payment, razorpay_payment_id)
    return await db.payments.find_one({"_id": payment_id})


async def handle_webhook(db, event: str, payload: dict) -> None:
    if event != "payment.captured":
        return
    entity = (payload.get("payload") or {}).get("payment", {}).get("entity", {})
    razorpay_order_id = entity.get("order_id")
    razorpay_payment_id = entity.get("id")
    if not razorpay_order_id or not razorpay_payment_id:
        return
    payment = await db.payments.find_one({"razorpayOrderId": razorpay_order_id})
    if not payment:
        return  # not one of ours (or race with order-creation) — ignore
    await _mark_paid_and_grant(db, payment, razorpay_payment_id)
