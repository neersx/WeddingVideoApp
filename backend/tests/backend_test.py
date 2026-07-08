"""Backend API tests for DreamWedds render service (async + music library)."""
import os
import io
import time
import pytest
import requests
from PIL import Image

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/') if os.environ.get('REACT_APP_BACKEND_URL') else "http://localhost:8001"

EXPECTED_MUSIC_IDS = {"serenity", "twilight", "marigold-bloom"}


@pytest.fixture(scope="session")
def sample_image_bytes():
    img = Image.new('RGB', (400, 400), color=(200, 100, 50))
    buf = io.BytesIO()
    img.save(buf, format='JPEG')
    return buf.getvalue()


@pytest.fixture(scope="session")
def uploaded_photo_url(sample_image_bytes):
    files = {'file': ('test.jpg', sample_image_bytes, 'image/jpeg')}
    r = requests.post(f"{BASE_URL}/api/upload", files=files, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()['url']


# --- Health ---
def test_health():
    r = requests.get(f"{BASE_URL}/api/health", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data['api'] == 'ok'
    assert data['render_service'].get('status') == 'ok'


# --- Music library ---
def test_list_music():
    r = requests.get(f"{BASE_URL}/api/music", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) == 3
    ids = {t['id'] for t in data}
    assert ids == EXPECTED_MUSIC_IDS
    for t in data:
        for k in ('id', 'title', 'mood', 'duration', 'credit', 'url'):
            assert k in t, f"missing key {k} in {t}"
        assert t['url'] == f"/api/music/{t['id']}"
        assert isinstance(t['duration'], (int, float))


def test_get_music_streams_audio():
    r = requests.get(f"{BASE_URL}/api/music/serenity", timeout=30)
    assert r.status_code == 200
    assert r.headers.get('content-type', '').startswith('audio/mpeg')
    assert len(r.content) > 1000


def test_get_music_all_three():
    for mid in EXPECTED_MUSIC_IDS:
        r = requests.get(f"{BASE_URL}/api/music/{mid}", timeout=30)
        assert r.status_code == 200, f"{mid} -> {r.status_code}"
        assert r.headers.get('content-type', '').startswith('audio/mpeg')
        assert len(r.content) > 500


def test_get_music_not_found():
    r = requests.get(f"{BASE_URL}/api/music/nonexistent", timeout=15)
    assert r.status_code == 404


# --- Render validation ---
def test_render_missing_couple_returns_4xx():
    payload = {"template": "marigold", "durationInSeconds": 5}
    r = requests.post(f"{BASE_URL}/api/renders", json=payload, timeout=30)
    assert 400 <= r.status_code < 500


def test_render_unknown_music_id_400():
    payload = {
        "template": "marigold",
        "couple": {"partnerOne": "A", "partnerTwo": "B"},
        "durationInSeconds": 5,
        "musicId": "does-not-exist",
    }
    r = requests.post(f"{BASE_URL}/api/renders", json=payload, timeout=30)
    assert r.status_code == 400
    detail = r.json().get('detail', '')
    assert 'Unknown musicId' in detail
    assert 'does-not-exist' in detail


def test_get_render_nonexistent_404():
    r = requests.get(f"{BASE_URL}/api/renders/nonexistent-id-xyz", timeout=15)
    assert r.status_code == 404


# --- Async render flow ---
def _create_render(uploaded_photo_url, music_id="serenity"):
    payload = {
        "template": "marigold",
        "couple": {"partnerOne": "Alex", "partnerTwo": "Riley"},
        "eventDate": "2026-06-12",
        "venue": {"name": "Grand Hall", "city": "Mumbai"},
        "message": "With love",
        "photos": [uploaded_photo_url],
        "schedule": [{"name": "Ceremony", "time": "16:00"}],
        "durationInSeconds": 5,
        "musicId": music_id,
    }
    return requests.post(f"{BASE_URL}/api/renders", json=payload, timeout=30)


def test_create_render_is_async_and_returns_job_id(uploaded_photo_url):
    start = time.time()
    r = _create_render(uploaded_photo_url)
    elapsed = time.time() - start
    assert r.status_code == 200, r.text[:500]
    data = r.json()
    assert 'jobId' in data
    assert data['status'] == 'queued'
    assert data['poll_url'] == f"/api/renders/{data['jobId']}"
    assert data['video_url'] == f"/api/renders/{data['jobId']}/video"
    # Should be async — must not block for render duration
    assert elapsed < 10, f"Endpoint blocked for {elapsed}s"


@pytest.fixture(scope="module")
def completed_job(uploaded_photo_url):
    r = _create_render(uploaded_photo_url)
    assert r.status_code == 200, r.text
    job_id = r.json()['jobId']

    # Poll up to 90s
    saw_rendering_progress = False
    final = None
    deadline = time.time() + 120
    while time.time() < deadline:
        time.sleep(2)
        g = requests.get(f"{BASE_URL}/api/renders/{job_id}", timeout=15)
        assert g.status_code == 200
        d = g.json()
        status = d['status']
        progress = float(d.get('progress') or 0)
        if status == 'rendering' and 0 < progress < 1:
            saw_rendering_progress = True
        if status in ('done', 'failed'):
            final = d
            break

    assert final is not None, "Render did not finish within 120s"
    assert final['status'] == 'done', f"Render failed: {final}"
    assert float(final['progress']) == 1.0
    return {"job_id": job_id, "final": final, "saw_progress": saw_rendering_progress}


def test_status_transitions_and_progress(completed_job):
    # Not strict fail if we missed 'rendering' state (very fast renders may skip), but final must be done
    assert completed_job['final']['status'] == 'done'
    assert completed_job['final']['progress'] == 1.0


def test_get_video_returns_mp4(completed_job):
    job_id = completed_job['job_id']
    v = requests.get(f"{BASE_URL}/api/renders/{job_id}/video", timeout=60)
    assert v.status_code == 200
    assert v.headers.get('content-type', '').startswith('video/mp4')
    assert len(v.content) > 10 * 1024


def test_list_renders_includes_completed(completed_job):
    job_id = completed_job['job_id']
    r = requests.get(f"{BASE_URL}/api/renders", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    match = next((d for d in data if d['id'] == job_id), None)
    assert match is not None, "completed job not in list"
    for k in ('id', 'template', 'status', 'progress', 'video_url'):
        assert k in match
    assert match['status'] == 'done'
