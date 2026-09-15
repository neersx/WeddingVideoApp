"""Normalize DreamWedds wedding data for culture-specific video templates."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Iterable, List, Mapping, Optional


_CULTURE_ALIASES = {
    "": "indian", "hindu": "indian", "india": "indian", "indian": "indian",
    "christian": "christian", "christianity": "christian",
    "buddhist": "buddhist", "buddhism": "buddhist",
    "muslim": "muslim", "islam": "muslim", "islamic": "muslim",
}

# This is the partner allow-list. Add a key only when the matching Remotion
# composition has been implemented and registered.
_TEMPLATE_REGISTRY = {
    ("indian", "royal-blush"): "dreamwedds-royal-blush",
    ("muslim", "emerald-nikah"): "dreamwedds-emerald-nikah",
}

_TEMPLATE_ALIASES = {
    ("muslim", "emrald-nikash"): "emerald-nikah",
    ("muslim", "emerald-nikash"): "emerald-nikah",
    ("muslim", "emrald-nikah"): "emerald-nikah",
}

_DEFAULT_TEMPLATE_BY_CULTURE = {
    "indian": "royal-blush",
    "muslim": "emerald-nikah",
}


def _clean(value: Any) -> str:
    return str(value or "").strip()


def _full_name(person: Optional[Mapping[str, Any]]) -> str:
    if not person:
        return ""
    return " ".join(part for part in (_clean(person.get("firstName")), _clean(person.get("lastName"))) if part)


def _first_person(rows: Any, primary_key: str) -> Mapping[str, Any]:
    people = [row for row in (rows or []) if isinstance(row, Mapping)]
    return next((row for row in people if bool(row.get(primary_key))), people[0] if people else {})


def _image_urls(value: Any) -> List[str]:
    values: Iterable[Any] = value.split(",") if isinstance(value, str) else value if isinstance(value, list) else []
    return [_clean(item) for item in values if _clean(item)]


def _unique(values: Iterable[Any], limit: int = 8) -> List[str]:
    result: List[str] = []
    seen = set()
    for value in values:
        url = _clean(value)
        if url and url not in seen:
            result.append(url)
            seen.add(url)
        if len(result) >= limit:
            break
    return result


def _format_date(value: Any) -> str:
    raw = _clean(value)
    if not raw:
        return ""
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).strftime("%d %B %Y").lstrip("0")
    except ValueError:
        return raw


def _culture(value: Any) -> str:
    normalized = _clean(value).lower().replace("_", "-")
    culture = _CULTURE_ALIASES.get(normalized)
    if not culture:
        raise ValueError(f"Unsupported weddingCulture '{value}'.")
    return culture


def _template_id(culture: str, value: Any) -> str:
    requested = _clean(value).lower().replace("_", "-").replace(" ", "-") or "royal-blush"
    requested = requested.removeprefix("dreamwedds-")
    requested = _TEMPLATE_ALIASES.get((culture, requested), requested)
    composition = _TEMPLATE_REGISTRY.get((culture, requested))
    if not composition:
        available = sorted(key for item_culture, key in _TEMPLATE_REGISTRY if item_culture == culture)
        raise ValueError(
            f"Template '{value or requested}' is not available for {culture} weddings. "
            f"Available templates: {', '.join(available) or 'none'}."
        )
    return composition


def normalize_dreamwedds_request(payload: Mapping[str, Any]) -> Dict[str, Any]:
    """Accept raw wedding JSON or ``{wedding, template, weddingCulture}``."""
    wrapped_wedding = payload.get("wedding")
    wedding = wrapped_wedding if isinstance(wrapped_wedding, Mapping) else payload
    if not isinstance(wedding, Mapping) or not wedding:
        raise ValueError("A DreamWedds wedding payload is required.")

    culture = _culture(payload.get("weddingCulture") or wedding.get("weddingCulture") or "indian")
    # Raw wedding JSON already has a `template` object describing its website
    # theme (for example Miraya). That is not a video-template selector. Only a
    # wrapper's string `template`, or an explicit `videoTemplate`, may select a
    # Remotion design.
    requested_template = payload.get("template") if isinstance(wrapped_wedding, Mapping) else payload.get("videoTemplate")
    template = _template_id(culture, requested_template or _DEFAULT_TEMPLATE_BY_CULTURE.get(culture, "royal-blush"))

    bride = _first_person(wedding.get("brideAndMaids"), "isBride")
    groom = _first_person(wedding.get("groomAndMen"), "isGroom")
    bride_name, groom_name = _full_name(bride), _full_name(groom)
    title = _clean(wedding.get("title")) or "Wedding Celebration"
    if "&" in title:
        title_parts = title.split("&", 1)
        bride_name = bride_name or title_parts[0].strip()
        groom_name = groom_name or title_parts[1].strip()
    bride_name, groom_name = bride_name or "The Bride", groom_name or "The Groom"

    events = [row for row in (wedding.get("weddingEvents") or []) if isinstance(row, Mapping)]
    active_events = [row for row in events if row.get("isActive", True)]
    primary_event = next((row for row in active_events if bool(row.get("isPrimary"))), active_events[0] if active_events else {})
    venue = primary_event.get("venue") if isinstance(primary_event.get("venue"), Mapping) else {}

    banners = _unique([
        *_image_urls(wedding.get("backgroundImage")),
        *_image_urls(wedding.get("backgroundImages")),
        wedding.get("thumbnailImageUrl"),
    ], limit=6)
    event_image = _clean(primary_event.get("imageUrl") or primary_event.get("backGroundImage"))
    timelines = [row for row in (wedding.get("timeLines") or []) if isinstance(row, Mapping)]
    galleries = [row for row in (wedding.get("weddingGalleries") or []) if isinstance(row, Mapping)]

    selected = payload.get("images")
    selected_urls = [item.get("imageUrl") if isinstance(item, Mapping) else item for item in selected] if isinstance(selected, list) else []
    photos = _unique(selected_urls or [
        banners[0] if banners else "",
        bride.get("imageUrl"), groom.get("imageUrl"),
        event_image or (banners[1] if len(banners) > 1 else ""),
        *[row.get("imageUrl") for row in timelines],
        *[row.get("imageUrl") for row in galleries],
        *banners[2:],
    ])

    wedding_date = _clean(primary_event.get("eventDate") or wedding.get("weddingDate"))
    venue_name, venue_city = _clean(venue.get("name")), _clean(venue.get("city"))
    normalized_details = {
        "source": "dreamwedds", "culture": culture, "template": template,
        "weddingId": wedding.get("id"), "title": title,
        "bride": {"name": bride_name, "imageUrl": _clean(bride.get("imageUrl"))},
        "groom": {"name": groom_name, "imageUrl": _clean(groom.get("imageUrl"))},
        "date": wedding_date, "formattedDate": _format_date(wedding_date),
        "event": {
            "title": _clean(primary_event.get("title")) or "Wedding Celebration",
            "date": _clean(primary_event.get("eventDate")) or wedding_date,
            "formattedDate": _format_date(primary_event.get("eventDate") or wedding_date),
            "imageUrl": event_image or (banners[1] if len(banners) > 1 else (banners[0] if banners else "")),
            "venue": venue_name, "city": venue_city, "address": _clean(venue.get("address")),
        },
        "banners": banners,
        "storyImageUrl": _clean(timelines[0].get("imageUrl")) if timelines else "",
        "closingImageUrl": _clean(
            (timelines[-1].get("imageUrl") if timelines else "")
            or (galleries[0].get("imageUrl") if galleries else "")
            or (banners[-1] if banners else "")
        ),
    }
    schedule = [{"name": _clean(row.get("title")) or "Wedding Event", "time": _format_date(row.get("eventDate"))} for row in active_events[:4]]
    music = wedding.get("music") if isinstance(wedding.get("music"), Mapping) else {}
    music_url = _clean(music.get("sourcePath")) if music.get("enabled", True) else ""

    result: Dict[str, Any] = {
        "template": template, "category": "DreamWedds",
        "couple": {"partnerOne": bride_name, "partnerTwo": groom_name},
        "fields": {
            "partnerOne": bride_name, "partnerTwo": groom_name, "eventDate": wedding_date,
            "venueName": venue_name, "city": venue_city, "dreamwedds": normalized_details,
        },
        "eventDate": wedding_date, "venue": {"name": venue_name, "city": venue_city},
        "message": "Together with their families, they invite you to celebrate their wedding.",
        "photos": photos, "schedule": schedule, "durationInSeconds": 30,
        "tags": ["dreamwedds", culture, f"wedding-{wedding.get('id')}"] if wedding.get("id") else ["dreamwedds", culture],
    }
    if music_url:
        result.update({"musicId": "my-music", "customMusicUrl": music_url})
    return result


def available_dreamwedds_templates() -> List[Dict[str, str]]:
    return [{"culture": culture, "template": template, "templateId": template_id} for (culture, template), template_id in sorted(_TEMPLATE_REGISTRY.items())]
