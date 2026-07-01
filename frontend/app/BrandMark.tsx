// Единая монограмма-логотип FBOly для маркетинговых страниц (лендинг,
// тарифы, FAQ, документация). Раньше здесь стояла старая PNG-иконка
// (фиолетовый 3D-бокс) — актуальный бренд использует синюю палитру и
// SVG-монограмму «F» (см. f-icon-handoff.md), поэтому картинка заменена
// на инлайн-SVG + текстовый вордмарк, без файловой зависимости.
export function BrandMark({ size = 22 }: { size?: number }) {
  const markSize = Math.round(size * 0.68);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.28),
          background: "#12121C",
          border: "1px solid rgba(255,255,255,0.09)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width={markSize}
          height={markSize}
          aria-hidden="true"
          style={{ display: "block", transform: "skewX(-8deg) translateX(-1px)" }}
        >
          <polygon points="5,3 19,3 15,8 5,8" fill="#F5F6FA" />
          <polygon points="5,11 16,11 12,15 9,15 9,21 5,21" fill="#F5F6FA" />
        </svg>
      </span>
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: Math.round(size * 0.78),
          letterSpacing: "-0.01em",
          color: "var(--text)",
        }}
      >
        FBO<span style={{ color: "var(--accent-light)" }}>ly</span>
      </span>
    </span>
  );
}
