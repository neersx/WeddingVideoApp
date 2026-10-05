import unittest

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


class DreamWeddsNormalizationTests(unittest.TestCase):
    def test_normalizes_raw_wedding_for_royal_blush(self):
        result = normalize_dreamwedds_request(sample_wedding())
        assert result["template"] == "dreamwedds-royal-blush"
        assert result["couple"] == {"partnerOne": "Anjali Shukla", "partnerTwo": "Siddhartha Pancholi"}
        assert result["venue"] == {"name": "Hotel Landmark", "city": "Gwalior"}
        assert result["fields"]["dreamwedds"]["event"]["formattedDate"] == "25 December 2026"
        assert result["fields"]["dreamwedds"]["event"]["imageUrl"] == "https://images.test/banner-2.webp"
        assert result["photos"][:4] == ["https://images.test/banner-1.webp", "https://images.test/bride.webp", "https://images.test/groom.webp", "https://images.test/banner-2.webp"]
        assert result["customMusicUrl"] == "https://media.test/wedding.mp3"


    def test_wrapped_request_can_select_images_and_alias_culture(self):
        result = normalize_dreamwedds_request({"wedding": sample_wedding(), "template": "royal_blush", "weddingCulture": "Hindu", "images": ["https://images.test/chosen.webp"]})
        assert result["photos"] == ["https://images.test/chosen.webp"]
        assert result["fields"]["dreamwedds"]["culture"] == "indian"


    def test_muslim_wedding_uses_emerald_nikah_with_royal_blush_data_contract(self):
        result = normalize_dreamwedds_request({
            "wedding": sample_wedding(),
            "template": "Emrald Nikash",
            "weddingCulture": "Islamic",
        })
        assert result["template"] == "dreamwedds-emerald-nikah"
        assert result["category"] == "DreamWedds"
        assert result["couple"] == {"partnerOne": "Anjali Shukla", "partnerTwo": "Siddhartha Pancholi"}
        assert result["fields"]["dreamwedds"]["culture"] == "muslim"
        assert result["fields"]["dreamwedds"]["event"]["venue"] == "Hotel Landmark"
        assert result["durationInSeconds"] == 50

        raw_wedding = sample_wedding()
        raw_wedding["weddingCulture"] = "Muslim"
        assert normalize_dreamwedds_request(raw_wedding)["template"] == "dreamwedds-emerald-nikah"


    def test_emerald_nikah_duration_grows_with_selected_images(self):
        result = normalize_dreamwedds_request({
            "wedding": sample_wedding(),
            "template": "emerald-nikah",
            "weddingCulture": "Muslim",
            "images": [f"https://images.test/couple-{index}.webp" for index in range(8)],
        })
        assert result["durationInSeconds"] == 58
        assert len(result["photos"]) == 8


    def test_christian_and_english_cultures_use_reusable_royal_blush(self):
        for culture in ["English", "Christian", "British", "Buddhist", "Unknown"]:
            result = normalize_dreamwedds_request({"wedding": sample_wedding(), "weddingCulture": culture, "weddingTradition": "Christian"})
            assert result["template"] == "dreamwedds-royal-blush"
            assert result["fields"]["weddingTradition"] == "Christian"
            assert result["fields"]["dreamwedds"]["tradition"] == "Christian"


    def test_explicit_style_and_missing_culture_are_preserved(self):
        result = normalize_dreamwedds_request({"wedding": sample_wedding(), "videoStyle": "forest-gold"})
        assert result["fields"]["videoStyle"] == "forest-gold"
        assert result["fields"]["dreamwedds"]["videoStyle"] == "forest-gold"
        assert result["fields"]["weddingCulture"] == "neutral"


    def test_rejects_unregistered_template(self):
        with self.assertRaisesRegex(ValueError, "not available"):
            normalize_dreamwedds_request({"wedding": sample_wedding(), "template": "missing-design"})


    def test_registry_only_advertises_implemented_templates(self):
        available = available_dreamwedds_templates()
        for culture in ["indian", "english", "christian", "buddhist", "muslim", "neutral"]:
            assert {"culture": culture, "template": "royal-blush", "templateId": "dreamwedds-royal-blush"} in available
        assert {"culture": "muslim", "template": "emerald-nikah", "templateId": "dreamwedds-emerald-nikah"} in available
