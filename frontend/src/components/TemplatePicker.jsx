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

const CATEGORY_TYPE_LABELS = { invitation: "Invitation", personal: "Personal" };

export const TemplatePicker = ({ value, onChange, templates = DEFAULT_TEMPLATES, categoryTypes = {} }) => {
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

  const categoriesByType = useMemo(() => {
    const groups = { invitation: [], personal: [] };
    categories.forEach((category) => {
      const type = categoryTypes[category] === "invitation" ? "invitation" : "personal";
      groups[type].push(category);
    });
    return groups;
  }, [categories, categoryTypes]);

  const selectCategory = (category) => {
    setActiveCategory(category);
    const firstTemplate = availableTemplates.find((t) => (t.category || "Wedding") === category);
    if (firstTemplate && firstTemplate.id !== value) onChange(firstTemplate.id);
  };

  return (
    <section>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-editorial text-xl font-semibold text-[#4A1635]">Choose a look that feels like you</h3>
          <p className="mt-1 text-xs text-[#83747C]">Each style is designed for a vertical reel.</p>
        </div>
        {selectedTemplate && (
          <span className="hidden rounded-full bg-[#F8EDF2] px-3 py-1.5 text-xs font-medium text-[#7E294F] sm:inline-flex">
            Selected · <span className="ml-1 font-semibold">{selectedTemplate.name}</span>
          </span>
        )}
      </div>
      {categories.length > 1 && (
        <div className="mb-6 space-y-3 rounded-2xl border border-[#EEE3DE] bg-[#FCF9F5] p-3.5">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.17em] text-[#9A8991]">What are you creating?</p>
          {["invitation", "personal"].map((type) => (
            categoriesByType[type].length > 0 && (
              <div key={type} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <p className="w-20 shrink-0 text-[10px] font-bold uppercase tracking-[0.14em] text-[#B09FA6]">{CATEGORY_TYPE_LABELS[type]}</p>
                <div className="flex flex-wrap gap-2" role="tablist" aria-label={`${CATEGORY_TYPE_LABELS[type]} categories`}>
                {categoriesByType[type].map((category) => (
                  <button
                    key={category}
                    type="button"
                    role="tab"
                    aria-selected={activeCategory === category}
                    onClick={() => selectCategory(category)}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition-[background-color,border-color,color,box-shadow] duration-200 ${
                      activeCategory === category
                        ? "border-[#8E2758] bg-[#8E2758] text-white shadow-[0_6px_16px_rgba(142,39,88,0.18)]"
                        : "border-[#E4D6D0] bg-white text-[#674453] hover:border-[#BE829F] hover:bg-[#FFF8FB]"
                    }`}
                  >
                    {category}
                  </button>
                ))}
                </div>
              </div>
            )
          ))}
        </div>
      )}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold text-[#674F5A]">{activeCategory} styles</p>
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#B09FA6]">Tap to preview</span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
              className={`group relative overflow-hidden rounded-[1.2rem] border bg-white text-left shadow-[0_10px_30px_rgba(74,22,53,0.055)] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(74,22,53,0.13)] ${
                isSelected
                  ? "border-[#96275D] ring-2 ring-[#96275D] ring-offset-2"
                  : "border-[#E8DDD8] hover:border-[#C99AB0]"
              }`}
            >
              <span className="absolute left-3 top-3 z-10 rounded-full border border-white/15 bg-black/45 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-white backdrop-blur-md">
                {Number(t.renderCount || 0)} {Number(t.renderCount || 0) === 1 ? "video" : "videos"}
              </span>
              <div
                className="template-art relative flex h-44 items-center justify-center overflow-hidden sm:h-48"
                style={{ "--template-bg": t.bg || "#32113A", "--template-accent": t.swatch?.[1] || t.bg || "#32113A", backgroundColor: t.bg || "#32113A" }}
              >
                <div className="template-art-glow absolute inset-0 opacity-60" />
                <div className="absolute inset-x-7 top-6 h-px bg-white/25" />
                <div className="absolute left-1/2 top-6 h-8 w-px -translate-x-1/2 bg-white/20" />
                <div className="absolute bottom-5 left-1/2 h-10 w-20 -translate-x-1/2 rounded-t-full border border-white/20 border-b-0" />
                <span
                  className="relative max-w-[85%] truncate px-5 text-center text-2xl italic drop-shadow-md"
                  style={{ color: t.text, fontFamily: t.font }}
                >
                  {t.name}
                </span>
              </div>
              {isSelected && (
                <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#96275D] text-white shadow-md ring-2 ring-white/70">
                  <Check className="h-4 w-4" strokeWidth={3} />
                </span>
              )}
              <div className="space-y-2.5 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-editorial text-lg font-semibold tracking-tight text-[#4A1635]">{t.name}</span>
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
                <div className="flex items-center justify-between border-t border-[#F0E5E0] pt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#8C315F]">
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
