import pytest

from dreamwedds import available_dreamwedds_templates, normalize_dreamwedds_request


def sample_wedding():
    return {
        "id": 16, "title": "Anjali & Siddhartha", "weddingDate": "2026-12-25T00:00:00Z",
        "weddingCulture": None,
        "backgroundImage": "https://images.test/banner-1.webp,https://images.test/banner-2.webp",
        "brideAndMaids": [{"firstName": "Anjali", "lastName": "Shukla", "isBride": True, "imageUrl": "https://images.test/bride.webp"}],
        "groomAndMen": [{"firstName": "Siddhartha", "lastName": "Pancholi", "isGroom": True, "imageUrl": "https://images.test/groom.webp"}],
        "weddingEvents": [{"title": "Grand Wedding", "eventDate": "2026-12-25T00:00:00Z", "isPrimary": True, "isActive": True, "imageUrl": None, "venue": {"name": "Hotel Landmark", "city": "Gwalior", "address": "Jhansi Road"}}],
        "timeLines": [{"imageUrl": "https://images.test/proposal.webp"}],
        "weddingGalleries": [{"imageUrl": "https://images.test/gallery.webp"}],
        "music": {"enabled": True, "sourcePath": "https://media.test/wedding.mp3"},
    }


def test_normalizes_raw_wedding_for_royal_blush():
    result = normalize_dreamwedds_request(sample_wedding())
    assert result["template"] == "dreamwedds-royal-blush"
    assert result["couple"] == {"partnerOne": "Anjali Shukla", "partnerTwo": "Siddhartha Pancholi"}
    assert result["venue"] == {"name": "Hotel Landmark", "city": "Gwalior"}
    assert result["fields"]["dreamwedds"]["event"]["formattedDate"] == "25 December 2026"
    assert result["fields"]["dreamwedds"]["event"]["imageUrl"] == "https://images.test/banner-2.webp"
    assert result["photos"][:4] == ["https://images.test/banner-1.webp", "https://images.test/bride.webp", "https://images.test/groom.webp", "https://images.test/banner-2.webp"]
    assert result["customMusicUrl"] == "https://media.test/wedding.mp3"


def test_wrapped_request_can_select_images_and_alias_culture():
    result = normalize_dreamwedds_request({"wedding": sample_wedding(), "template": "royal_blush", "weddingCulture": "Hindu", "images": ["https://images.test/chosen.webp"]})
    assert result["photos"] == ["https://images.test/chosen.webp"]
    assert result["fields"]["dreamwedds"]["culture"] == "indian"


def test_rejects_unregistered_culture_template_pair():
    wedding = sample_wedding()
    wedding["weddingCulture"] = "Christian"
    with pytest.raises(ValueError, match="not available for christian weddings"):
        normalize_dreamwedds_request(wedding)


def test_registry_only_advertises_implemented_templates():
    assert available_dreamwedds_templates() == [{"culture": "indian", "template": "royal-blush", "templateId": "dreamwedds-royal-blush"}]
