import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Music, Pause, Play } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";

export const MusicPicker = ({ value, onChange }) => {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/music`);
        if (!cancelled) setTracks(res.data);
      } catch {
        if (!cancelled) setTracks([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  const togglePlay = (track) => {
    if (playingId === track.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(`${BACKEND_URL}${track.url}`);
    audio.volume = 0.7;
    audio.onended = () => setPlayingId(null);
    audio.play().catch(() => setPlayingId(null));
    audioRef.current = audio;
    setPlayingId(track.id);
  };

  return (
    <section>
      <h2 className="section-label mb-4 text-left">05 — Soundtrack</h2>
      <div className="tactile-card p-6">
        <p className="mb-4 text-xs uppercase tracking-[0.15em] text-neutral-500">
          Pick a bundled track or leave silent
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="music-picker-grid">
          <button
            type="button"
            data-testid="music-option-none"
            onClick={() => onChange(null)}
            className={`flex items-center justify-between rounded-lg border p-4 text-left transition ${
              !value
                ? "border-[#0A0A0A] bg-[#0A0A0A] text-white"
                : "border-neutral-300 bg-white hover:border-neutral-500"
            }`}
          >
            <div>
              <div className="text-sm font-semibold">No music</div>
              <div className={`text-xs ${!value ? "text-neutral-400" : "text-neutral-500"}`}>
                Silent invitation
              </div>
            </div>
            <Music className="h-4 w-4 opacity-50" />
          </button>

          {loading && (
            <div className="col-span-full text-center text-xs text-neutral-500">Loading tracks…</div>
          )}

          {tracks.map((t) => {
            const selected = value === t.id;
            const isPlaying = playingId === t.id;
            return (
              <div
                key={t.id}
                data-testid={`music-option-${t.id}`}
                className={`flex items-center justify-between rounded-lg border p-4 transition ${
                  selected
                    ? "border-[#D4AF37] bg-[#0A0A0A] text-white shadow-lg"
                    : "border-neutral-300 bg-white hover:border-neutral-500"
                }`}
              >
                <button
                  type="button"
                  data-testid={`music-select-${t.id}`}
                  onClick={() => onChange(t.id)}
                  className="flex-1 text-left"
                >
                  <div className="text-sm font-semibold">{t.title}</div>
                  <div className={`text-xs ${selected ? "text-neutral-300" : "text-neutral-500"}`}>
                    {t.mood} · {t.duration}s
                  </div>
                  <div className={`mt-0.5 text-[10px] uppercase tracking-[0.12em] ${selected ? "text-neutral-400" : "text-neutral-400"}`}>
                    {t.credit}
                  </div>
                </button>
                <button
                  type="button"
                  data-testid={`music-preview-${t.id}`}
                  onClick={() => togglePlay(t)}
                  className={`ml-3 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition ${
                    selected
                      ? "bg-[#D4AF37] text-black hover:bg-[#e5c04d]"
                      : "bg-neutral-100 text-neutral-800 hover:bg-neutral-200"
                  }`}
                  aria-label={isPlaying ? "Pause preview" : "Play preview"}
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-neutral-400">
          Royalty-free tracks — credits shown on each card. Audio fades in/out over the render.
        </p>
      </div>
    </section>
  );
};
