import json
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request

from billing import catalog, payments, pricing, wallet
from billing import gateway_razorpay as gateway
from billing.db import get_db
from billing.models import AdminCreditPackRequest, AdminWalletAdjustRequest, TopupRequest, VerifyPaymentRequest
from server import GoogleUser, require_admin_user, require_google_user, resolve_template_form

router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)


def _serialize_pack(p: dict) -> dict:
    return {
        "id": p["_id"],
        "name": p["name"],
        "credits": p["credits"],
        "bonusCredits": p.get("bonusCredits", 0),
        "prices": p.get("prices", {}),
        "isActive": p.get("isActive", True),
        "sortOrder": p.get("sortOrder", 100),
    }


@router.get("/pricing")
async def get_pricing(template: str, duration: int):
    """Server-computed credit cost for a (template, duration) pair — the same
    resolve_template_form() the render endpoint validates against, so the
    price shown to a user can never drift from what create_render charges."""
    db = get_db()
    template_doc = await db.templates.find_one({"_id": template})
    if not template_doc:
        raise HTTPException(status_code=404, detail="Template not found")
    category_doc = await db.categories.find_one({"name": template_doc.get("category", "")})
    form_manifest = resolve_template_form(template_doc, category_doc)
    allowed_durations = form_manifest["steps"]["details"]["durations"]
    if allowed_durations and duration not in allowed_durations:
        raise HTTPException(status_code=400, detail=f"Duration must be one of {allowed_durations} seconds for this template")
    cost = pricing.cost_in_credits(form_manifest["settings"], duration)
    return {"template": template, "duration": duration, "creditCost": cost, "isFree": cost == 0}


@router.get("/wallet")
async def get_my_wallet(user: GoogleUser = Depends(require_google_user)):
    db = get_db()
    w = await wallet.get_wallet(db, user.sub)
    return {
        "userId": w["_id"],
        "balance": w["balance"],
        "currency": w.get("currency", "CREDITS"),
        "updated_at": w.get("updated_at"),
    }


@router.get("/wallet/transactions")
async def get_my_wallet_transactions(user: GoogleUser = Depends(require_google_user)):
    db = get_db()
    txns = await wallet.list_transactions(db, user.sub)
    return [
        {
            "id": t["_id"],
            "type": t["type"],
            "amount": t["amount"],
            "balanceAfter": t["balanceAfter"],
            "status": t["status"],
            "refType": t["refType"],
            "refId": t["refId"],
            "created_at": t["created_at"],
        }
        for t in txns
    ]


@router.post("/admin/wallet/adjust")
async def admin_adjust_wallet(
    req: AdminWalletAdjustRequest,
    admin: GoogleUser = Depends(require_admin_user),
):
    db = get_db()
    idempotency_key = f"adjust:{uuid.uuid4().hex}"
    entry = await wallet.grant(
        db,
        user_id=req.userId,
        amount=req.amount,
        ref_type="admin",
        ref_id=admin.sub,
        idempotency_key=idempotency_key,
    )
    w = await wallet.get_wallet(db, req.userId)
    return {
        "userId": req.userId,
        "balance": w["balance"],
        "transaction": {
            "id": entry["_id"],
            "amount": entry["amount"],
            "balanceAfter": entry["balanceAfter"],
        },
    }


@router.get("/credit-packs")
async def list_credit_packs():
    db = get_db()
    packs = await catalog.list_active_packs(db)
    return [_serialize_pack(p) for p in packs]


@router.post("/payments/topup")
async def create_topup(req: TopupRequest, user: GoogleUser = Depends(require_google_user)):
    db = get_db()
    try:
        return await payments.create_topup_order(db, user.sub, req.packId, req.currency)
    except payments.PaymentError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.post("/payments/verify")
async def verify_topup(req: VerifyPaymentRequest, user: GoogleUser = Depends(require_google_user)):
    db = get_db()
    try:
        payment = await payments.verify_and_grant(
            db, user.sub, req.paymentId, req.razorpayPaymentId, req.razorpayOrderId, req.razorpaySignature,
        )
    except payments.PaymentError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    w = await wallet.get_wallet(db, user.sub)
    return {"status": payment["status"], "balance": w["balance"]}


@router.get("/payments/mine")
async def list_my_payments(user: GoogleUser = Depends(require_google_user)):
    """Backs the "My Orders" page — the user's own credit-pack purchase history."""
    db = get_db()
    docs = await db.payments.find({"userId": user.sub}).sort("created_at", -1).to_list(200)
    pack_names = {}
    for p in docs:
        pack_id = p.get("packId")
        if pack_id and pack_id not in pack_names:
            pack = await catalog.get_pack(db, pack_id)
            pack_names[pack_id] = pack["name"] if pack else pack_id
    return [
        {
            "id": p["_id"],
            "packId": p.get("packId"),
            "packName": pack_names.get(p.get("packId"), p.get("packId")),
            "credits": p.get("credits"),
            "amount": p.get("amount"),
            "currency": p.get("currency"),
            "status": p.get("status"),
            "created_at": p.get("created_at"),
            "paid_at": p.get("paid_at"),
        }
        for p in docs
    ]


@router.post("/webhooks/razorpay")
async def razorpay_webhook(request: Request):
    """Authoritative payment confirmation — fires server-to-server regardless
    of whether the client's /payments/verify callback ever lands. Converges
    idempotently with it via payments._mark_paid_and_grant()."""
    db = get_db()
    raw_body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    if not gateway.verify_webhook_signature(raw_body, signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")
    try:
        event_payload = json.loads(raw_body)
    except ValueError:
        raise HTTPException(status_code=400, detail="Malformed webhook payload")
    await payments.handle_webhook(db, event_payload.get("event", ""), event_payload)
    return {"status": "ok"}


@router.get("/admin/credit-packs")
async def admin_list_credit_packs(_: GoogleUser = Depends(require_admin_user)):
    db = get_db()
    packs = await catalog.list_all_packs(db)
    return [_serialize_pack(p) for p in packs]


@router.post("/admin/credit-packs/{pack_id}")
async def admin_upsert_credit_pack(
    pack_id: str,
    req: AdminCreditPackRequest,
    _: GoogleUser = Depends(require_admin_user),
):
    db = get_db()
    if req.credits < 1:
        raise HTTPException(status_code=400, detail="credits must be at least 1")
    if not req.prices:
        raise HTTPException(status_code=400, detail="prices must include at least one currency")
    for currency, amount in req.prices.items():
        if currency not in payments.SUPPORTED_CURRENCIES:
            raise HTTPException(status_code=400, detail=f"Unsupported currency: {currency}")
        if amount < 0:
            raise HTTPException(status_code=400, detail=f"prices[{currency}] must be 0 or more")
    pack = await catalog.upsert_pack(db, pack_id, req.model_dump())
    return _serialize_pack(pack)


@router.delete("/admin/credit-packs/{pack_id}")
async def admin_delete_credit_pack(pack_id: str, _: GoogleUser = Depends(require_admin_user)):
    db = get_db()
    await catalog.delete_pack(db, pack_id)
    return {"status": "deleted"}
