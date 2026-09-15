import { useEffect, useState } from "react";
import { Clapperboard, Download, Loader2, Play, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// A plain `<a href download>` is silently ignored by browsers for cross-origin
// URLs (frontend and backend run on different origins in local dev), so the
// click would just open the video instead of downloading it. Fetching the
// file as a blob and downloading via an object URL works regardless of origin.
async function downloadVideoFile(videoUrl) {
  const separator = videoUrl.includes("?") ? "&" : "?";
  const response = await fetch(`${videoUrl}${separator}download=1`);
  if (!response.ok) throw new Error("Download failed");
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = "invitavideos-reel.mp4";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

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

export const PreviewPane = ({ rendering, status = "idle", progress = 0, jobId, videoUrl, onRender, onReset, canRender = true, renderHint = "", template, details, category = "Wedding" }) => {
  const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
  const [downloading, setDownloading] = useState(false);
  const previewTitle = category === "Birthday"
    ? `${details?.partnerOne || "Your"} ${details?.partnerTwo || "Celebration"}`
    : `${details?.partnerOne || "Aisha"} & ${details?.partnerTwo || "Rohan"}`;
  const previewBackground = template?.bg || "#4A1635";
  const previewAccent = template?.swatch?.[1] || "#D4AF37";
  const previewText = template?.text || "#FFF8F0";

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadVideoFile(videoUrl);
    } catch {
      toast.error("Could not download the video. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="sticky top-20 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-editorial text-xl font-semibold text-[#4A1635]">Video preview</h2>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#A5949C]">Vertical · 1080 × 1920</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E6D7DE] bg-white px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#7E294F]">
          <span className={`h-1.5 w-1.5 rounded-full ${rendering ? "animate-pulse bg-[#EC267D]" : videoUrl ? "bg-emerald-500" : "bg-neutral-400"}`} />
          {STATUS_LABEL[status] || STATUS_LABEL.idle}
        </span>
      </div>

      <div className="group rounded-[1.65rem] border border-[#E4D6D0] bg-white p-2.5 shadow-[0_20px_50px_rgba(74,22,53,0.14)]">
        <div
          className="relative mx-auto aspect-[9/16] w-full max-w-[292px] overflow-hidden rounded-[1.25rem] bg-[#171717] ring-1 ring-black/10"
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
            <div
              className="preview-placeholder relative flex h-full flex-col items-center justify-center overflow-hidden px-6 text-center"
              style={{ "--preview-bg": previewBackground, "--preview-accent": previewAccent, "--preview-text": previewText, backgroundColor: previewBackground }}
            >
              <div className="preview-placeholder-glow absolute inset-0" />
              <div className="absolute inset-4 rounded-t-full border border-white/20" />
              <div className="absolute left-1/2 top-[18%] h-16 w-px -translate-x-1/2 bg-white/25" />
              <div className="absolute left-6 right-6 top-8 flex justify-between text-xl opacity-55" style={{ color: previewAccent }} aria-hidden="true"><span>✦</span><span>✦</span></div>
              <div className="relative z-10">
                <span className="text-[9px] font-bold uppercase tracking-[0.3em] opacity-70" style={{ color: previewText }}>{template?.name || "Your invitation"}</span>
                <h3 className="mt-5 font-editorial text-3xl font-medium leading-tight" style={{ color: previewText }}>{previewTitle}</h3>
                <div className="mx-auto my-5 flex items-center justify-center gap-2" aria-hidden="true">
                  <span className="h-px w-9" style={{ backgroundColor: previewAccent }} />
                  <span className="text-xs" style={{ color: previewAccent }}>◆</span>
                  <span className="h-px w-9" style={{ backgroundColor: previewAccent }} />
                </div>
                <p className="text-[10px] font-medium uppercase leading-5 tracking-[0.2em] opacity-75" style={{ color: previewText }}>
                  {category === "Birthday" ? "Join us to celebrate" : "Together with their families"}
                </p>
                <p className="mt-2 font-editorial text-sm italic opacity-80" style={{ color: previewText }}>{details?.eventDate}</p>
              </div>
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[8px] font-bold uppercase tracking-[0.24em] opacity-60" style={{ color: previewText }} data-testid="render-status-label">Live preview</div>
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
            <div className="pointer-events-none absolute inset-x-3 top-3 rounded-2xl border border-white/10 bg-black/45 px-3 py-2 text-white opacity-0 shadow-lg backdrop-blur transition duration-300 group-hover:opacity-100">
              <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.14em] text-white/60">
                <span>{videoUrl ? "Preview ready" : "Waiting for render"}</span>
                <span>{STATUS_LABEL[status] || STATUS_LABEL.idle}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-[#E6DAD5] bg-white px-4 py-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-[#4A1635]">{template?.name || "Template"}</span>
          <span className="text-[#897981]">{details?.durationInSeconds || 30} seconds · 9:16</span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F8EDF2] text-[#8E2758]"><Play className="ml-0.5 h-3.5 w-3.5 fill-current" /></span>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#EEE6E1]"><div className="h-full w-[12%] rounded-full bg-[#8E2758]" /></div>
          <span className="text-[10px] tabular-nums text-[#9A8991]">00:00</span>
        </div>
      </div>

      {/* Before a video exists: show Render. Once it's ready: Download + Create New. */}
      {!videoUrl ? (
        <>
          <Button
            data-testid="render-video-btn"
            onClick={onRender}
            disabled={rendering || !canRender}
            className="render-btn w-full rounded-full bg-[#8E2758] py-6 text-sm font-semibold uppercase tracking-[0.12em] text-white shadow-[0_12px_26px_rgba(142,39,88,0.22)] hover:bg-[#731D46] disabled:opacity-60"
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
          {!rendering && !canRender && renderHint && (
            <p className="text-center text-[11px] font-medium text-[#C80A76]" data-testid="render-disabled-hint">
              {renderHint}
            </p>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <Button
            data-testid="download-video-btn"
            onClick={handleDownload}
            disabled={downloading}
            className="w-full rounded-full bg-[#8E2758] py-6 text-sm font-semibold uppercase tracking-[0.12em] text-white hover:bg-[#731D46] disabled:opacity-70"
          >
            {downloading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Preparing download…
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Download className="h-4 w-4" /> Download Video
              </span>
            )}
          </Button>
          <Button
            variant="outline"
            data-testid="create-new-reel-btn"
            onClick={onReset}
            className="w-full rounded-full border-[#E7D4DF] py-6 text-sm font-semibold uppercase tracking-[0.12em] text-[#32113A] hover:bg-[#FFF6FA]"
          >
            <Sparkles className="mr-2 h-4 w-4" /> Create New Reel
          </Button>
        </div>
      )}

      {jobId && (
        <p className="text-left text-[11px] uppercase tracking-[0.15em] text-neutral-400" data-testid="job-id-label">
          Job {jobId.slice(0, 8)}
        </p>
      )}

      <p className="text-center text-[11px] leading-relaxed text-[#9A8991]">
        Your finished MP4 will appear here automatically after rendering.
      </p>
    </div>
  );
};
