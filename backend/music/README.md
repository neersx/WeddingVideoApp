# Bundled Royalty-Free Music Library

Five real royalty-free tracks are bundled with DreamWedds. Metadata (title, mood, credit, duration) is defined in `MUSIC_LIBRARY` inside `/app/backend/server.py`. Track ids are stable — the frontend and payload use them.

| id                     | title                    | mood                     | length | credit                  |
|------------------------|--------------------------|--------------------------|--------|-------------------------|
| tere-sang (default)    | Tere Sang (With You)     | Hindi · Romantic ballad  | 2:00   | Selectric Music & Lyrics|
| wedding-romantic       | Wedding Romantic         | Cinematic · Ceremony     | 1:26   | Leberch                 |
| romantic-adventure     | Romantic Adventure       | Uplifting · Cinematic    | 2:20   | Paul Yudin              |
| romantic               | Romantic                 | Soft · Intimate          | 0:35   | PrettyJohn1             |
| hindi-love-rap         | Hindi Love Rap           | Trap · Hip-hop duet      | 3:30   | Rahul Sapkal            |

To swap or add tracks: drop the mp3 in this folder, update `MUSIC_LIBRARY` in `server.py`, and (optionally) change the default in `/app/frontend/src/App.js` (`useState("tere-sang")`).
