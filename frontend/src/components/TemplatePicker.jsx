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
  ];

  return (
    <section>
      <h2 className="section-label mb-4 text-left">01 — Template</h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            data-testid={`template-selector-${t.id}`}
            onClick={() => onChange(t.id)}
            className={`tactile-card overflow-hidden p-0 text-left ${
              value === t.id ? "ring-2 ring-black border-black" : ""
            }`}
          >
            <div
              className="flex h-32 items-center justify-center"
              style={{ backgroundColor: t.bg }}
            >
              <span
                className="text-3xl italic"
                style={{ color: t.text, fontFamily: t.font }}
              >
                {t.name}
              </span>
            </div>
            <div className="p-5">
              <div className="mb-2 flex gap-1.5">
                {t.swatch.map((c) => (
                  <span
                    key={c}
                    className="h-4 w-4 rounded-full border border-black/10"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="font-heading text-lg font-extrabold tracking-tight">{t.name}</div>
              <p className="mt-1 text-sm text-neutral-500">{t.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};
