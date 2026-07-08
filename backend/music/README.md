# Bundled Royalty-Free Music Library

The three files in this folder are **placeholder demo tracks** generated with ffmpeg sine-wave chords so the music picker can be demoed end-to-end without external assets. They are simple ambient tones (C-major, A-minor, F-major triads) and are intentionally low volume.

To ship a production experience, replace each `.mp3` with a real CC0 / royalty-free instrumental loop of ~30s at 128 kbps. Keep the same filenames so the API keeps working:

- `serenity.mp3`       — soft, dawn-like piano (C major)
- `twilight.mp3`       — warm, evening strings (A minor)
- `marigold-bloom.mp3` — bright, celebratory chords (F major)

The track metadata (title, mood, length, credit) is defined in `/app/backend/server.py` inside the `MUSIC_LIBRARY` constant. Update credit/attribution strings when swapping files.
