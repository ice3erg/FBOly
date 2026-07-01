"use client";

import { BrandMark } from "./BrandMark";
import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./landing.module.css";

export default function LandingPage() {
  const router = useRouter();
  const [videoOpen, setVideoOpen] = useState(false);

  return (
    <div className={styles.root}>
      <div className={styles.page}>
        <nav className={styles.nav}>
          <a className={styles.navLogo} href="/">
            <BrandMark size={32} />
          </a>
          <div className={styles.navLinks}>
            <a className={styles.navLink} href="/pricing">Тарифы</a>
            <a className={styles.navLink} href="/faq">FAQ</a>
            <a className={styles.navLink} href="/docs">Документация</a>
          </div>
          <div className={styles.navBtns}>
            <button className={styles.btnOutline} onClick={() => router.push("/auth")}>Войти</button>
            <button className={styles.btnFilled} onClick={() => router.push("/auth")}>Регистрация</button>
          </div>
        </nav>

        <div className={styles.hero}>
          <div className={styles.heroLeft}>
            <h1 className={styles.heroH1}>FBO-поставки<br />без рутины</h1>
            <p className={styles.heroSub}>
              Автоматизация отгрузок на склады Ozon.<br />Экономьте время и снижайте ошибки.
            </p>
            <div className={styles.heroCtas}>
              <button className={styles.ctaPrimary} onClick={() => router.push("/auth")}>Начать бесплатно</button>
              <button className={styles.ctaSecondary} onClick={() => setVideoOpen(true)}>Посмотреть демо</button>
            </div>
          </div>

          <div className={styles.heroRight}>
            <div className={styles.mockupWrap}>
              {/* BACK card — stats/chart view */}
              <div className={`${styles.mockCard} ${styles.mockBack}`}>
                <div className={styles.mockTopbar}>
                  <div className={styles.mockDot} style={{ background: "#EF4444" }} />
                  <div className={styles.mockDot} style={{ background: "#F59E0B" }} />
                  <div className={styles.mockDot} style={{ background: "#22C55E" }} />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: "var(--text-muted)", marginLeft: 8 }}>
                    LogisticMap · FBOly
                  </span>
                </div>
                <div className={styles.mockBody}>
                  <div style={{ fontSize: 8, fontWeight: 600, color: "var(--text-sec)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                    Загруженность складов
                  </div>
                  {[
                    { label: "Хоругвино", pct: 78, color: "var(--accent)" },
                    { label: "Осиновая", pct: 62, color: "#22C55E" },
                    { label: "Казань", pct: 45, color: "#F59E0B" },
                    { label: "Новосибирск", pct: 91, color: "#EF4444" },
                  ].map((row) => (
                    <div className={styles.mockRow} key={row.label}>
                      <div className={styles.mockLabel}>{row.label}</div>
                      <div
                        className={styles.mockBar}
                        style={{ background: `linear-gradient(90deg,${row.color} ${row.pct}%,rgba(255,255,255,0.06) ${row.pct}%)` }}
                      />
                      <div className={styles.mockVal} style={row.pct > 85 ? { color: "#EF4444" } : undefined}>{row.pct}%</div>
                    </div>
                  ))}
                  <div style={{ marginTop: 14, height: 55, position: "relative" }}>
                    <svg viewBox="0 0 280 50" width="100%" height="100%" style={{ overflow: "visible" }}>
                      <defs>
                        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <path d="M0 35 C30 32 50 20 80 18 S130 28 160 22 S210 10 240 14 S260 20 280 12" stroke="var(--accent)" strokeWidth={1.5} fill="none" />
                      <path d="M0 35 C30 32 50 20 80 18 S130 28 160 22 S210 10 240 14 S260 20 280 12 V50 H0Z" fill="url(#cg)" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* FRONT card — main supply dashboard */}
              <div className={`${styles.mockCard} ${styles.mockFront}`}>
                <div className={styles.mockTopbar}>
                  <div className={styles.mockDot} style={{ background: "#EF4444" }} />
                  <div className={styles.mockDot} style={{ background: "#F59E0B" }} />
                  <div className={styles.mockDot} style={{ background: "#22C55E" }} />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: "var(--text-muted)", marginLeft: 8 }}>
                    LogisticMap · Поставки
                  </span>
                  <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 7, color: "#22C55E" }}>● Online</span>
                </div>
                <div className={styles.mockBody}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 12 }}>
                    <div style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(34,197,94,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1.5 4l2 2 3-3" stroke="#22C55E" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </div>
                    <div style={{ flex: 1, height: 1, background: "rgba(34,197,94,0.3)" }} />
                    <div style={{ width: 16, height: 16, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 7, fontWeight: 700, color: "#fff" }}>2</div>
                    <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
                    <div style={{ width: 16, height: 16, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.14)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 7, color: "var(--text-muted)" }}>3</div>
                    <span style={{ fontSize: 7, color: "var(--text-muted)", marginLeft: 6 }}>Загрузка → Черновики → Слот</span>
                  </div>
                  <div className={styles.mockStats}>
                    <div className={styles.mockStat}><div className={styles.mockStatN}>248</div><div className={styles.mockStatL}>Товаров</div></div>
                    <div className={styles.mockStat}><div className={styles.mockStatN} style={{ color: "#EF4444" }}>3</div><div className={styles.mockStatL}>Ошибок</div></div>
                    <div className={styles.mockStat}><div className={styles.mockStatN}>5</div><div className={styles.mockStatL}>Кластеров</div></div>
                    <div className={styles.mockStat}><div className={styles.mockStatN} style={{ color: "#22C55E" }}>245</div><div className={styles.mockStatL}>Готово</div></div>
                  </div>
                  <div style={{ fontSize: 7, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Кластеры</div>
                  <div>
                    {[
                      { chip: "✓", name: "Москва — Юг", sku: "82 SKU", tag: "Выбран", tagBg: "rgba(79,142,247,0.12)", tagColor: "var(--accent-light)", chipBg: "rgba(79,142,247,0.15)" },
                      { chip: "✓", name: "СПб — Осиновая", sku: "44 SKU", tag: "Выбран", tagBg: "rgba(79,142,247,0.12)", tagColor: "var(--accent-light)", chipBg: "rgba(79,142,247,0.15)" },
                      { chip: "○", name: "Казань", sku: "38 SKU", tag: "Idle", tagBg: "rgba(255,255,255,0.05)", tagColor: "var(--text-muted)", chipBg: "rgba(255,255,255,0.05)", dim: true },
                      { chip: "!", name: "Екатеринбург", sku: "3 ошибки", tag: "Ошибка", tagBg: "rgba(239,68,68,0.1)", tagColor: "#EF4444", chipBg: "rgba(239,68,68,0.1)", dim: true },
                    ].map((row) => (
                      <div className={styles.mockTableRow} key={row.name}>
                        <div className={styles.mockChip} style={{ background: row.chipBg, color: row.tagColor }}>{row.chip}</div>
                        <span style={{ fontSize: 9, fontWeight: row.dim ? 400 : 600, flex: 1, color: row.dim ? "var(--text-muted)" : undefined }}>{row.name}</span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: row.dim && row.tag === "Ошибка" ? "#EF4444" : "var(--text-sec)" }}>{row.sku}</span>
                        <div className={styles.mockChip} style={{ background: row.tagBg, color: row.tagColor }}>{row.tag}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                    <div style={{ height: 22, padding: "0 12px", background: "var(--accent)", borderRadius: 5, fontSize: 8, fontWeight: 600, color: "#fff", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      Создать черновики →
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.mockGlow} />
            </div>
          </div>
        </div>
      </div>

      {/* ═══ VIDEO MODAL ═══ */}
      <div className={`${styles.videoBackdrop} ${videoOpen ? styles.open : ""}`} onClick={() => setVideoOpen(false)}>
        <div className={styles.videoCard} onClick={(e) => e.stopPropagation()}>
          <div className={styles.videoHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--accent)" strokeWidth={2}>
                <polygon points="5 3 19 12 5 21 5 3" fill="var(--accent-dim)" stroke="var(--accent)" />
              </svg>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Как работает FBOly</span>
              <div style={{ height: 18, padding: "0 7px", background: "var(--accent-dim)", border: "1px solid var(--accent-border)", borderRadius: 4, fontSize: 10, fontWeight: 600, color: "var(--accent-light)", display: "inline-flex", alignItems: "center", letterSpacing: "0.04em" }}>
                3 мин
              </div>
            </div>
            <button className={styles.videoClose} onClick={() => setVideoOpen(false)}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" /></svg>
            </button>
          </div>
          <div className={styles.videoFrame}>
            <div className={styles.videoPlaceholder}>
              <button className={styles.videoPlayBtn}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              </button>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>Видео-демонстрация</div>
                <div style={{ fontSize: 13, color: "var(--text-sec)" }}>Вставьте ссылку на YouTube — и видео появится здесь</div>
              </div>
              <div style={{ display: "flex", gap: 24, marginTop: 8 }}>
                {[
                  { n: "1", label: "Загрузите Excel", bg: "var(--accent-dim)", border: "var(--accent-border)", color: "var(--accent)" },
                  { n: "2", label: "Создайте черновики", bg: "var(--accent-dim)", border: "var(--accent-border)", color: "var(--accent)" },
                  { n: "3", label: "Получите слот", bg: "rgba(34,197,94,0.15)", border: "rgba(34,197,94,0.3)", color: "#22C55E" },
                ].map((step, i) => (
                  <Fragment key={step.n}>
                    {i > 0 && <div style={{ color: "var(--text-muted)", fontSize: 12 }}>→</div>}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)" }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", background: step.bg, border: `1px solid ${step.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: step.color }}>
                        {step.n}
                      </div>
                      {step.label}
                    </div>
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
