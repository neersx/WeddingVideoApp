"""Credit pack catalog — what a user actually buys with money. Prices are
per-currency, in minor units (paise for INR, cents for USD); credits and
render pricing (billing/pricing.py) never see currency at all."""
from datetime import datetime, timezone

DEFAULT_CREDIT_PACKS = [
    {"_id": "starter", "name": "Starter", "credits": 10, "bonusCredits": 0,
     "prices": {"INR": 10000, "USD": 200}, "isActive": True, "sortOrder": 10},
    {"_id": "value", "name": "Value", "credits": 50, "bonusCredits": 5,
     "prices": {"INR": 50000, "USD": 1000}, "isActive": True, "sortOrder": 20},
    {"_id": "pro", "name": "Pro", "credits": 100, "bonusCredits": 20,
     "prices": {"INR": 100000, "USD": 2000}, "isActive": True, "sortOrder": 30},
]


def _now():
    return datetime.now(timezone.utc).isoformat()


async def seed_default_packs(db):
    for pack in DEFAULT_CREDIT_PACKS:
        existing = await db.credit_packs.find_one({"_id": pack["_id"]})
        if existing:
            continue
        doc = dict(pack)
        doc["created_at"] = _now()
        doc["updated_at"] = _now()
        await db.credit_packs.insert_one(doc)


async def list_active_packs(db) -> list:
    cursor = db.credit_packs.find({"isActive": True}).sort("sortOrder", 1)
    return await cursor.to_list(100)


async def list_all_packs(db) -> list:
    cursor = db.credit_packs.find().sort("sortOrder", 1)
    return await cursor.to_list(100)


async def get_pack(db, pack_id: str):
    return await db.credit_packs.find_one({"_id": pack_id})


async def upsert_pack(db, pack_id: str, data: dict) -> dict:
    existing = await db.credit_packs.find_one({"_id": pack_id})
    doc = {
        "_id": pack_id,
        "name": data["name"],
        "credits": int(data["credits"]),
        "bonusCredits": int(data.get("bonusCredits", 0)),
        "prices": {k: int(v) for k, v in data["prices"].items()},
        "isActive": bool(data.get("isActive", True)),
        "sortOrder": int(data.get("sortOrder", 100)),
        "created_at": existing["created_at"] if existing else _now(),
        "updated_at": _now(),
    }
    if existing:
        await db.credit_packs.update_one({"_id": pack_id}, {"$set": doc})
    else:
        await db.credit_packs.insert_one(doc)
    return await db.credit_packs.find_one({"_id": pack_id})


async def delete_pack(db, pack_id: str) -> None:
    await db.credit_packs.delete_one({"_id": pack_id})
