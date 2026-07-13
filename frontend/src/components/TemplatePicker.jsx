import { Check } from "lucide-react";

export const TemplatePicker = ({ value, onChange }) => {
  const templates = [
    {
      id: "marigold",
      name: "Marigold",
      desc: "Rustic-luxe traditional. Burnt orange, gold, floating petals.",
      swatch: ["#C55A36", "#D4AF37", "#F8AB5B", "#FFF8F0"],
      bg: "#FFF8F0",
      text: "#4A2545",
      font: "'Playfair Display', serif",
    },
    {
      id: "midnight",
      name: "Midnight",
      desc: "Dark romance. Cinematic black, gold typography, starfield.",
      swatch: ["#0B0B0F", "#2B1B3D", "#D4AF37", "#7A5C9E"],
      bg: "#0B0B0F",
      text: "#E7D9F2",
      font: "'Cormorant Garamond', serif",
    },
    {
      id: "heartbeat",
      name: "Heartbeat",
      desc: "Beating heart intro, blush photobook with floating date bar, romantic invitation.",
      swatch: ["#B4405F", "#F5D0D8", "#C7A365", "#FFF7F0"],
      bg: "#FFF7F0",
      text: "#7A1E3A",
      font: "'Dancing Script', cursive",
    },
    {
      id: "story",
      name: "Story",
      desc: "Editorial full-bleed photos, huge bold date reveal, chapter-by-chapter invitation.",
      swatch: ["#7A9B76", "#F4EFE6", "#A67B39", "#1F1F1F"],
      bg: "#1F1F1F",
      text: "#F4EFE6",
      font: "'Cormorant Garamond', serif",
    },
    {
      id: "poster",
      name: "Poster",
      desc: "Bauhaus-modern. Bold monogram, geometric mosaic, red/yellow accents, editorial punch.",
      swatch: ["#E63946", "#F4C542", "#264653", "#F2EEE5"],
      bg: "#F2EEE5",
      text: "#0A0A0A",
      font: "'Archivo Black', sans-serif",
    },
    {
      id: "showcase",
      name: "Showcase",
      desc: "Premium promo. Three animated wedding-website heroes with cinematic camera moves, live RSVP & countdown, DreamWedds logo outro.",
      swatch: ["#0E0D0B", "#B08D57", "#7A9B76", "#F5EFE2"],
      bg: "#0E0D0B",
      text: "#B08D57",
      font: "'Playfair Display', serif",
    },
  ];

  const selected = templates.find((t) => t.id === value);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="section-label text-left">01 — Template</h2>
        {selected && (
          <span className="text-xs font-medium text-neutral-500">
            Selected: <span className="font-semibold text-[#A4176D]">{selected.name}</span>
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {templates.map((t) => {
          const isSelected = value === t.id;
          return (
            <button
              key={t.id}
              type="button"
              data-testid={`template-selector-${t.id}`}
              aria-pressed={isSelected}
              title={t.desc}
              onClick={() => onChange(t.id)}
              className={`group relative overflow-hidden rounded-xl border bg-white text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                isSelected
                  ? "border-[#C80A76] ring-2 ring-[#C80A76] ring-offset-1"
                  : "border-black/10 hover:border-[#D9A9C6]"
              }`}
            >
              <div
                className="flex h-16 items-center justify-center"
                style={{ backgroundColor: t.bg }}
              >
                <span
                  className="truncate px-2 text-lg italic"
                  style={{ color: t.text, fontFamily: t.font }}
                >
                  {t.name}
                </span>
              </div>
              {isSelected && (
                <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#C80A76] text-white shadow-sm">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
              <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                <span className="font-heading text-sm font-extrabold tracking-tight text-[#32113A]">{t.name}</span>
                <span className="flex gap-1">
                  {t.swatch.slice(0, 4).map((c) => (
                    <span
                      key={c}
                      className="h-2.5 w-2.5 rounded-full border border-black/10"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
