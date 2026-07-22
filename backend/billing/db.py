"""Decouples the billing package from server.py's global `db`.

server.py reassigns its module-level `db` name at startup (in-memory vs
MongoDB), so `from server import db` inside this package would freeze on
whatever object existed at import time. Routes call get_db() per-request
instead, and server.py's startup hook calls set_db() after it (re)assigns
its own `db`.
"""
_db = None


def set_db(db):
    global _db
    _db = db


def get_db():
    if _db is None:
        raise RuntimeError("billing.db.set_db() has not been called yet")
    return _db
