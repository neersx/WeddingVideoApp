import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";

export const DEFAULT_TEMPLATES = [
  {
    id: "marigold",
    name: "Marigold",
    desc: "Rustic-luxe traditional. Burnt orange, gold, floating petals.",
    category: "Wedding",
    swatch: ["#C55A36", "#D4AF37", "#F8AB5B", "#FFF8F0"],
    bg: "#FFF8F0",
    text: "#4A2545",
    font: "'Playfair Display', serif",
    isActive: true,
    sortOrder: 10,
  },
  {
    id: "midnight",
    name: "Midnight",
    desc: "Dark romance. Cinematic black, gold typography, starfield.",
    category: "Wedding",
    swatch: ["#0B0B0F", "#2B1B3D", "#D4AF37", "#7A5C9E"],
    bg: "#0B0B0F",
    text: "#E7D9F2",
    font: "'Cormorant Garamond', serif",
    isActive: true,
    sortOrder: 5,
  },
  {
    id: "heartbeat",
    name: "Heartbeat",
    desc: "Beating heart intro, blush photobook with floating date bar, romantic invitation.",
    category: "Wedding",
    swatch: ["#B4405F", "#F5D0D8", "#C7A365", "#FFF7F0"],
    bg: "#FFF7F0",
    text: "#7A1E3A",
    font: "'Dancing Script', cursive",
    isActive: true,
    sortOrder: 30,
  },
  {
    id: "story",
    name: "Story",
    desc: "Editorial full-bleed photos, huge bold date reveal, chapter-by-chapter invitation.",
    category: "Wedding",
    swatch: ["#7A9B76", "#F4EFE6", "#A67B39", "#1F1F1F"],
    bg: "#1F1F1F",
    text: "#F4EFE6",
    font: "'Cormorant Garamond', serif",
    isActive: true,
    sortOrder: 40,
  },
  {
    id: "poster",
    name: "Poster",
    desc: "Bauhaus-modern. Bold monogram, geometric mosaic, red/yellow accents, editorial punch.",
    category: "Wedding",
    swatch: ["#E63946", "#F4C542", "#264653", "#F2EEE5"],
    bg: "#F2EEE5",
    text: "#0A0A0A",
    font: "'Archivo Black', sans-serif",
    isActive: true,
    sortOrder: 50,
  },
  {
    id: "showcase",
    name: "Showcase",
    desc: "Premium promo. Three animated wedding-website heroes with cinematic camera moves, live RSVP & countdown, Invita Videos logo outro.",
    category: "Wedding",
    swatch: ["#0E0D0B", "#B08D57", "#7A9B76", "#F5EFE2"],
    bg: "#0E0D0B",
    text: "#B08D57",
    font: "'Playfair Display', serif",
    isActive: true,
    sortOrder: 60,
  },
  {
    id: "engagement-glow",
    name: "Engagement Glow",
    desc: "Moody purple-rose engagement invite with soft bokeh background, champagne typography and cinematic reveal.",
    category: "Engagement",
    swatch: ["#150D1F", "#6D3B63", "#C58B7D", "#E7C694"],
    bg: "#150D1F",
    text: "#FFF7F3",
    font: "'Cormorant Garamond', serif",
    isActive: true,
    sortOrder: 10,
  },
  {
    id: "royal-palace",
    name: "Royal Palace",
    desc: "Regal emerald and antique-gold wedding invitation with palace arches, a couple crest and ceremonial details.",
    category: "Wedding",
    swatch: ["#0D3028", "#741E35", "#D6B56D", "#FFF4D6"],
    bg: "#0D3028",
    text: "#FFF4D6",
    font: "'Cormorant Garamond', serif",
    isActive: true,
    sortOrder: 70,
  },
  {
    id: "ring-reveal",
    name: "Ring Reveal",
    desc: "Luxury engagement announcement with interlocking gold rings, diamond light and an elegant portrait reveal.",
    category: "Engagement",
    swatch: ["#111111", "#D5B36A", "#F7E9DC", "#FFFFFF"],
    bg: "#111111",
    text: "#F7E9DC",
    font: "'Cormorant Garamond', serif",
    isActive: true,
    sortOrder: 20,
  },
  {
    id: "confetti-pop",
    name: "Confetti Pop",
    desc: "Bright birthday invitation with balloons, falling confetti, bold party typography and a playful photo stack.",
    category: "Birthday",
    swatch: ["#FF5A7A", "#FFD447", "#42C6D7", "#7454D8"],
    bg: "#FFF6D8",
    text: "#24213A",
    font: "'Outfit', sans-serif",
    isActive: true,
    sortOrder: 10,
  },
  {
    id: "birthday-era-v1",
    name: "Birthday Era",
    desc: "Emotional cinematic birthday reel with warm film tones, four-photo storytelling, gentle motion and a branded InvitaVideos outro.",
    category: "Birthday",
    style: "Trendy Beat Sync",
    duration: 30,
    maxImages: 4,
    swatch: ["#9C6249", "#4B302A", "#F1B56B", "#FFF7EA"],
    bg: "#4B302A",
    text: "#FFF7EA",
    font: "'Cormorant Garamond', serif",
    isActive: true,
    sortOrder: 5,
  },
  {
    id: "golden-hour",
    name: "Golden Hour",
    desc: "Luxury cinematic birthday short film with warm sunset light, editorial typography, moving golden reflections and a branded InvitaVideos outro.",
    category: "Birthday",
    style: "Cinematic Editorial",
    duration: 30,
    maxImages: 4,
    swatch: ["#0D0A09", "#2C1A15", "#D9AE65", "#FFF7EA"],
    bg: "#2C1A15",
    text: "#FFF7EA",
    font: "'Cormorant Garamond', serif",
    isActive: true,
    sortOrder: 15,
  },
];

export const TemplatePicker = ({ value, onChange, templates = DEFAULT_TEMPLATES }) => {
  const availableTemplates = useMemo(() => templates
    .filter((t) => t.isActive !== false)
    .sort((a, b) =>
      `${a.category || "Wedding"}-${a.sortOrder || 100}-${a.name}`.localeCompare(
        `${b.category || "Wedding"}-${b.sortOrder || 100}-${b.name}`,
      ),
    ), [templates]);
  const categories = useMemo(() => {
    const names = [...new Set(availableTemplates.map((t) => t.category || "Wedding"))];
    const preferredOrder = ["Wedding", "Engagement", "Birthday"];
    return names.sort((a, b) => {
      const ai = preferredOrder.indexOf(a);
      const bi = preferredOrder.indexOf(b);
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      return a.localeCompare(b);
    });
  }, [availableTemplates]);
  const selectedTemplate = availableTemplates.find((t) => t.id === value);
  const [activeCategory, setActiveCategory] = useState(selectedTemplate?.category || categories[0] || "Wedding");

  useEffect(() => {
    if (!categories.includes(activeCategory)) setActiveCategory(categories[0] || "Wedding");
  }, [activeCategory, categories]);

  useEffect(() => {
    if (selectedTemplate?.category && selectedTemplate.category !== activeCategory) {
      setActiveCategory(selectedTemplate.category);
    }
  }, [activeCategory, selectedTemplate]);

  const categoryTemplates = availableTemplates.filter((t) => (t.category || "Wedding") === activeCategory);

  const selectCategory = (category) => {
    setActiveCategory(category);
    const firstTemplate = availableTemplates.find((t) => (t.category || "Wedding") === category);
    if (firstTemplate && firstTemplate.id !== value) onChange(firstTemplate.id);
  };

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="section-label text-left">01 — Template</h2>
        {selectedTemplate && (
          <span className="text-xs font-medium text-neutral-500">
            Selected: <span className="font-semibold text-[#A4176D]">{selectedTemplate.name}</span>
          </span>
        )}
      </div>
      {categories.length > 1 && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-neutral-500">What are you creating?</p>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Video categories">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              role="tab"
              aria-selected={activeCategory === category}
              onClick={() => selectCategory(category)}
              className={`rounded-full border px-4 py-2 text-sm font-bold transition-all ${
                activeCategory === category
                  ? "border-[#C80A76] bg-[#C80A76] text-white shadow-sm"
                  : "border-[#E8C9DB] bg-[#FFF8FB] text-[#8D1B63] hover:border-[#C80A76] hover:bg-[#FFF0F7]"
              }`}
            >
              {category}
            </button>
          ))}
          </div>
        </div>
      )}
      <p className="mb-2 text-xs font-semibold text-neutral-500">
        Choose a {activeCategory.toLowerCase()} template
      </p>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {categoryTemplates.map((t) => {
          const isSelected = value === t.id;
          return (
            <button
              key={t.id}
              type="button"
              data-testid={`template-selector-${t.id}`}
              aria-pressed={isSelected}
              title={t.desc}
              onClick={() => onChange(t.id)}
              className={`group relative overflow-hidden rounded-2xl border bg-white text-left shadow-[0_10px_30px_rgba(81,25,62,0.06)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_18px_42px_rgba(81,25,62,0.14)] ${
                isSelected
                  ? "border-[#C80A76] ring-2 ring-[#C80A76] ring-offset-2"
                  : "border-[#ECD5E2] hover:border-[#D9A9C6]"
              }`}
            >
              <span className="absolute left-3 top-3 z-10 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
                {Number(t.renderCount || 0)} {Number(t.renderCount || 0) === 1 ? "video" : "videos"}
              </span>
              <div
                className="relative flex h-28 items-center justify-center overflow-hidden sm:h-32"
                style={{ background: `linear-gradient(135deg, ${t.bg || "#32113A"}, ${t.swatch?.[1] || t.bg || "#32113A"})` }}
              >
                <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(circle at 20% 10%, white, transparent 34%), radial-gradient(circle at 80% 90%, white, transparent 25%)" }} />
                <span
                  className="relative truncate px-5 text-center text-2xl italic drop-shadow-sm"
                  style={{ color: t.text, fontFamily: t.font }}
                >
                  {t.name}
                </span>
              </div>
              {isSelected && (
                <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-[#C80A76] text-white shadow-md">
                  <Check className="h-4 w-4" strokeWidth={3} />
                </span>
              )}
              <div className="space-y-2.5 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-heading text-lg font-extrabold tracking-tight text-[#32113A]">{t.name}</span>
                  <span className="flex shrink-0 gap-1">
                  {t.swatch.slice(0, 4).map((c) => (
                    <span
                      key={c}
                      className="h-3 w-3 rounded-full border border-black/10"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  </span>
                </div>
                <p className="line-clamp-2 min-h-[2.5rem] text-xs leading-5 text-neutral-500">{t.desc}</p>
                <div className="flex items-center justify-between border-t border-[#F0DDE7] pt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#A4176D]">
                  <span>{t.category || "Wedding"}</span>
                  <span>{isSelected ? "Selected" : "Choose style"}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
