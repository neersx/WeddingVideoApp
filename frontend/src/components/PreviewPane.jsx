import { useEffect, useState } from "react";
import { Clapperboard, Download, Film } from "lucide-react";
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

export const PreviewPane = ({ template, rendering, status = "idle", progress = 0, jobId, videoUrl, onRender }) => {
  const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));

  return (
    <div className="sticky top-24 space-y-6">
      <h2 className="section-label text-left">Output — 1080 × 1920</h2>
      <div className="rounded-xl bg-[#0A0A0A] p-4 shadow-2xl">
        <div
          className="relative mx-auto aspect-[9/16] w-full max-w-[320px] overflow-hidden rounded-lg bg-[#171717]"
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
              <Film className="h-10 w-10" />
              <span className="text-xs uppercase tracking-[0.2em]" data-testid="render-status-label">
                {STATUS_LABEL[status] || STATUS_LABEL.idle}
              </span>
            </div>
          )}
          {rendering && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70 px-6">
              <div className="shimmer-overlay absolute inset-0" />
              <Clapperboard className="h-8 w-8 animate-pulse text-[#D4AF37]" />
              <div className="z-10 w-full text-center text-sm text-white" data-testid="render-progress-indicator">
                <div className="uppercase tracking-[0.2em] text-[11px] text-neutral-400">
                  {STATUS_LABEL[status]}
                </div>
                <div className="mt-1 font-mono text-2xl" data-testid="render-progress-percent">
                  {status === "rendering" ? `${pct}%` : "…"}
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                  <div
                    className="h-full bg-[#D4AF37] transition-[width] duration-500"
                    style={{ width: status === "rendering" ? `${pct}%` : "8%" }}
                    data-testid="render-progress-bar"
                  />
                </div>
                <div className="mt-2 text-[11px] text-neutral-400">
                  Elapsed <Timer />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Button
        data-testid="render-video-btn"
        onClick={onRender}
        disabled={rendering}
        className="render-btn w-full rounded-full bg-[#0A0A0A] py-6 text-sm uppercase tracking-[0.15em] text-white hover:bg-[#0A0A0A]"
      >
        {rendering ? `Rendering… ${status === "rendering" ? `${pct}%` : ""}` : "Render Video"}
      </Button>

      {videoUrl && (
        <a href={videoUrl} download data-testid="download-video-btn" className="block">
          <Button variant="outline" className="w-full rounded-full py-6 text-sm uppercase tracking-[0.15em]">
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
        Renders run asynchronously — a job id is issued instantly and the UI polls status until the MP4 is ready.
      </p>
    </div>
  );
};
