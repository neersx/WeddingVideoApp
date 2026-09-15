import unittest
from unittest.mock import patch

import server


class TemplateClassificationTests(unittest.TestCase):
    def test_legacy_template_gets_backward_compatible_facets_and_screens(self):
        serialized = server._serialize_template({
            "_id": "legacy",
            "name": "Legacy",
            "category": "Wedding",
            "style": "Royal Traditional",
        })
        self.assertEqual(serialized["category"], "Wedding")
        self.assertEqual(serialized["primaryCategoryId"], "wedding")
        self.assertEqual(serialized["facets"]["occasions"], ["wedding"])
        self.assertEqual(serialized["facets"]["styles"], ["royal-traditional"])
        self.assertEqual(serialized["screens"][0]["role"], "first")

    def test_screen_selectors_match_roles_and_stable_ids(self):
        opening = {"id": "opening", "role": "first"}
        photos = {"id": "photos", "role": "center"}
        self.assertTrue(server._selector_matches_screen({"mode": "all"}, opening))
        self.assertTrue(server._selector_matches_screen({"mode": "first"}, opening))
        self.assertTrue(server._selector_matches_screen({"mode": "selected", "screenIds": ["photos"]}, photos))
        self.assertFalse(server._selector_matches_screen({"mode": "all-except", "screenIds": ["photos"]}, photos))


class TemplateThemeResolutionTests(unittest.IsolatedAsyncioTestCase):
    async def test_bundled_backgrounds_are_seeded_as_published_assets(self):
        memory_db = server._InMemoryDB()
        await memory_db.media_assets.insert_one({
            "_id": "asset-ivory-chapel-mobile-long",
            "id": "asset-ivory-chapel-mobile-long",
            "name": "Admin renamed asset",
            "filename": "stale.png",
            "checksum": "sha256:stale",
            "tags": ["custom"],
            "status": "archived",
            "version": 3,
        })
        with patch.object(server, "db", memory_db):
            await server.seed_bundled_template_assets()
            await server.seed_bundled_template_assets()

        assets = await memory_db.media_assets.find().to_list(10)
        refreshed = await memory_db.media_assets.find_one({"_id": "asset-ivory-chapel-mobile-long"})
        self.assertEqual(len(assets), 8)
        self.assertTrue(all(asset["type"] == "image" for asset in assets))
        self.assertEqual(refreshed["name"], "Admin renamed asset")
        self.assertEqual(refreshed["tags"], ["custom"])
        self.assertEqual(refreshed["status"], "archived")
        self.assertEqual(refreshed["filename"], "ivory-chapel-mobile-long.png")
        self.assertEqual(refreshed["version"], 4)
        self.assertNotEqual(refreshed["checksum"], "sha256:stale")

    async def test_asset_delete_is_guarded_until_assignments_are_removed(self):
        memory_db = server._InMemoryDB()
        await memory_db.media_assets.insert_one({
            "_id": "asset-used",
            "id": "asset-used",
            "name": "Used asset",
            "filename": "does-not-exist.webp",
            "status": "draft",
        })
        await memory_db.template_asset_placements.insert_one({
            "_id": "placement-used",
            "id": "placement-used",
            "templateId": "template-one",
            "assetId": "asset-used",
        })
        admin = server.GoogleUser(sub="admin", email="admin@example.com")

        with patch.object(server, "db", memory_db):
            with self.assertRaises(server.HTTPException) as blocked:
                await server.admin_delete_template_asset("asset-used", admin)
            self.assertEqual(blocked.exception.status_code, 409)

            await memory_db.template_asset_placements.delete_one({"_id": "placement-used"})
            result = await server.admin_delete_template_asset("asset-used", admin)

        self.assertTrue(result["deleted"])
        self.assertIsNone(await memory_db.media_assets.find_one({"_id": "asset-used"}))

    async def test_admin_template_update_saves_editable_fields_atomically(self):
        memory_db = server._InMemoryDB()
        await memory_db.templates.insert_one({"_id": "editable", "id": "editable", "name": "Old", "category": "Wedding", "settings": {"maxImages": 4, "maxSlides": 4, "durations": [10]}})
        request = server.TemplateUpdateRequest(
            name="New Name",
            desc="Updated description",
            style="Palace",
            category="Wedding",
            primaryCategoryId="wedding",
            facets={"themes": ["palace"], "cultures": ["hindu"]},
            bg="#112233",
            text="#FFFFFF",
            font="Georgia, serif",
            swatch=["#112233", "#FFFFFF"],
            screens=[{"id": "opening", "role": "first", "label": "Opening"}, {"id": "closing", "role": "last", "label": "Closing"}],
            settings={"minImages": 1, "maxImages": 6, "maxSlides": 6, "durations": [10, 20], "captionPerImage": False},
            qualityProfile={"crf": 18, "jpegQuality": 90, "x264Preset": "slow"},
        )
        admin = server.GoogleUser(sub="admin", email="admin@example.com")
        with patch.object(server, "db", memory_db):
            result = await server.admin_update_template("editable", request, admin)
        self.assertEqual(result["name"], "New Name")
        self.assertEqual(result["facets"]["themes"], ["palace"])
        self.assertEqual(result["settings"]["maxImages"], 6)
        self.assertEqual(result["qualityProfile"]["crf"], 18)
        self.assertEqual(len(result["screens"]), 2)

    async def test_bumps_asset_set_version_without_replacing_template(self):
        memory_db = server._InMemoryDB()
        await memory_db.templates.insert_one({"_id": "marigold", "assetSetVersion": 1, "category": "Wedding"})
        with patch.object(server, "db", memory_db):
            version = await server._bump_template_asset_version("marigold")
        updated = await memory_db.templates.find_one({"_id": "marigold"})
        self.assertEqual(version, 2)
        self.assertEqual(updated["category"], "Wedding")

    async def test_resolves_only_published_assets_to_selected_screens(self):
        memory_db = server._InMemoryDB()
        template = {
            "_id": "engagement-glow",
            "id": "engagement-glow",
            "assetSetVersion": 3,
            "screens": server.DEFAULT_TEMPLATE_SCREENS,
        }
        await memory_db.templates.insert_one(template)
        await memory_db.media_assets.insert_one({
            "_id": "asset-petals",
            "id": "asset-petals",
            "name": "Petals",
            "type": "video",
            "mimeType": "video/webm",
            "filename": "petals.webm",
            "status": "published",
        })
        await memory_db.media_assets.insert_one({
            "_id": "asset-draft",
            "id": "asset-draft",
            "name": "Draft",
            "type": "image",
            "status": "draft",
        })
        await memory_db.template_asset_placements.insert_one({
            "_id": "placement-petals",
            "id": "placement-petals",
            "templateId": "engagement-glow",
            "assetId": "asset-petals",
            "layer": "overlay",
            "screenSelector": {"mode": "selected", "screenIds": ["opening", "closing"]},
            "isActive": True,
        })
        await memory_db.template_asset_placements.insert_one({
            "_id": "placement-draft",
            "id": "placement-draft",
            "templateId": "engagement-glow",
            "assetId": "asset-draft",
            "layer": "background",
            "screenSelector": {"mode": "all", "screenIds": []},
            "isActive": True,
        })

        with patch.object(server, "db", memory_db):
            theme = await server.resolve_template_theme(template)

        self.assertEqual(theme["version"], 3)
        self.assertEqual(theme["assetIds"], ["asset-petals"])
        self.assertEqual(len(theme["screens"]["opening"]["layers"]["overlay"]), 1)
        self.assertEqual(len(theme["screens"]["closing"]["layers"]["overlay"]), 1)
        self.assertNotIn("overlay", theme["screens"]["photos"]["layers"])
        self.assertNotIn("background", theme["screens"]["opening"]["layers"])


if __name__ == "__main__":
    unittest.main()
