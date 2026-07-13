import { useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { ImagePlus, Loader2, X } from "lucide-react";
import { API } from "@/App";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";

export const PhotoUploader = ({ photos, onChange }) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files) => {
    const remaining = 4 - photos.length;
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

  return (
    <section>
      <h2 className="section-label mb-3 text-left">04 — Photos ({photos.length}/4)</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
        {photos.map((url, i) => (
          <div key={url} className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-black/10">
            <img src={`${BACKEND_URL}${url}`} alt={`upload-${i}`} className="h-full w-full object-cover" />
            <button
              type="button"
              data-testid={`remove-photo-btn-${i}`}
              onClick={() => onChange(photos.filter((p) => p !== url))}
              className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {photos.length < 4 && (
          <button
            type="button"
            data-testid="photo-upload-btn"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#D9A9C6] bg-[#FFF8FB] text-neutral-400 transition hover:border-[#B6548F] hover:text-[#A4176D]"
          >
            {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
            <span className="text-xs uppercase tracking-[0.1em]">{uploading ? "Uploading..." : "Add photo"}</span>
          </button>
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
        Photos appear as a Ken Burns slideshow in the middle of the video. Up to 4 images (JPG/PNG/WebP).
      </p>
    </section>
  );
};
