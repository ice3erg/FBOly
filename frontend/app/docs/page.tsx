"use client";

import { BrandMark } from "../BrandMark";
import { useRouter } from "next/navigation";
import nav from "../marketing-chrome.module.css";
import styles from "./docs.module.css";

const TOC = [
  {
    group: "Начало работы",
    links: [
      { href: "#quickstart", label: "Быстрый старт" },
      { href: "#connect-ozon", label: "Подключение Ozon" },
    ],
  },
  {
    group: "Поставки",
    links: [
      { href: "#excel-format", label: "Формат Excel-файла" },
      { href: "#clusters", label: "Кластеры и черновики" },
      { href: "#crossdock", label: "Прямая поставка и кроссдокинг" },
    ],
  },
  {
    group: "Слоты",
    links: [{ href: "#slot-hunter", label: "Охотник на слоты" }],
  },
  {
    group: "Прочее",
    links: [
      { href: "#limits", label: "Тарифы и лимиты" },
      { href: "#security", label: "Безопасность данных" },
    ],
  },
];

export default function DocsPage() {
  const router = useRouter();

  return (
    <div>
      <nav className={nav.nav}>
        <a className={nav.navLogo} href="/">
          <BrandMark height={30} />
        </a>
        <div className={nav.navLinks}>
          <a className={nav.navLink} href="/pricing">Тарифы</a>
          <a className={nav.navLink} href="/faq">FAQ</a>
          <a className={`${nav.navLink} ${nav.navLinkActive}`} href="/docs">Документация</a>
        </div>
        <div className={nav.navBtns}>
          <button className={nav.btnOutline} onClick={() => router.push("/auth")}>Войти</button>
          <button className={nav.btnFilled} onClick={() => router.push("/auth")}>Регистрация</button>
        </div>
      </nav>

      <div className={nav.hero}>
        <div className={nav.badge}>Документация</div>
        <h1 className={nav.h1}>Как работает FBOly</h1>
        <p className={nav.sub}>От загрузки Excel до брони слота на складе Ozon — пошагово.</p>
      </div>

      <div className={styles.layout}>
        <aside className={styles.toc}>
          {TOC.map((g) => (
            <div key={g.group}>
              <div className={styles.tocGroupLabel}>{g.group}</div>
              {g.links.map((l) => (
                <a key={l.href} className={styles.tocLink} href={l.href}>{l.label}</a>
              ))}
            </div>
          ))}
        </aside>

        <div className={styles.content}>
          <section id="quickstart" className={styles.section}>
            <div className={styles.sectionKicker}>Начало работы</div>
            <h2 className={styles.sectionTitle}>Быстрый старт</h2>
            <p className={styles.p}>Весь путь от регистрации до забронированного слота занимает три шага.</p>
            <div className={styles.stepList}>
              <div className={styles.stepRow}><div className={styles.stepNum}>1</div><div className={styles.stepText}>Зарегистрируйтесь и подключите магазин Ozon — <b>Client-Id и API Key</b> из раздела «Настройки → API» в Ozon Seller.</div></div>
              <div className={styles.stepRow}><div className={styles.stepNum}>2</div><div className={styles.stepText}>На странице <b>Поставка</b> загрузите Excel с товарами — система рассчитает кластеры и создаст черновики через Ozon API.</div></div>
              <div className={styles.stepRow}><div className={styles.stepNum}>3</div><div className={styles.stepText}>На странице <b>Слоты</b> запустите Охотника — он найдёт и забронирует доступное окно приёмки автоматически.</div></div>
            </div>
            <a className={styles.nextCard} href="/auth">
              <div><div className={styles.nextCardLabel}>Далее</div><div className={styles.nextCardTitle}>Зарегистрироваться и начать →</div></div>
            </a>
          </section>

          <section id="connect-ozon" className={styles.section}>
            <div className={styles.sectionKicker}>Начало работы</div>
            <h2 className={styles.sectionTitle}>Подключение Ozon</h2>
            <p className={styles.p}>
              В личном кабинете Ozon Seller откройте <span className={styles.inlineCode}>Настройки → API-ключи</span> и создайте новый ключ
              (или скопируйте существующий). Вставьте <span className={styles.inlineCode}>Client-Id</span> и{" "}
              <span className={styles.inlineCode}>Api-Key</span> в разделе «Магазин» FBOly и нажмите «Проверить».
            </p>
            <div className={styles.calloutInfo}>Можно подключить несколько магазинов Ozon и переключаться между ними в разделе «Магазин».</div>
            <p className={styles.p}>Если проверка вернула ошибку — чаще всего ключ отозван или введён с лишним пробелом. Перевыпустите его в Ozon Seller.</p>
          </section>

          <section id="excel-format" className={styles.section}>
            <div className={styles.sectionKicker}>Поставки</div>
            <h2 className={styles.sectionTitle}>Формат Excel-файла</h2>
            <p className={styles.p}>Файл должен быть в формате <span className={styles.inlineCode}>.xlsx</span> или <span className={styles.inlineCode}>.xls</span> и содержать как минимум:</p>
            <table className={styles.table}>
              <thead><tr><th>Колонка</th><th>Описание</th></tr></thead>
              <tbody>
                <tr><td>offer_id</td><td>Артикул товара, как в Ozon Seller</td></tr>
                <tr><td>quantity</td><td>Количество к отгрузке</td></tr>
                <tr><td>name</td><td>Название товара (необязательно, для читаемости)</td></tr>
              </tbody>
            </table>
            <p className={styles.p}>После загрузки система сверяет офера с данными Ozon по остаткам и продажам, чтобы распределить количество по складам.</p>
            <div className={styles.calloutWarn}>Если офер не находится в Ozon или количество указано некорректно — строка попадёт в список ошибок обработки, а не заблокирует всю поставку.</div>
          </section>

          <section id="clusters" className={styles.section}>
            <div className={styles.sectionKicker}>Поставки</div>
            <h2 className={styles.sectionTitle}>Кластеры и черновики</h2>
            <p className={styles.p}>
              Ozon группирует склады в логистические кластеры (например, «Москва — Юг», «СПб — Осиновая»). FBOly рассчитывает, сколько товара
              нужно отправить в каждый кластер, и создаёт для него отдельный <b>черновик</b> через Ozon Seller API.
            </p>
            <p className={styles.p}>На странице «Поставка» можно выбрать, какие кластеры включить — снятие кластера пересчитывает распределение по оставшимся автоматически.</p>
          </section>

          <section id="crossdock" className={styles.section}>
            <div className={styles.sectionKicker}>Поставки</div>
            <h2 className={styles.sectionTitle}>Прямая поставка и кроссдокинг</h2>
            <p className={styles.p}><b>Прямая поставка</b> — груз едет напрямую на склад каждого выбранного кластера.</p>
            <p className={styles.p}><b>Кроссдокинг</b> — вся партия одной поставкой уезжает в единую точку отгрузки, а Ozon сам развозит товар по складам дальше. Точку кроссдокинга можно найти поиском по городу на странице «Поставка».</p>
          </section>

          <section id="slot-hunter" className={styles.section}>
            <div className={styles.sectionKicker}>Слоты</div>
            <h2 className={styles.sectionTitle}>Охотник на слоты</h2>
            <p className={styles.p}>
              После создания черновиков переходите на страницу «Слоты». Укажите диапазон дат/времени и формат поставки (короба/паллеты),
              выберите города для охоты и нажмите «Начать охоту».
            </p>
            <p className={styles.p}>
              В режиме <b>«Автоматически бронировать»</b> система сразу захватывает первый подходящий слот. В режиме уведомления она только
              сообщает о найденном окне, а бронирование остаётся за вами.
            </p>
            <div className={styles.calloutInfo}>Приоритетные города проверяются чаще остальных — используйте это для складов, куда сложнее поймать слот.</div>
          </section>

          <section id="limits" className={styles.section}>
            <div className={styles.sectionKicker}>Прочее</div>
            <h2 className={styles.sectionTitle}>Тарифы и лимиты</h2>
            <p className={styles.p}>
              Тариф «Старт» ограничен 5 поставками в месяц и 50 SKU на поставку, без охотника на слоты. Полное сравнение — на странице{" "}
              <a href="/pricing">Тарифов</a>.
            </p>
          </section>

          <section id="security" className={styles.section}>
            <div className={styles.sectionKicker}>Прочее</div>
            <h2 className={styles.sectionTitle}>Безопасность данных</h2>
            <p className={styles.p}>
              Client-Id и API Key хранятся в браузере и используются напрямую для запросов к Ozon Seller API — FBOly не хранит их на своих
              серверах и не передаёт третьим лицам. API Key от Ozon Seller не даёт доступа к финансовым операциям.
            </p>
            <a className={styles.nextCard} href="/faq">
              <div><div className={styles.nextCardLabel}>Ещё вопросы?</div><div className={styles.nextCardTitle}>Смотрите частые вопросы →</div></div>
            </a>
          </section>
        </div>
      </div>
    </div>
  );
}
