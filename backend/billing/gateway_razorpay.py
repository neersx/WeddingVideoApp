"""The only module in this package that knows Razorpay exists. Everything
above this (payments.py, routes.py) speaks in terms of orders and
signatures — swapping providers later means rewriting this file only."""
import os

import razorpay
from razorpay.errors import SignatureVerificationError

_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "").strip()
_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "").strip()
_WEBHOOK_SECRET = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "").strip()

_client = None


def _get_client() -> razorpay.Client:
    global _client
    if _client is None:
        if not _KEY_ID or not _KEY_SECRET:
            raise RuntimeError("Razorpay is not configured (RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET missing)")
        _client = razorpay.Client(auth=(_KEY_ID, _KEY_SECRET))
    return _client


def key_id() -> str:
    return _KEY_ID


def create_order(amount_minor: int, currency: str, receipt: str, notes: dict) -> dict:
    """amount_minor is in the smallest unit of `currency` (paise for INR,
    cents for USD) — Razorpay's Orders API always expects that."""
    client = _get_client()
    return client.order.create({
        "amount": amount_minor,
        "currency": currency,
        "receipt": receipt,
        "notes": notes,
        "payment_capture": 1,
    })


def verify_payment_signature(razorpay_order_id: str, razorpay_payment_id: str, razorpay_signature: str) -> bool:
    client = _get_client()
    try:
        client.utility.verify_payment_signature({
            "razorpay_order_id": razorpay_order_id,
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_signature": razorpay_signature,
        })
        return True
    except SignatureVerificationError:
        return False


def verify_webhook_signature(raw_body: bytes, signature: str) -> bool:
    if not _WEBHOOK_SECRET or not signature:
        return False
    client = _get_client()
    try:
        client.utility.verify_webhook_signature(raw_body.decode("utf-8"), signature, _WEBHOOK_SECRET)
        return True
    except SignatureVerificationError:
        return False
