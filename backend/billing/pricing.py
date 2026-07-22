"""Pure credit-cost lookup. No I/O — callers pass in the template's already-
loaded settings dict. Wired into the render endpoint in Stage 2."""


def cost_in_credits(settings: dict, duration: int) -> int:
    pricing = settings.get("pricing") or {}
    by_duration = pricing.get("byDuration") or {}
    if str(int(duration)) in by_duration:
        return int(by_duration[str(int(duration))])
    return int(pricing.get("default", 0))
