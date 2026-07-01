"use client";

import { BrandMark } from "../BrandMark";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./pricing.module.css";

// Цены посчитаны по рынку конкурентов (сервисы поиска/бронирования
// слотов Ozon, июль 2026): SlotLoom — флэт-подписка 1990 ₽/мес за весь
// функционал; MetricLab — пакеты по 140–198 ₽/бронирование (990 ₽ за 5,
// 6990 ₽ за 50). FBOly закрывает больше, чем просто слот-бронирование
// (Excel → распределение по кластерам → черновики → слот), поэтому Pro
// поставлен на уровне флэт-конкурента, а не выше — чтобы не проигрывать
// по цене за бо́льшую функциональность.
const PRO_MONTHLY = 1990;
const TEAM_MONTHLY = 4990;
// Годовая оплата — 2 месяца в подарок (стандартная SaaS-скидка ~17%),
// в исходном макете это было плейсхолдером {{ proPrice }}/{{ teamPrice }}
// без реальных чисел — здесь считаем по формуле.
const YEARLY_DISCOUNT_MONTHS = 2;

function CheckIcon() {
  return (
    <div className={styles.check}>
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#22C55E" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /></svg>
    </div>
  );
}
function DashIcon() {
  return <div className={styles.dash}>—</div>;
}

export default function PricingPage() {
  const router = useRouter();
  const [yearly, setYearly] = useState(false);

  const proPrice = yearly ? Math.round((PRO_MONTHLY * (12 - YEARLY_DISCOUNT_MONTHS)) / 12) : PRO_MONTHLY;
  const teamPrice = yearly ? Math.round((TEAM_MONTHLY * (12 - YEARLY_DISCOUNT_MONTHS)) / 12) : TEAM_MONTHLY;
  const proBilling = yearly ? `${PRO_MONTHLY * (12 - YEARLY_DISCOUNT_MONTHS)} ₽ раз в год` : "оплата помесячно";
  const teamBilling = yearly ? `${TEAM_MONTHLY * (12 - YEARLY_DISCOUNT_MONTHS)} ₽ раз в год` : "оплата помесячно";

  return (
    <div className={styles.root}>
      <nav className={styles.nav}>
        <a className={styles.navLogo} href="/">
          <BrandMark height={38} />
        </a>
        <div className={styles.navLinks}>
          <a className={`${styles.navLink} ${styles.navLinkActive}`} href="/pricing">Тарифы</a>
          <a className={styles.navLink} href="/faq">FAQ</a>
        </div>
        <div className={styles.navBtns}>
          <button className={styles.btnOutline} onClick={() => router.push("/auth")}>Войти</button>
          <button className={styles.btnFilled} onClick={() => router.push("/auth")}>Регистрация</button>
        </div>
      </nav>

      <div className={styles.hero}>
        <div className={styles.badge}>Простые тарифы</div>
        <h1 className={styles.h1}>Начните бесплатно.<br />Масштабируйтесь по мере роста.</h1>
        <p className={styles.sub}>Никаких скрытых платежей. Без лимитов на SKU. Платите только за результат.</p>

        <div className={styles.toggleWrap}>
          <div className={styles.toggleInner}>
            <button className={`${styles.toggleBtn} ${!yearly ? styles.toggleBtnActive : ""}`} onClick={() => setYearly(false)}>Месяц</button>
            <button className={`${styles.toggleBtn} ${yearly ? styles.toggleBtnActive : ""}`} onClick={() => setYearly(true)}>Год</button>
          </div>
          <div className={styles.savings}>{yearly ? `Экономия ${YEARLY_DISCOUNT_MONTHS} мес. в год` : "−17% при годовой оплате"}</div>
        </div>
      </div>

      <div className={styles.cardsGrid}>
        {/* Старт */}
        <div className={styles.card}>
          <div className={styles.planName}>Старт</div>
          <div className={styles.priceRow}>
            <span className={styles.priceNum}>0</span>
            <span className={styles.priceCur}>₽</span>
          </div>
          <div className={styles.priceCaption}>навсегда бесплатно</div>
          <button className={`${styles.planCta} ${styles.planCtaOutline}`} onClick={() => router.push("/auth")}>Начать бесплатно</button>
          <div className={styles.featuresLabel}>Включает</div>
          <div className={styles.featureList}>
            <div className={styles.featureRow}><CheckIcon />5 поставок в месяц</div>
            <div className={styles.featureRow}><CheckIcon />До 50 SKU на поставку</div>
            <div className={styles.featureRow}><CheckIcon />Загрузка Excel-файлов</div>
            <div className={styles.featureRow}><CheckIcon />Создание черновиков через API</div>
            <div className={styles.featureRow} style={{ color: "var(--text-muted)" }}><DashIcon />Охота на слоты</div>
            <div className={styles.featureRow} style={{ color: "var(--text-muted)" }}><DashIcon />Email-уведомления</div>
            <div className={styles.featureRow} style={{ color: "var(--text-muted)" }}><DashIcon />Приоритетная поддержка</div>
          </div>
        </div>

        {/* Pro */}
        <div className={`${styles.card} ${styles.cardHighlight}`}>
          <div className={styles.accentLine} />
          <div className={styles.popularBadge}>Популярный</div>
          <div className={`${styles.planName} ${styles.planNameAccent}`}>Pro</div>
          <div className={styles.priceRow}>
            <span className={styles.priceNum}>{proPrice.toLocaleString("ru-RU")}</span>
            <span className={styles.priceCur}>₽</span>
            <span className={styles.pricePeriod}>/мес</span>
          </div>
          <div className={styles.priceCaption}>{proBilling}</div>
          <button className={`${styles.planCta} ${styles.planCtaFilled}`} onClick={() => router.push("/auth")}>Начать бесплатно → Pro</button>
          <div className={styles.featuresLabel}>Всё из Старт, плюс</div>
          <div className={styles.featureList}>
            <div className={`${styles.featureRow} ${styles.featureRowStrong}`}><CheckIcon /><strong>Безлимитные</strong>&nbsp;поставки</div>
            <div className={`${styles.featureRow} ${styles.featureRowStrong}`}><CheckIcon />Неограниченное кол-во SKU</div>
            <div className={`${styles.featureRow} ${styles.featureRowStrong}`}><CheckIcon /><strong>Охота на слоты</strong>&nbsp;— автозахват</div>
            <div className={`${styles.featureRow} ${styles.featureRowStrong}`}><CheckIcon />Email + Telegram уведомления</div>
            <div className={`${styles.featureRow} ${styles.featureRowStrong}`}><CheckIcon />Приоритет в очереди слотов</div>
            <div className={`${styles.featureRow} ${styles.featureRowStrong}`}><CheckIcon />История поставок 90 дней</div>
            <div className={`${styles.featureRow} ${styles.featureRowStrong}`}><CheckIcon />Поддержка в чате</div>
          </div>
        </div>

        {/* Команда */}
        <div className={styles.card}>
          <div className={styles.planName}>Команда</div>
          <div className={styles.priceRow}>
            <span className={styles.priceNum}>{teamPrice.toLocaleString("ru-RU")}</span>
            <span className={styles.priceCur}>₽</span>
            <span className={styles.pricePeriod}>/мес</span>
          </div>
          <div className={styles.priceCaption}>{teamBilling}</div>
          <button className={`${styles.planCta} ${styles.planCtaOutline}`} onClick={() => setToastFallback()}>Связаться с нами</button>
          <div className={styles.featuresLabel}>Всё из Pro, плюс</div>
          <div className={styles.featureList}>
            <div className={`${styles.featureRow} ${styles.featureRowStrong}`}><CheckIcon />До 5 пользователей</div>
            <div className={`${styles.featureRow} ${styles.featureRowStrong}`}><CheckIcon />Несколько магазинов Ozon</div>
            <div className={`${styles.featureRow} ${styles.featureRowStrong}`}><CheckIcon />Общая история поставок</div>
            <div className={`${styles.featureRow} ${styles.featureRowStrong}`}><CheckIcon />Роли: менеджер / оператор</div>
            <div className={`${styles.featureRow} ${styles.featureRowStrong}`}><CheckIcon />Приоритетная поддержка 24/7</div>
            <div className={`${styles.featureRow} ${styles.featureRowStrong}`}><CheckIcon />Выделенный менеджер</div>
            <div className={`${styles.featureRow} ${styles.featureRowStrong}`}><CheckIcon />API для интеграции (1С, WMS)</div>
          </div>
        </div>
      </div>

      {/* Comparison table */}
      <div className={styles.compareWrap}>
        <div className={styles.sectionLabel}>Сравнение возможностей</div>
        <div className={styles.compareTable}>
          <div className={styles.compareHead}>
            <div />
            <div className={styles.compareHeadCell}>Старт</div>
            <div className={`${styles.compareHeadCell} ${styles.compareHeadCellAccent}`}>Pro</div>
            <div className={styles.compareHeadCell}>Команда</div>
          </div>

          <div className={styles.compareRow}>
            <div className={styles.compareFeature}>Поставки в месяц</div>
            <div className={`${styles.compareCell} ${styles.compareCellMono}`}>5</div>
            <div className={`${styles.compareCell} ${styles.compareCellAccent}`}>∞</div>
            <div className={`${styles.compareCell} ${styles.compareCellStrong}`}>∞</div>
          </div>
          <div className={styles.compareRow}>
            <div className={styles.compareFeature}>SKU на поставку</div>
            <div className={`${styles.compareCell} ${styles.compareCellMono}`}>50</div>
            <div className={`${styles.compareCell} ${styles.compareCellAccent}`}>∞</div>
            <div className={`${styles.compareCell} ${styles.compareCellStrong}`}>∞</div>
          </div>
          <div className={styles.compareRow}>
            <div className={styles.compareFeature}>Создание черновиков через API</div>
            <div className={styles.compareCell}><CheckIcon /></div>
            <div className={styles.compareCell}><CheckIcon /></div>
            <div className={styles.compareCell}><CheckIcon /></div>
          </div>
          <div className={styles.compareRow}>
            <div className={styles.compareFeature}>Охота на слоты</div>
            <div className={`${styles.compareCell} ${styles.compareCellDash}`}>—</div>
            <div className={styles.compareCell}><CheckIcon /></div>
            <div className={styles.compareCell}><CheckIcon /></div>
          </div>
          <div className={styles.compareRow}>
            <div className={styles.compareFeature}>Telegram-уведомления</div>
            <div className={`${styles.compareCell} ${styles.compareCellDash}`}>—</div>
            <div className={styles.compareCell}><CheckIcon /></div>
            <div className={styles.compareCell}><CheckIcon /></div>
          </div>
          <div className={styles.compareRow}>
            <div className={styles.compareFeature}>Несколько пользователей</div>
            <div className={`${styles.compareCell} ${styles.compareCellDash}`}>—</div>
            <div className={`${styles.compareCell} ${styles.compareCellDash}`}>—</div>
            <div className={styles.compareCell}><CheckIcon /></div>
          </div>
          <div className={styles.compareRow}>
            <div className={styles.compareFeature}>API интеграция (1С, WMS)</div>
            <div className={`${styles.compareCell} ${styles.compareCellDash}`}>—</div>
            <div className={`${styles.compareCell} ${styles.compareCellDash}`}>—</div>
            <div className={styles.compareCell}><CheckIcon /></div>
          </div>
        </div>
      </div>
    </div>
  );

  function setToastFallback() {
    window.location.href = "mailto:hello@fboly.ru?subject=Тариф Команда";
  }
}
