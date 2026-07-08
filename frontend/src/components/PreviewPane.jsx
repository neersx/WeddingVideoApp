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

export const PreviewPane = ({ template, rendering, videoUrl, onRender }) => {
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
              <span className="text-xs uppercase tracking-[0.2em]">
                {rendering ? "Rendering" : "No render yet"}
              </span>
            </div>
          )}
          {rendering && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70">
              <div className="shimmer-overlay absolute inset-0" />
              <Clapperboard className="h-8 w-8 animate-pulse text-[#D4AF37]" />
              <div className="z-10 text-center text-sm text-white" data-testid="render-progress-indicator">
                <div>Rendering {template} template…</div>
                <div className="mt-1 text-xs text-neutral-400">
                  Elapsed <Timer /> — this can take a few minutes
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
        {rendering ? "Rendering…" : "Render Video"}
      </Button>

      {videoUrl && (
        <a href={videoUrl} download data-testid="download-video-btn" className="block">
          <Button variant="outline" className="w-full rounded-full py-6 text-sm uppercase tracking-[0.15em]">
            <Download className="mr-2 h-4 w-4" /> Download MP4
          </Button>
        </a>
      )}

      <p className="text-left text-xs leading-relaxed text-neutral-400">
        The render-service receives your JSON, composes the video with Remotion and returns an MP4. Tip: use the 10s length for a quick test render.
      </p>
    </div>
  );
};
