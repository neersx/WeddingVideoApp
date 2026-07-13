import { useEffect, useState } from "react";
import { Clapperboard, Download, Film, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const Timer = () => {
  const [s, setS] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setS((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return <span className="font-mono">{mm}:{ss}</span>;
};

const STATUS_LABEL = {
  idle: "No render yet",
  queued: "Queued",
  rendering: "Rendering",
  done: "Ready",
  failed: "Failed",
};

const RENDER_MESSAGES = [
  "Setting the scene…",
  "Arranging your photos…",
  "Cueing the music…",
  "Animating your names…",
  "Adding a little sparkle…",
  "Painting the final frames…",
  "Almost ready to celebrate…",
];

const RenderMessages = () => {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % RENDER_MESSAGES.length), 2600);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="mt-4 h-5 overflow-hidden" aria-live="polite">
      <div key={i} className="animate-fade-message text-sm font-medium text-white/90">
        {RENDER_MESSAGES[i]}
      </div>
    </div>
  );
};

export const PreviewPane = ({ rendering, status = "idle", progress = 0, jobId, videoUrl, onRender }) => {
  const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));

  return (
    <div className="sticky top-20 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="section-label text-left text-[#9B256D]">Live output · 1080 × 1920</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F8EAF2] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A4176D]">
          <span className={`h-1.5 w-1.5 rounded-full ${rendering ? "animate-pulse bg-[#EC267D]" : videoUrl ? "bg-emerald-500" : "bg-neutral-400"}`} />
          {STATUS_LABEL[status] || STATUS_LABEL.idle}
        </span>
      </div>

      <div className="group rounded-[1.65rem] bg-gradient-to-br from-[#1a0820] via-[#2a0f33] to-[#50164F] p-2.5 shadow-[0_20px_60px_rgba(50,17,58,0.28)]">
        <div
          className="relative mx-auto aspect-[9/16] w-full max-w-[292px] overflow-hidden rounded-[1.25rem] bg-[#171717] ring-1 ring-white/10"
          data-testid="video-preview-pane"
        >
          {videoUrl ? (
            <video
              key={videoUrl}
              src={videoUrl}
              controls
              playsInline
              className="h-full w-full object-contain"
              data-testid="rendered-video-player"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-neutral-500">
              <Film className="h-10 w-10 transition-transform duration-300 group-hover:scale-110" />
              <span className="text-xs uppercase tracking-[0.2em]" data-testid="render-status-label">
                {STATUS_LABEL[status] || STATUS_LABEL.idle}
              </span>
              <span className="max-w-[180px] text-center text-[11px] leading-relaxed text-neutral-600">
                Your invitation will appear here once you render.
              </span>
            </div>
          )}

          {rendering && (
            <div
              className="absolute inset-0 z-20 flex flex-col items-center justify-center px-6 backdrop-blur-[3px]"
              data-testid="render-progress-indicator"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-[#32113A]/85 via-[#1a0820]/90 to-[#32113A]/85" />
              <div className="shimmer-overlay absolute inset-0" />
              <div className="loader-orb absolute -top-2 left-6 h-16 w-16 rounded-full bg-[#EC267D]/30 blur-xl" />
              <div className="loader-orb absolute bottom-4 right-4 h-20 w-20 rounded-full bg-[#F4B93E]/25 blur-xl [animation-delay:0.8s]" />

              <div className="relative z-10 flex h-20 w-20 items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-white/10" />
                <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[#F4B93E] border-r-[#EC267D] [animation-duration:1.1s]" />
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
                  <Clapperboard className="h-6 w-6 animate-pulse text-white" />
                </div>
              </div>

              <div className="relative z-10 mt-6 w-full max-w-[220px] text-center text-white">
                <div className="font-mono text-4xl font-bold tabular-nums" data-testid="render-progress-percent">
                  {status === "rendering" ? `${pct}%` : "…"}
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#F4B93E] via-[#EC267D] to-[#8A1468] transition-[width] duration-500"
                    style={{ width: status === "rendering" ? `${pct}%` : "8%" }}
                    data-testid="render-progress-bar"
                  />
                </div>
                <RenderMessages />
                <div className="mt-2 text-[11px] uppercase tracking-[0.18em] text-white/50">
                  {STATUS_LABEL[status]} · <Timer />
                </div>
              </div>
            </div>
          )}

          {!rendering && (
            <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-2xl border border-white/10 bg-black/45 px-3 py-2 text-white opacity-0 shadow-lg backdrop-blur transition duration-300 group-hover:opacity-100">
              <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.14em] text-white/60">
                <span>{videoUrl ? "Preview ready" : "Waiting for render"}</span>
                <span>{STATUS_LABEL[status] || STATUS_LABEL.idle}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <Button
        data-testid="render-video-btn"
        onClick={onRender}
        disabled={rendering}
        className="render-btn w-full rounded-full bg-gradient-to-r from-[#6012A8] via-[#C80A76] to-[#E66B24] py-6 text-sm font-semibold uppercase tracking-[0.12em] text-white hover:brightness-105 disabled:opacity-70"
      >
        {rendering ? (
          <span className="inline-flex items-center gap-2">
            <Clapperboard className="h-4 w-4 animate-pulse" />
            Rendering… {status === "rendering" ? `${pct}%` : ""}
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Render Video
          </span>
        )}
      </Button>

      {videoUrl && (
        <a href={videoUrl} download data-testid="download-video-btn" className="block">
          <Button variant="outline" className="w-full rounded-full border-[#E7D4DF] py-6 text-sm font-semibold uppercase tracking-[0.12em] text-[#32113A] hover:bg-[#FFF6FA]">
            <Download className="mr-2 h-4 w-4" /> Download MP4
          </Button>
        </a>
      )}

      {jobId && (
        <p className="text-left text-[11px] uppercase tracking-[0.15em] text-neutral-400" data-testid="job-id-label">
          Job {jobId.slice(0, 8)}
        </p>
      )}

      <p className="text-left text-xs leading-relaxed text-neutral-400">
        The loader stays over this preview while your invitation is queued and rendered. The MP4 appears here automatically.
      </p>
    </div>
  );
};
