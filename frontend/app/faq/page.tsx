"use client";

import { BrandMark } from "../BrandMark";
import { useRouter } from "next/navigation";
import { useState } from "react";
import nav from "../marketing-chrome.module.css";
import styles from "./faq.module.css";

type QA = { q: string; a: React.ReactNode };
type Category = { label: string; items: QA[] };

const CATEGORIES: Category[] = [
  {
    label: "Общее",
    items: [
      {
        q: "Что делает FBOly?",
        a: "FBOly автоматизирует поставки на склады Ozon FBO: загружает Excel с товарами, распределяет их по кластерам, создаёт черновики через Ozon Seller API и ловит доступные слоты на отгрузку.",
      },
      {
        q: "Нужно ли устанавливать что-то на компьютер?",
        a: "Нет, FBOly работает полностью в браузере. Ничего устанавливать не нужно.",
      },
      {
        q: "С какими маркетплейсами работает сервис?",
        a: "Сейчас только с Ozon FBO. Поддержка Wildberries и других площадок не подключена.",
      },
    ],
  },
  {
    label: "Подключение Ozon",
    items: [
      {
        q: "Где взять Client-Id и API Key?",
        a: "В личном кабинете Ozon Seller: Настройки → API-ключи. Скопируйте оба значения в раздел «Магазин» в FBOly и нажмите «Проверить».",
      },
      {
        q: "Можно ли подключить несколько магазинов Ozon?",
        a: "Да, в разделе «Магазин» можно добавить несколько кабинетов и переключаться между ними — каждый со своими Client-Id и API Key.",
      },
      {
        q: "Почему подключение показывает ошибку?",
        a: "Чаще всего — неверный API Key или он отозван в кабинете Ozon. Перевыпустите ключ в Ozon Seller и обновите его в профиле FBOly.",
      },
    ],
  },
  {
    label: "Поставки и черновики",
    items: [
      {
        q: "Какой формат Excel-файла нужен?",
        a: "Файл .xlsx или .xls с колонками: артикул/офер, количество, при необходимости — склад назначения. Подробный разбор колонок — на странице Документации.",
      },
      {
        q: "Что такое кластеры и почему их несколько?",
        a: "Ozon группирует склады в логистические кластеры (Москва, Юг, Урал и т.д.). Для каждого выбранного кластера с товаром создаётся отдельный черновик поставки.",
      },
      {
        q: "В чём разница между прямой поставкой и кроссдокингом?",
        a: "Прямая поставка едет напрямую на склад кластера. Кроссдокинг — вся партия одной поставкой уезжает в единую точку, а Ozon сам развозит товар по складам дальше.",
      },
      {
        q: "Черновик создан, но заявки в Ozon нет — почему?",
        a: "Черновик — это подготовительный шаг. Заявка на поставку появляется в кабинете Ozon только после того, как забронирован слот (вручную или через Охотника).",
      },
    ],
  },
  {
    label: "Охотник на слоты",
    items: [
      {
        q: "Как работает автоматический поиск слотов?",
        a: "FBOly периодически опрашивает Ozon на предмет доступных окон приёмки по вашим черновикам и, если включён автозахват, сразу бронирует первый подходящий слот.",
      },
      {
        q: "Что если Ozon ограничивает частоту запросов?",
        a: "Охотник учитывает лимиты Ozon API и сам увеличивает паузу между попытками — вручную ничего настраивать не нужно.",
      },
      {
        q: "Можно ли остановить охоту в любой момент?",
        a: "Да, кнопка «Остановить» на странице Слотов мгновенно останавливает задачу — уже забронированные слоты остаются забронированными.",
      },
    ],
  },
  {
    label: "Тарифы и оплата",
    items: [
      {
        q: "Какие есть тарифы?",
        a: <>Старт (бесплатно), Pro и Команда. Подробное сравнение — на странице <a href="/pricing">Тарифов</a>.</>,
      },
      {
        q: "Что будет, если превысить лимит поставок на тарифе Старт?",
        a: "Новые поставки станут недоступны до начала следующего месяца или до перехода на Pro — уже созданные черновики и история сохраняются.",
      },
    ],
  },
  {
    label: "Безопасность",
    items: [
      {
        q: "Где хранятся мои Client-Id и API Key?",
        a: "Ключи хранятся в браузере (localStorage) и передаются напрямую в Ozon API для выполнения ваших запросов. FBOly не продаёт и не передаёт эти данные третьим лицам.",
      },
      {
        q: "Может ли FBOly продавать или списывать деньги от моего имени?",
        a: "Нет. API Key от Ozon Seller не даёт доступа к финансовым операциям — только к операциям с поставками и остатками.",
      },
    ],
  },
];

export default function FaqPage() {
  const router = useRouter();
  const [openKey, setOpenKey] = useState<string | null>("Общее-0");

  return (
    <div>
      <nav className={nav.nav}>
        <a className={nav.navLogo} href="/">
          <BrandMark height={38} />
        </a>
        <div className={nav.navLinks}>
          <a className={nav.navLink} href="/pricing">Тарифы</a>
          <a className={`${nav.navLink} ${nav.navLinkActive}`} href="/faq">FAQ</a>
          <a className={nav.navLink} href="/docs">Документация</a>
        </div>
        <div className={nav.navBtns}>
          <button className={nav.btnOutline} onClick={() => router.push("/auth")}>Войти</button>
          <button className={nav.btnFilled} onClick={() => router.push("/auth")}>Регистрация</button>
        </div>
      </nav>

      <div className={nav.hero}>
        <div className={nav.badge}>Помощь</div>
        <h1 className={nav.h1}>Частые вопросы</h1>
        <p className={nav.sub}>Всё о подключении Ozon, поставках, охоте на слоты и тарифах FBOly.</p>
      </div>

      <div className={styles.wrap}>
        {CATEGORIES.map((cat) => (
          <div key={cat.label}>
            <div className={styles.categoryLabel}>{cat.label}</div>
            {cat.items.map((item, i) => {
              const key = `${cat.label}-${i}`;
              const open = openKey === key;
              const isLast = i === cat.items.length - 1;
              return (
                <div key={key} className={`${styles.item} ${isLast ? styles.itemLast : ""}`}>
                  <button className={styles.qBtn} onClick={() => setOpenKey(open ? null : key)} aria-expanded={open}>
                    <span className={styles.q}>{item.q}</span>
                    <svg className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  <div className={`${styles.aWrap} ${open ? styles.aWrapOpen : ""}`}>
                    <div className={styles.a}>{item.a}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        <div className={styles.contactCard}>
          <div className={styles.contactTitle}>Не нашли ответ?</div>
          <div className={styles.contactSub}>Напишите нам — ответим в течение рабочего дня.</div>
          <button className={nav.btnFilled} onClick={() => (window.location.href = "mailto:hello@fboly.ru")}>Написать в поддержку</button>
        </div>
      </div>
    </div>
  );
}
