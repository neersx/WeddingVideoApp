import { useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { API } from "@/App";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";

// Captions are keyed by photo index (not URL) so the "Message for photo 1"
// textbox can be shown — and even filled in — before the first upload exists.
export const PhotoUploader = ({
  photos,
  onChange,
  maxImages = 4,
  minImages = 1,
  captionPerImage = false,
  captions = [],
  onCaptionsChange,
  captionMaxLength = 70,
}) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files) => {
    const remaining = maxImages - photos.length;
    const selected = Array.from(files).slice(0, remaining);
    if (selected.length === 0) return;
    setUploading(true);
    try {
      const urls = [];
      for (const file of selected) {
        const form = new FormData();
        form.append("file", file);
        const res = await axios.post(`${API}/upload`, form);
        urls.push(res.data.url);
      }
      onChange([...photos, ...urls]);
      toast.success(`${urls.length} photo(s) uploaded`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeAt = (index) => {
    onChange(photos.filter((_, i) => i !== index));
    if (onCaptionsChange) onCaptionsChange(captions.filter((_, i) => i !== index));
  };

  const setCaption = (index, value) => {
    if (!onCaptionsChange) return;
    const next = [...captions];
    next[index] = value;
    onCaptionsChange(next);
  };

  const captionInput = (index, { pending = false } = {}) => (
    <Input
      value={captions[index] || ""}
      onChange={(e) => setCaption(index, e.target.value)}
      maxLength={captionMaxLength}
      placeholder={pending ? "Message for photo 1… (write it now or after upload)" : `Message for photo ${index + 1}… (required)`}
      className={cn(
        "h-9 text-xs",
        !pending && !(captions[index] || "").trim() && "border-[#E45C7A] focus-visible:ring-[#E45C7A]",
      )}
    />
  );

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="section-label text-left">04 — Photos ({photos.length}/{maxImages})</h2>
        <span className={cn("text-[11px] font-semibold", photos.length < minImages ? "text-[#C80A76]" : "text-emerald-600")}>
          {photos.length < minImages
            ? `Add at least ${minImages} photo${minImages > 1 ? "s" : ""} to continue`
            : "Ready to continue"}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-3">
        {photos.map((url, i) => (
          <div key={url} className="space-y-1.5">
            <div className="group relative aspect-square overflow-hidden rounded-lg border border-black/10">
              <img src={`${BACKEND_URL}${url}`} alt={`upload-${i}`} className="h-full w-full object-cover" />
              <span className="absolute left-1.5 top-1.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-white">{i + 1}</span>
              <button
                type="button"
                data-testid={`remove-photo-btn-${i}`}
                onClick={() => removeAt(i)}
                className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            {captionPerImage && captionInput(i)}
          </div>
        ))}
        {photos.length < maxImages && (
          <div className="space-y-1.5">
            <button
              type="button"
              data-testid="photo-upload-btn"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className={cn(
                "flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed bg-[#FFF8FB] text-neutral-400 transition hover:border-[#B6548F] hover:text-[#A4176D]",
                photos.length < minImages ? "border-[#E092B4]" : "border-[#D9A9C6]",
              )}
            >
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
              <span className="px-1 text-center text-[10px] uppercase tracking-[0.08em]">
                {uploading ? "Uploading…" : photos.length < minImages ? "Add photo (required)" : "Add photo"}
              </span>
            </button>
            {/* First slot shows its message box up front so users know each photo
                carries a caption; typing before uploading is fine (index-paired). */}
            {captionPerImage && photos.length === 0 && captionInput(0, { pending: true })}
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        data-testid="photo-file-input"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <p className="mt-3 text-left text-[11px] leading-relaxed text-neutral-400">
        Photos appear as a slideshow in the middle of the video. JPG/PNG/WebP, up to {maxImages} images.
        {captionPerImage ? " Each photo needs a short message — it appears on screen with that photo." : ""}
      </p>
    </section>
  );
};
