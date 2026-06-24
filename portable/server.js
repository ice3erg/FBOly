const http = require("node:http");
const zlib = require("node:zlib");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT || 3000);
const OZON_API_BASE_URL = process.env.OZON_API_BASE_URL || "https://api-seller.ozon.ru";
const APP_VERSION = "2026-06-24-crossdock-no-warehouses-timeslot";
const OZON_ALLOW_LEGACY_DRAFT_API = process.env.OZON_ALLOW_LEGACY_DRAFT_API === "1";
const OZON_FBO_DRAFT_FLOW = process.env.OZON_FBO_DRAFT_FLOW || "direct";
const FRONTEND_DIST_DIR = path.resolve(__dirname, "..", "frontend", "out");
const STATIC_MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const DEFAULT_WAREHOUSES = [
  { name: "Москва_Хоругвино", percentage: 50 },
  { name: "Санкт-Петербург", percentage: 30 },
  { name: "Казань", percentage: 20 },
];
const NEW_PRODUCT_MAJOR_WAREHOUSES = [
  { key: "moscow", name: "Москва, МО и Дальние регионы", weight: 35, pattern: /(моск|мо\b|м\.о|хоруг|пушки|жук|домод|ногин|электростал|чехов|подольск|раменск|коледино|тула|калуг|рязан|владимир|иванов|костром|смолен|брянск|орёл|орел|центр|москов)/i },
  { key: "spb", name: "Санкт-Петербург и СЗО", weight: 25, pattern: /(санкт|спб|питер|ленинград|сзо|шушар|бугр|парнас|северо)/i },
  { key: "kazan", name: "Казань", weight: 15, pattern: /(казан|татар|поволж|приволж)/i },
  { key: "rostov", name: "Ростов", weight: 10, pattern: /(ростов|южн)/i },
  { key: "ekb", name: "Екатеринбург", weight: 10, pattern: /(екатерин|екб|свердлов|урал|челяб)/i },
  { key: "voronezh", name: "Воронеж", weight: 5, pattern: /(воронеж|черноз|липец|белгород|курск)/i },
];
const CITY_CLUSTER_RULES = [
  { name: "Дальний Восток", pattern: /(дальн.*вост|владивосток|хабаров|благовещен|сахалин|якут|камчат|уссур)/i },
  { name: "Москва, МО и Дальние регионы", pattern: /(моск|мо\b|м\.о|московск|хоруг|пушки|жук|домод|давид|петровск|томилино|софьино|гривно|ногин|электростал|чехов|подольск|раменск|коледино|тула|калуг|рязан|владимир|иванов|костром|смолен|брянск|центр|хаб_мск|мск)/i },
  { name: "Тверь", pattern: /(твер)/i },
  { name: "Ярославль", pattern: /(ярослав)/i },
  { name: "Санкт-Петербург и СЗО", pattern: /(санкт|спб|питер|ленинград|сзо|шушар|бугр|парнас|волхон|колпино|порошкино|московское|северо)/i },
  { name: "Екатеринбург", pattern: /(екатерин|екб|свердлов|челяб|урал)/i },
  { name: "Пермь", pattern: /(перм)/i },
  { name: "Оренбург", pattern: /(оренбург)/i },
  { name: "Самара", pattern: /(самар|тольят)/i },
  { name: "Казань", pattern: /(казан|татар|столбище|зелёнодольск|зеленодольск|взл[её]т|аэропорт|тэцевск|нижн|нижегород|новгород|дзержинск)/i },
  { name: "Ростов", pattern: /(ростов)/i },
  { name: "Воронеж", pattern: /(воронеж|черноз|липец|белгород|курск)/i },
  { name: "Новосибирск", pattern: /(новосибир|обь)/i },
  { name: "Краснодар", pattern: /(краснодар|адыг|новороссийск)/i },
  { name: "Уфа", pattern: /(уфа|башкир)/i },
  { name: "Омск", pattern: /(омск)/i },
  { name: "Тюмень", pattern: /(тюм|тура)/i },
  { name: "Красноярск", pattern: /(краснояр)/i },
  { name: "Саратов", pattern: /(саратов)/i },
  { name: "Калининград", pattern: /(калининград)/i },
  { name: "Беларусь", pattern: /(беларус|минск)/i },
  { name: "Астана", pattern: /(астан)/i },
  { name: "Алматы", pattern: /(алмат)/i },
  { name: "Махачкала", pattern: /(махачкал|дагест)/i },
  { name: "Невинномысск", pattern: /(невинномыс)/i },
];
const OZON_MAX_RETRIES = 4;
const OZON_DRAFT_MAX_RETRIES = 3;
const OZON_MIN_REQUEST_DELAY_MS = 450;
const OZON_GLOBAL_MIN_REQUEST_DELAY_MS = Number(process.env.OZON_GLOBAL_MIN_REQUEST_DELAY_MS || 2500);
const OZON_GLOBAL_RATE_LIMIT_COOLDOWN_MS = Number(process.env.OZON_GLOBAL_RATE_LIMIT_COOLDOWN_MS || 60000);
const OZON_DRAFT_REQUEST_DELAY_MS = 1200;
const OZON_DRAFT_CREATE_QUIET_PERIOD_MS = Number(process.env.OZON_DRAFT_CREATE_QUIET_PERIOD_MS || 15000);
const OZON_DRAFT_CANDIDATE_DELAY_MS = 3000;
const OZON_DRAFT_POLL_DELAY_MS = 2500;
const OZON_SLOT_REQUEST_DELAY_MS = 3500;
const OZON_SLOT_RATE_LIMIT_COOLDOWN_MS = Number(process.env.OZON_SLOT_RATE_LIMIT_COOLDOWN_MS || 12000);
const OZON_BOOKING_RATE_LIMIT_COOLDOWN_MS = 180000;
const OZON_SLOT_DRAFT_SPACING_MS = 30000;
const OZON_AFTER_DRAFT_SLOT_DELAY_MS = 20000;
const OZON_BEFORE_BOOKING_DELAY_MS = 15000;
const OZON_CLASSIC_DRAFT_POLL_DELAY_MS = Number(process.env.OZON_CLASSIC_DRAFT_POLL_DELAY_MS || 20000);
const OZON_CLASSIC_DRAFT_INFO_MAX_ATTEMPTS = Number(process.env.OZON_CLASSIC_DRAFT_INFO_MAX_ATTEMPTS || 7);
const OZON_DRAFT_RATE_LIMIT_COOLDOWN_MS = Number(process.env.OZON_DRAFT_RATE_LIMIT_COOLDOWN_MS || 15000);
const OZON_DRAFT_CREATE_ROUTE_MAX_ATTEMPTS = Number(process.env.OZON_DRAFT_CREATE_ROUTE_MAX_ATTEMPTS || 1);
const DRAFT_CREATION_JOB_RATE_LIMIT_COOLDOWN_MS = Number(process.env.DRAFT_CREATION_JOB_RATE_LIMIT_COOLDOWN_MS || 25000);
const DRAFT_CREATION_JOB_MAX_ATTEMPTS_PER_TARGET = Number(process.env.DRAFT_CREATION_JOB_MAX_ATTEMPTS_PER_TARGET || 8);
const DRAFT_CREATION_SPACING_MS = Number(process.env.DRAFT_CREATION_SPACING_MS || 7000);
const TARGET_STOCK_DAYS = 21;
const ANALYTICS_PERIOD_DAYS = 30;
const MIN_OUTPUT_CLUSTER_QUANTITY = Number(process.env.MIN_OUTPUT_CLUSTER_QUANTITY || 15);
const SLOT_HUNTER_DEFAULT_INTERVAL_SECONDS = 30;
const SLOT_HUNTER_MIN_INTERVAL_SECONDS = 15;
const SLOT_HUNTER_DEFAULT_MAX_MINUTES = 240;
const SLOT_HUNTER_MAX_ATTEMPTS_PER_TARGET = 2000;

const TEMPLATE_COLUMNS = ["артикул", "имя (необязательно)", "количество"];
const INPUT_TEMPLATE_COLUMNS = ["SKU Ozon", "артикул", "название товара", "количество", "комментарий"];
const SKU_ALIASES = new Set(["sku ozon", "ozon sku", "sku", "озон sku", "sku озон", "ozon id", "озон id"]);
const OFFER_ID_ALIASES = new Set(["артикул", "offer_id", "offer id", "offerid", "vendor code", "код товара"]);
const NAME_ALIASES = new Set(["название", "название товара", "имя", "имя товара", "name", "product name", "товар"]);
const QUANTITY_ALIASES = new Set(["количество", "кол-во", "кол во", "qty", "quantity", "штук"]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

const draftCreationJobs = new Map();
const slotHunterJobs = new Map();
const ozonThrottleStates = new Map();
const ozonRequestLog = [];

function html() {
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ozon FBO Excel</title>
  <style>
    :root { color-scheme: light; --blue:#2563eb; --green:#0f766e; --red:#dc2626; --border:#d7dee8; --muted:#657386; --bg:#f7fafc; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: Arial, sans-serif; background:var(--bg); color:#101827; }
    header { background:white; border-bottom:1px solid var(--border); padding:20px 28px; }
    h1 { margin:0; font-size:28px; }
    header p { margin:6px 0 0; color:var(--muted); }
    main { display:grid; grid-template-columns: 390px 1fr; gap:20px; padding:24px; max-width:1280px; margin:0 auto; }
    .card { background:white; border:1px solid var(--border); border-radius:8px; padding:20px; box-shadow:0 14px 38px rgba(15,23,42,.06); }
    .card + .card { margin-top:20px; }
    h2 { margin:0 0 6px; font-size:19px; }
    .hint { margin:0 0 16px; color:var(--muted); font-size:14px; }
    label { display:block; font-size:14px; font-weight:700; margin:14px 0 7px; }
    input[type=text], input[type=password], input[type=number] { width:100%; height:40px; border:1px solid var(--border); border-radius:6px; padding:8px 10px; font-size:14px; background:white; }
    input[type=file] { width:100%; border:1px dashed var(--border); border-radius:8px; padding:28px; background:#f1f5f9; }
    button { height:40px; border:0; border-radius:6px; padding:0 14px; font-weight:700; background:var(--blue); color:white; cursor:pointer; }
    button.secondary { background:var(--green); }
    button.outline { background:white; color:#101827; border:1px solid var(--border); }
    button:disabled { opacity:.55; cursor:not-allowed; }
    .row { display:grid; grid-template-columns: 1fr 92px; gap:12px; align-items:end; }
    .status { border-radius:8px; padding:12px; margin-top:14px; font-size:14px; background:#eef2f7; color:#334155; }
    .status.ok { background:#dff8ef; color:#0f766e; }
    .status.err { background:#fee2e2; color:#b91c1c; }
    .actions { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-top:18px; }
    .file-grid { display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap:12px; }
    .file { border:1px solid var(--border); border-radius:8px; padding:14px; }
    table { width:100%; border-collapse:collapse; font-size:14px; }
    th, td { border-top:1px solid var(--border); padding:9px; text-align:left; }
    th { background:#eef2f7; border-top:0; }
    .errors .item { border:1px solid #fecaca; background:#fff1f2; border-radius:8px; padding:12px; margin-top:10px; }
    @media (max-width: 900px) { main { grid-template-columns:1fr; padding:14px; } .file-grid { grid-template-columns:1fr; } }
  </style>
</head>
<body>
  <header>
    <h1>Ozon FBO Excel</h1>
    <p>Локальный сервис без Docker: введите API Ozon, загрузите Excel и скачайте файлы поставки</p>
    <p class="hint" style="margin-top:4px;">Версия: ${APP_VERSION}</p>
  </header>
  <main>
    <aside>
      <section class="card">
        <h2>Доступ Ozon</h2>
        <p class="hint">Ключи используются только для текущей обработки.</p>
        <div class="status">
          Для расчёта нужны: <b>Admin read only</b>, Product read-only, Warehouse, Report.
          Для создания черновиков поставок нужен <b>Supply order</b> или <b>Admin</b>.
        </div>
        <label for="clientId">Client-Id</label>
        <input id="clientId" type="text" autocomplete="off" />
        <label for="apiKey">Api-Key</label>
        <input id="apiKey" type="password" autocomplete="off" />
        <label style="display:flex;gap:8px;align-items:center;font-weight:400;">
          <input id="saveApi" type="checkbox" />
          Сохранить API в этом браузере
        </label>
        <div class="actions">
          <button class="outline" type="button" onclick="checkOzon()">Проверить подключение</button>
          <button class="outline" type="button" onclick="loadOzonWarehouses()">Загрузить склады Ozon</button>
        </div>
        <div id="connectionStatus" class="status">Можно сначала проверить ключи.</div>
      </section>
      <section class="card">
        <h2>Склады</h2>
        <p class="hint">Для новых товаров без продаж сервис использует крупные склады: Москва, СПБ, Казань, Ростов, Екатеринбург, Воронеж. Остальные склады без потребности пропускаются.</p>
        <div id="warehouses"></div>
        <div id="percentStatus" class="status"></div>
      </section>
    </aside>
    <section>
      <section class="card">
        <h2>Excel с товарами</h2>
        <p class="hint">Поддерживается .xlsx. Колонки: SKU Ozon, артикул, название товара, количество.</p>
        <form id="processForm">
          <input id="file" type="file" accept=".xlsx" required />
          <div class="actions">
            <button id="submitBtn" type="submit">Создать файлы</button>
            <span id="loading" class="hint" style="display:none;margin:0;">Обработка...</span>
          </div>
        </form>
      </section>
      <section id="result" style="display:none;"></section>
    </section>
  </main>
  <script>
    const API_STORAGE_KEY = "ozon-fbo-api-credentials";
    let warehouses = ${JSON.stringify(DEFAULT_WAREHOUSES)};
    let lastArchive = null;
    let lastDraftCandidates = [];
    function initSavedApi() {
      try {
        const saved = JSON.parse(localStorage.getItem(API_STORAGE_KEY) || "null");
        if (!saved) return;
        clientId.value = saved.clientId || "";
        apiKey.value = saved.apiKey || "";
        saveApi.checked = true;
      } catch {
        localStorage.removeItem(API_STORAGE_KEY);
      }
    }
    function persistApi() {
      if (saveApi.checked) {
        localStorage.setItem(API_STORAGE_KEY, JSON.stringify({
          clientId: clientId.value.trim(),
          apiKey: apiKey.value.trim(),
        }));
      } else {
        localStorage.removeItem(API_STORAGE_KEY);
      }
    }
    function renderWarehouses() {
      document.getElementById("warehouses").innerHTML = warehouses.map((warehouse, index) => \`
        <div class="row">
          <div>
            <label>\${warehouse.name}</label>
            <input type="number" min="0" max="100" step="1" value="\${warehouse.percentage}" onchange="setWarehouse(\${index}, this.value)" />
          </div>
          <div style="padding-bottom:10px;color:#657386;">%</div>
        </div>
      \`).join("");
      updatePercentStatus();
    }
    function setWarehouse(index, value) {
      warehouses[index].percentage = Number(value) || 0;
      updatePercentStatus();
    }
    function updatePercentStatus() {
      const total = warehouses.reduce((sum, warehouse) => sum + warehouse.percentage, 0);
      const element = document.getElementById("percentStatus");
      element.textContent = "Сумма: " + total + "%. В auto-режиме Ozon распределяет сам; проценты нужны только как запасной вариант.";
      element.className = "status " + (Math.abs(total - 100) < 0.001 ? "ok" : "");
    }
    async function checkOzon() {
      const status = document.getElementById("connectionStatus");
      status.className = "status";
      status.textContent = "Проверяем... Если Ozon ограничит запросы, сервис сам подождёт и повторит.";
      try {
        const response = await fetch("/api/ozon/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ client_id: clientId.value.trim(), api_key: apiKey.value.trim() })
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.detail || "Ошибка подключения");
        persistApi();
        status.className = "status ok";
        status.textContent = payload.message || "Подключение работает";
      } catch (error) {
        status.className = "status err";
        status.textContent = error.message || "Ошибка подключения. Если это лимит Ozon, подождите 10-20 секунд.";
      }
    }
    async function loadOzonWarehouses() {
      const status = document.getElementById("connectionStatus");
      status.className = "status";
      status.textContent = "Загружаем склады Ozon...";
      try {
        const response = await fetch("/api/ozon/warehouses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ client_id: clientId.value.trim(), api_key: apiKey.value.trim() })
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.detail || "Не удалось загрузить склады");
        warehouses = payload.warehouses;
        persistApi();
        renderWarehouses();
        status.className = "status ok";
        status.textContent = "Склады загружены: " + warehouses.length + ". Для новых товаров веса расставлены по крупным складам.";
      } catch (error) {
        status.className = "status err";
        status.textContent = error.message || "Ошибка загрузки складов";
      }
    }
    document.getElementById("processForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData();
      formData.append("file", document.getElementById("file").files[0]);
      formData.append("warehouse_percentages", JSON.stringify(warehouses));
      formData.append("ozon_client_id", clientId.value.trim());
      formData.append("ozon_api_key", apiKey.value.trim());
      persistApi();
      loading.style.display = "inline";
      submitBtn.disabled = true;
      try {
        const response = await fetch("/api/process", { method: "POST", body: formData });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.detail || "Ошибка обработки");
        renderResult(payload);
      } catch (error) {
        document.getElementById("result").style.display = "block";
        document.getElementById("result").innerHTML = '<section class="card"><div class="status err">' + escapeHtml(error.message || "Ошибка обработки") + '</div></section>';
      } finally {
        loading.style.display = "none";
        submitBtn.disabled = false;
      }
    });
    function renderResult(payload) {
      lastArchive = payload.archive_base64;
      lastDraftCandidates = payload.draft_candidates || [];
      const files = payload.files.map(file => \`
        <div class="file">
          <b>\${escapeHtml(file.warehouse)}</b>
          <p class="hint" style="margin:8px 0;">\${file.rows_count} строк, \${file.total_quantity} шт.</p>
        </div>
      \`).join("");
      const drafts = renderDraftSection(lastDraftCandidates);
      const errors = payload.errors.length ? \`
        <section class="card errors">
          <h2>Ошибки поиска</h2>
          \${payload.errors.map(error => \`
            <div class="item">
              <b>Строка \${error.row_number}</b>
              <div>\${escapeHtml(error.message)}</div>
              <small>SKU: \${escapeHtml(error.input.sku || "-")} | Артикул: \${escapeHtml(error.input.offer_id || "-")} | Название: \${escapeHtml(error.input.name || "-")}</small>
              \${renderDiagnostics(error.diagnostics)}
            </div>
          \`).join("")}
        </section>\` : "";
      document.getElementById("result").style.display = "block";
      document.getElementById("result").innerHTML = \`
        <section class="card">
          <h2>Готовые файлы</h2>
          <p class="hint">\${payload.resolved_items.length} найдено, \${payload.errors.length} с ошибками. Итог: \${payload.total_output_quantity} шт.</p>
          <div class="status \${payload.distribution_mode === "smart" ? "ok" : ""}">\${escapeHtml(payload.distribution_note || "Распределение рассчитано")}</div>
          <div class="file-grid">\${files}</div>
          <div class="actions"><button class="secondary" onclick="downloadZip()">Скачать ZIP</button></div>
        </section>
        \${drafts}
        \${errors}
      \`;
    }
    function renderDraftSection(candidates) {
      if (!Array.isArray(candidates) || !candidates.length) return "";
      const rows = candidates.map((candidate, index) => {
        const disabled = candidate.can_create ? "" : "disabled";
        const checked = candidate.can_create ? "checked" : "";
        const note = candidate.can_create
          ? "кластер Ozon: " + candidate.cluster_ids.join(", ")
          : (candidate.reason || "нет cluster_id для создания черновика");
        return \`
          <label class="file" style="display:block;">
            <input class="draftCandidate" type="checkbox" value="\${index}" \${checked} \${disabled} />
            <b>\${escapeHtml(candidate.warehouse)}</b>
            <p class="hint" style="margin:8px 0;">\${candidate.rows_count} SKU, \${candidate.total_quantity} шт.; \${escapeHtml(note)}</p>
          </label>
        \`;
      }).join("");
      return \`
        <section class="card">
          <h2>Черновики Ozon</h2>
          <p class="hint">Выберите города, подтвердите действие, и сервис создаст черновики FBO в личном кабинете Ozon. Скачать ZIP можно независимо.</p>
          <div class="file-grid">\${rows}</div>
          <div class="actions">
            <button class="secondary" type="button" onclick="createOzonDrafts()">Создать выбранные черновики Ozon</button>
          </div>
          <div id="draftStatus" class="status">Черновики ещё не создавались.</div>
        </section>
      \`;
    }
    async function createOzonDrafts() {
      const checked = Array.from(document.querySelectorAll(".draftCandidate:checked"));
      const selected = checked.map((input) => lastDraftCandidates[Number(input.value)]).filter(Boolean);
      const status = document.getElementById("draftStatus");
      if (!selected.length) {
        status.className = "status err";
        status.textContent = "Выберите хотя бы один город.";
        return;
      }
      const total = selected.reduce((sum, item) => sum + Number(item.total_quantity || 0), 0);
      if (!confirm("Создать " + selected.length + " черновик(а) FBO в Ozon на " + total + " шт.? Это действие появится в личном кабинете Ozon.")) return;
      status.className = "status";
      status.textContent = "Создаём черновики в Ozon. Это может занять несколько минут: сервис делает паузы между городами, чтобы не упереться в лимит.";
      try {
        const response = await fetch("/api/ozon/drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: clientId.value.trim(),
            api_key: apiKey.value.trim(),
            candidates: selected,
          })
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.detail || "Не удалось создать черновики");
        status.className = "status " + (payload.results.every((item) => item.ok) ? "ok" : "err");
        status.innerHTML = payload.results.map((item) => {
          if (item.ok) {
            return "<div><b>" + escapeHtml(item.warehouse) + "</b>: создано, operation_id " + escapeHtml(item.operation_id || "-") + (item.draft_id ? ", draft_id " + escapeHtml(item.draft_id) : "") + "</div>";
          }
          return "<div><b>" + escapeHtml(item.warehouse) + "</b>: ошибка " + escapeHtml(item.error || "неизвестная ошибка") + "</div>";
        }).join("");
      } catch (error) {
        status.className = "status err";
        status.textContent = error.message || "Ошибка создания черновиков";
      }
    }
    function renderDiagnostics(diagnostics) {
      if (!Array.isArray(diagnostics) || !diagnostics.length) return "";
      return '<div class="status" style="margin-top:10px;">Диагностика: ' + diagnostics.map(escapeHtml).join(" / ") + '</div>';
    }
    function downloadZip() {
      if (!lastArchive) return;
      const bytes = base64ToBytes(lastArchive);
      const blob = new Blob([bytes], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "Ozon_FBO_warehouses.zip";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }
    function base64ToBytes(value) {
      const binary = atob(value);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      return bytes;
    }
    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
    }
    initSavedApi();
    renderWarehouses();
  </script>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (req.method === "OPTIONS") {
      return send(res, 204, "", "text/plain; charset=utf-8");
    }
    if (req.method === "GET" && requestUrl.pathname === "/") {
      if (serveFrontendAsset(res, requestUrl.pathname)) return;
      return send(res, 200, html(), "text/html; charset=utf-8");
    }
    if (req.method === "GET" && req.url === "/health") {
      return json(res, 200, { status: "ok", mode: "portable", version: APP_VERSION });
    }
    if (req.method === "GET" && requestUrl.pathname === "/api/ozon/request-log") {
      const clientId = requestUrl.searchParams.get("client_id") || "";
      const seconds = Number(requestUrl.searchParams.get("seconds") || 120);
      return json(res, 200, {
        ok: true,
        version: APP_VERSION,
        requests: getRecentOzonRequests(clientId, {
          windowMs: Math.max(1, Math.min(600, seconds)) * 1000,
          limit: 120,
        }),
      });
    }
    if (req.method === "GET" && req.url === "/api/templates/input") {
      return sendDownload(
        res,
        200,
        createInputTemplateXlsx(),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "FBOly_input_template.xlsx",
      );
    }
    if (req.method === "POST" && req.url === "/api/ozon/check") {
      const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
      const client = new OzonClient(body.client_id, body.api_key);
      await client.checkAccess();
      return json(res, 200, {
        ok: true,
        message: "Подключение работает",
      });
    }
    if (req.method === "POST" && req.url === "/api/ozon/warehouses") {
      const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
      const client = new OzonClient(body.client_id, body.api_key);
      const ozonWarehouses = await client.getFboWarehouses();
      const warehouses = assignFallbackPercentages(
        buildCityClustersFromWarehouses(ozonWarehouses, { knownSupplyCitiesOnly: true }),
      );
      return json(res, 200, {
        ok: true,
        warehouses,
      });
    }
    if (req.method === "POST" && req.url === "/api/ozon/fbo-warehouses/search") {
      const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
      const client = new OzonClient(body.client_id, body.api_key);
      const result = await client.searchFboShippingWarehouses(
        body.search,
        body.supply_type || "CREATE_TYPE_CROSSDOCK",
      );
      return json(res, 200, {
        ok: true,
        points: result.points,
        raw_count: result.raw_count,
      });
    }
    if (req.method === "POST" && req.url === "/api/ozon/drafts") {
      const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
      const client = new OzonClient(body.client_id, body.api_key);
      const candidates = Array.isArray(body.candidates) ? body.candidates : [];
      if (!candidates.length) return json(res, 400, { detail: "Выберите города для создания черновиков" });
      const results = [];
      for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[index];
        let lastError = null;
        let attemptsUsed = 0;
        try {
          if (index > 0) await sleep(OZON_DRAFT_CANDIDATE_DELAY_MS);
          let result = null;
          for (let attempt = 1; attempt <= OZON_DRAFT_CREATE_ROUTE_MAX_ATTEMPTS; attempt += 1) {
            attemptsUsed = attempt;
            try {
              result = await client.createSupplyDraftFromCandidate(candidate);
              break;
            } catch (error) {
              lastError = error;
              if (!isOzonRateLimitError(error) || attempt >= OZON_DRAFT_CREATE_ROUTE_MAX_ATTEMPTS) {
                throw error;
              }
              await sleep(getDraftCreateRetryDelayMs(attempt, error));
            }
          }
          if (!result) throw lastError || new Error("Ozon API не вернул результат создания черновика");
          results.push({
            ok: true,
            warehouse: candidate.warehouse,
            ...result,
            ozon_response: safeJsonSnippet(result.raw_response, 1200),
            attempts_count: attemptsUsed || 1,
          });
        } catch (error) {
          results.push({
            ok: false,
            warehouse: candidate && candidate.warehouse ? candidate.warehouse : "-",
            operation_id: error.operationId || null,
            error: error.message || "Ошибка Ozon API",
            http_status: error.status || null,
            endpoint: error.path || null,
            ozon_response: error.responseText || null,
            recent_ozon_requests: Array.isArray(error.recentRequests) ? error.recentRequests : [],
            retry_after_ms: error.retryAfterMs || null,
            is_rate_limited: Number(error.status) === 429,
            attempts_count: attemptsUsed || OZON_DRAFT_CREATE_ROUTE_MAX_ATTEMPTS,
            supply_mode: candidate && (candidate.supply_mode || candidate.supplyMode) || null,
            drop_off_point_warehouse_id: candidate ? getDropOffPointWarehouseId(candidate) || null : null,
            drop_off_point_warehouse_type: candidate ? getDropOffPointWarehouseType(candidate) || null : null,
            classic_cluster_ids: candidate && Array.isArray(candidate.classic_cluster_ids) ? candidate.classic_cluster_ids : [],
            cluster_ids: candidate && Array.isArray(candidate.cluster_ids) ? candidate.cluster_ids : [],
          });
        }
      }
      return json(res, 200, { ok: results.every((item) => item.ok), results });
    }
    if (req.method === "POST" && requestUrl.pathname === "/api/ozon/draft-jobs") {
      const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
      const candidates = Array.isArray(body.candidates) ? body.candidates : [];
      const createableCandidates = candidates.filter((candidate) => candidate && candidate.can_create !== false);
      if (!createableCandidates.length) {
        return json(res, 400, { detail: "Сначала выберите города для создания черновиков" });
      }
      stopOzonBackgroundJobsForClient(body.client_id, "Stopped before a new draft creation run");
      const job = createDraftCreationJob({
        clientId: body.client_id,
        apiKey: body.api_key,
        candidates: createableCandidates,
      });
      runDraftCreationJob(job.id);
      return json(res, 200, sanitizeDraftCreationJob(job));
    }
    const draftJobMatch = requestUrl.pathname.match(/^\/api\/ozon\/draft-jobs\/([^/]+)$/);
    if (req.method === "GET" && draftJobMatch) {
      const job = draftCreationJobs.get(draftJobMatch[1]);
      if (!job) return json(res, 404, { detail: "Задача создания черновиков не найдена" });
      return json(res, 200, sanitizeDraftCreationJob(job));
    }
    const stopDraftJobMatch = requestUrl.pathname.match(/^\/api\/ozon\/draft-jobs\/([^/]+)\/stop$/);
    if (req.method === "POST" && stopDraftJobMatch) {
      const job = draftCreationJobs.get(stopDraftJobMatch[1]);
      if (!job) return json(res, 404, { detail: "Задача создания черновиков не найдена" });
      stopDraftCreationJob(job, "Остановлено пользователем");
      return json(res, 200, sanitizeDraftCreationJob(job));
    }
    if (req.method === "POST" && requestUrl.pathname === "/api/slot-hunter/jobs") {
      const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
      const candidates = Array.isArray(body.candidates) ? body.candidates : [];
      const createableCandidates = candidates.filter((candidate) => candidate && candidate.can_create !== false);
      if (!createableCandidates.length) {
        return json(res, 400, { detail: "Сначала рассчитайте поставку и выберите города со SKU Ozon" });
      }
      stopOzonBackgroundJobsForClient(body.client_id, "Stopped before a new slot hunter run");
      const job = createSlotHunterJob({
        clientId: body.client_id,
        apiKey: body.api_key,
        candidates: createableCandidates,
        settings: body.settings || {},
      });
      runSlotHunterJob(job.id);
      return json(res, 200, sanitizeSlotHunterJob(job));
    }
    const slotJobMatch = requestUrl.pathname.match(/^\/api\/slot-hunter\/jobs\/([^/]+)$/);
    if (req.method === "GET" && slotJobMatch) {
      const job = slotHunterJobs.get(slotJobMatch[1]);
      if (!job) return json(res, 404, { detail: "Задача охотника не найдена" });
      return json(res, 200, sanitizeSlotHunterJob(job));
    }
    const stopSlotJobMatch = requestUrl.pathname.match(/^\/api\/slot-hunter\/jobs\/([^/]+)\/stop$/);
    if (req.method === "POST" && stopSlotJobMatch) {
      const job = slotHunterJobs.get(stopSlotJobMatch[1]);
      if (!job) return json(res, 404, { detail: "Задача охотника не найдена" });
      stopSlotHunterJob(job, "Остановлено пользователем");
      return json(res, 200, sanitizeSlotHunterJob(job));
    }
    if (req.method === "POST" && req.url === "/api/process") {
      const form = parseMultipart(await readBody(req), req.headers["content-type"] || "");
      const upload = form.files.file;
      if (!upload) return json(res, 400, { detail: "Загрузите .xlsx файл" });
      if (!upload.filename.toLowerCase().endsWith(".xlsx")) {
        return json(res, 400, { detail: "Portable-режим поддерживает .xlsx. Для .xls нужен Python/FastAPI запуск." });
      }
      const manualWarehouses = JSON.parse(form.fields.warehouse_percentages || JSON.stringify(DEFAULT_WAREHOUSES));
      const normalizedManualWarehouses = normalizeWarehousePercentages(manualWarehouses);
      const rows = readXlsxRows(upload.content);
      const items = rowsToItems(rows);
      const clientId = (form.fields.ozon_client_id || "").trim();
      const apiKey = (form.fields.ozon_api_key || "").trim();
      const client = clientId && apiKey ? new OzonClient(clientId, apiKey) : null;
      const { resolved, errors } = await resolveItems(items, client);
      const distributionPlan = client
        ? await buildSmartDistributionPlan(client, resolved, normalizedManualWarehouses)
        : createManualDistributionPlan(normalizedManualWarehouses, "Нет API-ключей, используется ручное распределение");
      const files = createWarehouseFiles(resolved, distributionPlan.warehouses, distributionPlan);
      const draftCandidates = client ? createDraftCandidates(resolved, distributionPlan.warehouses, distributionPlan) : [];
      const archive = createZip(files.map((file) => ({ name: file.filename, data: file.buffer })));
      return json(res, 200, {
        app_version: APP_VERSION,
        files: files.map((file) => ({
          warehouse: file.warehouse,
          filename: file.filename,
          rows_count: file.rowsCount,
          total_quantity: file.totalQuantity,
        })),
        archive_base64: archive.toString("base64"),
        draft_candidates: draftCandidates,
        errors,
        resolved_items: resolved,
        total_input_quantity: resolved.reduce((sum, item) => sum + item.quantity, 0),
        total_output_quantity: files.reduce((sum, file) => sum + file.totalQuantity, 0),
        distribution_mode: distributionPlan.mode,
        distribution_note: distributionPlan.note,
      });
    }
    if (req.method === "GET" && !requestUrl.pathname.startsWith("/api/")) {
      if (serveFrontendAsset(res, requestUrl.pathname)) return;
    }
    return send(res, 404, "Not found", "text/plain; charset=utf-8");
  } catch (error) {
    return json(res, 500, { detail: error.message || "Ошибка сервера" });
  }
});

server.listen(PORT, () => {
  console.log(`Ozon FBO Excel portable service: http://localhost:${PORT}`);
});

function serveFrontendAsset(res, requestPathname) {
  if (!fs.existsSync(FRONTEND_DIST_DIR)) return false;

  let pathname = "/";
  try {
    pathname = decodeURIComponent(requestPathname || "/");
  } catch {
    pathname = "/";
  }

  let relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  if (relativePath.endsWith("/")) relativePath += "index.html";

  const distRoot = path.resolve(FRONTEND_DIST_DIR);
  let filePath = path.resolve(distRoot, relativePath);
  if (!filePath.startsWith(distRoot + path.sep) && filePath !== distRoot) {
    return false;
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    if (path.extname(relativePath)) return false;
    // С trailingSlash: true Next.js генерирует /auth/index.html — пробуем сначала его
    const subIndexPath = path.join(distRoot, relativePath, "index.html");
    if (fs.existsSync(subIndexPath) && fs.statSync(subIndexPath).isFile()) {
      filePath = subIndexPath;
    } else {
      // Фоллбэк на корневой index.html для SPA-навигации
      filePath = path.join(distRoot, "index.html");
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;
    }
  }

  const contentType = STATIC_MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": filePath.includes(`${path.sep}_next${path.sep}`)
      ? "public, max-age=31536000, immutable"
      : "no-cache",
  });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

function send(res, status, body, contentType) {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(body);
}

function sendDownload(res, status, body, contentType, filename) {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(body);
}

function json(res, status, payload) {
  send(res, status, JSON.stringify(payload), "application/json; charset=utf-8");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseMultipart(buffer, contentType) {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) throw new Error("Некорректная multipart форма");
  const boundary = Buffer.from(`--${boundaryMatch[1] || boundaryMatch[2]}`);
  const fields = {};
  const files = {};
  let position = 0;
  while (position < buffer.length) {
    const start = buffer.indexOf(boundary, position);
    if (start < 0) break;
    const next = buffer.indexOf(boundary, start + boundary.length);
    if (next < 0) break;
    let part = buffer.subarray(start + boundary.length, next);
    if (part.slice(0, 2).toString() === "\r\n") part = part.subarray(2);
    if (part.slice(-2).toString() === "\r\n") part = part.subarray(0, -2);
    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd > 0) {
      const headers = part.subarray(0, headerEnd).toString("utf8");
      const content = part.subarray(headerEnd + 4);
      const name = (headers.match(/name="([^"]+)"/) || [])[1];
      const filename = (headers.match(/filename="([^"]*)"/) || [])[1];
      if (name && filename !== undefined) files[name] = { filename, content };
      else if (name) fields[name] = content.toString("utf8");
    }
    position = next;
  }
  return { fields, files };
}

function readXlsxRows(buffer) {
  const zip = unzip(buffer);
  const sharedStrings = readSharedStrings(zip["xl/sharedStrings.xml"]);
  const sheetPath = findFirstSheetPath(zip);
  const sheetXml = zip[sheetPath];
  if (!sheetXml) throw new Error("В XLSX не найден первый лист");
  const rows = [];
  const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(sheetXml))) {
    const values = [];
    const cellRegex = /<c\b([^>]*)>([\s\S]*?)<\/c>/g;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowMatch[1]))) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const ref = (attrs.match(/\br="([A-Z]+)\d+"/) || [])[1];
      const columnIndex = ref ? columnNameToIndex(ref) : values.length;
      values[columnIndex] = readCell(attrs, body, sharedStrings);
    }
    if (values.some((value) => String(value || "").trim())) rows.push(values);
  }
  return rows;
}

function findFirstSheetPath(zip) {
  if (zip["xl/workbook.xml"] && zip["xl/_rels/workbook.xml.rels"]) {
    const workbook = zip["xl/workbook.xml"];
    const rels = zip["xl/_rels/workbook.xml.rels"];
    const relId = (workbook.match(/<sheet\b[^>]*r:id="([^"]+)"/) || [])[1];
    if (relId) {
      const relRegex = new RegExp(`<Relationship[^>]*Id="${escapeRegExp(relId)}"[^>]*Target="([^"]+)"`);
      const target = (rels.match(relRegex) || [])[1];
      if (target) return "xl/" + target.replace(/^\/?xl\//, "");
    }
  }
  return "xl/worksheets/sheet1.xml";
}

function readSharedStrings(xml) {
  if (!xml) return [];
  const values = [];
  const regex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let match;
  while ((match = regex.exec(xml))) {
    const texts = [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((item) => decodeXml(item[1]));
    values.push(texts.join(""));
  }
  return values;
}

function readCell(attrs, body, sharedStrings) {
  const type = (attrs.match(/\bt="([^"]+)"/) || [])[1];
  if (type === "s") {
    const index = Number((body.match(/<v>([\s\S]*?)<\/v>/) || [])[1] || 0);
    return sharedStrings[index] || "";
  }
  if (type === "inlineStr") {
    return decodeXml([...(body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g))].map((item) => item[1]).join(""));
  }
  const value = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
  return value === undefined ? "" : decodeXml(value);
}

function unzip(buffer) {
  const files = {};
  const eocdSignature = 0x06054b50;
  let eocdOffset = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 66000); offset -= 1) {
    if (buffer.readUInt32LE(offset) === eocdSignature) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("Файл не похож на XLSX");
  const entries = buffer.readUInt16LE(eocdOffset + 10);
  let centralOffset = buffer.readUInt32LE(eocdOffset + 16);
  for (let index = 0; index < entries; index += 1) {
    if (buffer.readUInt32LE(centralOffset) !== 0x02014b50) throw new Error("Некорректная ZIP-структура");
    const method = buffer.readUInt16LE(centralOffset + 10);
    const compressedSize = buffer.readUInt32LE(centralOffset + 20);
    const fileNameLength = buffer.readUInt16LE(centralOffset + 28);
    const extraLength = buffer.readUInt16LE(centralOffset + 30);
    const commentLength = buffer.readUInt16LE(centralOffset + 32);
    const localOffset = buffer.readUInt32LE(centralOffset + 42);
    const name = buffer.subarray(centralOffset + 46, centralOffset + 46 + fileNameLength).toString("utf8");
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    let data;
    if (method === 0) data = compressed;
    else if (method === 8) data = zlib.inflateRawSync(compressed);
    else throw new Error(`Неподдерживаемое сжатие XLSX: ${method}`);
    files[name] = data.toString("utf8");
    centralOffset += 46 + fileNameLength + extraLength + commentLength;
  }
  return files;
}

function rowsToItems(rows) {
  if (!rows.length) throw new Error("В Excel нет строк");
  const headers = rows[0].map(normalizeColumn);
  const indexes = {};
  headers.forEach((header, index) => {
    if (SKU_ALIASES.has(header) && indexes.sku === undefined) indexes.sku = index;
    if (OFFER_ID_ALIASES.has(header) && indexes.offer_id === undefined) indexes.offer_id = index;
    if (NAME_ALIASES.has(header) && indexes.name === undefined) indexes.name = index;
    if (QUANTITY_ALIASES.has(header) && indexes.quantity === undefined) indexes.quantity = index;
  });
  if (indexes.quantity === undefined) throw new Error("Не найдена колонка количества");
  const items = [];
  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    const sku = cleanIdentifier(row[indexes.sku]);
    const offerId = cleanIdentifier(row[indexes.offer_id]);
    const name = cleanCell(row[indexes.name]);
    const quantity = parseQuantity(row[indexes.quantity]);
    if (!sku && !offerId && !name && !quantity) continue;
    if (!quantity || quantity <= 0) throw new Error(`Строка ${index + 1}: количество должно быть положительным целым числом`);
    if (!sku && !offerId && !name) throw new Error(`Строка ${index + 1}: нужен SKU Ozon, артикул или название`);
    items.push({ row_number: index + 1, sku, offer_id: offerId, name, quantity });
  }
  if (!items.length) throw new Error("Не найдено заполненных строк");
  return items;
}

async function resolveItems(items, client) {
  const resolved = [];
  const errors = [];

  // Параллельная обработка батчами по 5 — ускоряет в 4-5 раз при большом кол-ве SKU
  const BATCH_SIZE = 5;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(async (item) => {
      if (item.offer_id) {
        let enriched = null;
        let enrichError = null;
        if (client) {
          try {
            enriched = await client.findProduct({
              offer_id: item.offer_id,
              sku: item.sku || item.offer_id,
              name: item.name,
            });
          } catch (error) {
            enrichError = error;
            enriched = null;
          }
        }
        if (enrichError) {
          return { type: "error", value: { row_number: item.row_number, message: `Ошибка Ozon API: ${enrichError.message}`, input: item, diagnostics: client.getLastLookupTrace() } };
        }
        if (client && isLikelyOzonSku(item.offer_id) && !enriched) {
          return { type: "error", value: { row_number: item.row_number, message: "SKU Ozon из колонки артикул не найден через product/info/list, related-sku, остатки, product_id и каталог товаров. Проверьте, что Client-Id относится к нужному кабинету и это именно SKU Ozon, а не штрихкод или ID из другого кабинета.", input: item, diagnostics: client.getLastLookupTrace() } };
        }
        return { type: "resolved", value: { row_number: item.row_number, offer_id: enriched ? enriched.offer_id : item.offer_id, name: (enriched && enriched.name) || item.name, quantity: item.quantity, source: enriched ? "excel_offer_id+ozon_api" : "excel_offer_id", sku: (enriched && enriched.sku) || item.sku || (/^\d+$/.test(item.offer_id) ? item.offer_id : null) } };
      }
      if (!client) {
        return { type: "error", value: { row_number: item.row_number, message: "Для поиска по SKU или названию введите Client-Id и Api-Key", input: item } };
      }
      try {
        const product = await client.findProduct({ sku: item.sku, name: item.name });
        if (!product) return { type: "error", value: { row_number: item.row_number, message: buildProductNotFoundMessage(item), input: item, diagnostics: client.getLastLookupTrace() } };
        return { type: "resolved", value: { row_number: item.row_number, offer_id: product.offer_id, name: product.name || item.name, quantity: item.quantity, source: "ozon_api", sku: product.sku || item.sku } };
      } catch (error) {
        return { type: "error", value: { row_number: item.row_number, message: `Ошибка Ozon API: ${error.message}`, input: item, diagnostics: client.getLastLookupTrace() } };
      }
    }));
    for (const result of batchResults) {
      if (result.type === "error") errors.push(result.value);
      else resolved.push(result.value);
    }
  }
  return { resolved, errors };
}

function buildProductNotFoundMessage(item) {
  if (item && item.sku) {
    return "Товар не найден через Ozon Seller API: проверили SKU, related-sku, остатки, product_id и каталог. Если число взято из колонки артикул шаблона Ozon, проверьте, что это именно SKU Ozon из этого кабинета, а не штрихкод, product_id другого кабинета или артикул из чужого ЛК.";
  }
  if (item && item.name) {
    return "Товар не найден через Ozon Seller API по названию. Проверьте, что название совпадает с товаром в этом кабинете Ozon.";
  }
  return "Товар не найден через Ozon Seller API";
}

class OzonClient {
  constructor(clientId, apiKey) {
    if (!clientId || !apiKey) throw new Error("Введите Client-Id и Api-Key");
    this.clientId = cleanIdentifier(clientId) || "default";
    this.headers = { "Client-Id": clientId, "Api-Key": apiKey, "Content-Type": "application/json" };
    this.nameIndex = null;
    this.lookupTrace = [];
    this.nextRequestAt = 0;
  }
  resetLookupTrace() {
    this.lookupTrace = [];
  }
  getLastLookupTrace() {
    return Array.isArray(this.lookupTrace) ? this.lookupTrace.slice(0, 12) : [];
  }
  async tracedLookup(label, action) {
    try {
      const product = await action();
      this.lookupTrace.push(product ? `${label}: найден ${product.offer_id}` : `${label}: пусто`);
      return product;
    } catch (error) {
      this.lookupTrace.push(`${label}: ошибка ${formatLookupError(error)}`);
      throw error;
    }
  }
  async post(path, payload, options = {}) {
    const maxRetries = options.maxRetries ?? OZON_MAX_RETRIES;
    const minDelayMs = options.minDelayMs ?? OZON_MIN_REQUEST_DELAY_MS;
    const throttleScope = options.throttleScope || getOzonThrottleScope(path);
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      let response;
      const startedAt = Date.now();
      const payloadSummary = summarizeOzonPayload(path, payload);
      try {
        await waitForGlobalOzonRequestTurn(this.clientId, throttleScope, Math.max(minDelayMs, OZON_GLOBAL_MIN_REQUEST_DELAY_MS));
        await this.waitForRequestTurn(minDelayMs);
        response = await fetch(`${OZON_API_BASE_URL}${path}`, { method: "POST", headers: this.headers, body: JSON.stringify(payload) });
      } catch (error) {
        recordOzonApiRequest({
          client_id: this.clientId,
          path,
          scope: throttleScope,
          attempt: attempt + 1,
          status: "network_error",
          duration_ms: Date.now() - startedAt,
          payload: payloadSummary,
          error: error.message || "fetch failed",
        });
        throw new Error(
          `Не удалось подключиться к Ozon API (${OZON_API_BASE_URL}). ` +
          `Проверьте интернет, DNS, VPN/прокси или блокировку антивирусом. ` +
          `Техническая причина: ${error.message || "fetch failed"}`,
        );
      }
      const text = await response.text();
      recordOzonApiRequest({
        client_id: this.clientId,
        path,
        scope: throttleScope,
        attempt: attempt + 1,
        status: response.status,
        duration_ms: Date.now() - startedAt,
        payload: payloadSummary,
        response_headers: summarizeOzonResponseHeaders(response),
        response_text: response.ok ? null : text.slice(0, 500),
      });
      if (response.ok) return text ? JSON.parse(text) : {};

      if (response.status === 429 && attempt < maxRetries) {
        const retryDelayMs = getOzonRateLimitDelayMs(response, attempt, options);
        markGlobalOzonRateLimit(this.clientId, throttleScope, retryDelayMs);
        await sleep(retryDelayMs);
        continue;
      }

      const message = buildOzonApiErrorMessage(path, response.status, text);
      const error = new Error(message);
      error.status = response.status;
      error.path = path;
      error.responseText = text.slice(0, 1200);
      error.recentRequests = getRecentOzonRequests(this.clientId, { windowMs: 120000, limit: 40 });
      error.requestPayload = payloadSummary;
      error.retryAfterMs = response.status === 429
        ? getOzonRateLimitDelayMs(response, attempt, options)
        : null;
      if (response.status === 429) markGlobalOzonRateLimit(this.clientId, throttleScope, error.retryAfterMs);
      throw error;
    }
    throw new Error("Ozon API не ответил после нескольких попыток");
  }
  async waitForRequestTurn(minDelayMs) {
    const now = Date.now();
    const waitMs = Math.max(0, this.nextRequestAt - now);
    this.nextRequestAt = Math.max(now, this.nextRequestAt) + minDelayMs;
    if (waitMs > 0) await sleep(waitMs);
  }
  async getWarehouses() {
    let data;
    try {
      data = await this.post("/v2/warehouse/list", {});
    } catch (error) {
      if (!/obsolete|устар/i.test(String(error.message || ""))) throw error;
      data = await this.post("/v1/warehouse/list", {});
    }
    if (Array.isArray(data.result)) return data.result;
    if (data.result && Array.isArray(data.result.warehouses)) return data.result.warehouses;
    return [];
  }
  async getFboWarehouses() {
    const warehouses = [];
    const errors = [];

    for (const clusterType of ["CLUSTER_TYPE_OZON", "CLUSTER_TYPE_CIS"]) {
      try {
        const data = await this.post("/v1/cluster/list", { cluster_type: clusterType });
        warehouses.push(...extractWarehousesFromClusters(data));
      } catch (error) {
        errors.push(error);
      }
    }

    if (!warehouses.length) {
      try {
        const data = await this.post("/v1/cluster/list", {});
        warehouses.push(...extractWarehousesFromClusters(data));
      } catch (error) {
        errors.push(error);
      }
    }

    if (!warehouses.length) {
      try {
        warehouses.push(...await this.getWarehouses());
      } catch (error) {
        errors.push(error);
      }
    }

    if (!warehouses.length && errors.length) throw errors[0];
    return uniqueWarehouses(warehouses);
  }
  async checkAccess() {
    await this.post("/v3/product/list", { filter: { visibility: "ALL" }, last_id: "", limit: 1 });
  }
  async searchFboShippingWarehouses(search, supplyType = "CREATE_TYPE_CROSSDOCK") {
    const cleanSearch = String(search || "").trim();
    if (cleanSearch.length < 4) {
      throw new Error("Введите минимум 4 символа для поиска точки отгрузки Ozon");
    }
    const cleanSupplyType = String(supplyType || "CREATE_TYPE_CROSSDOCK").trim() || "CREATE_TYPE_CROSSDOCK";
    const payloads = [
      { search: cleanSearch, filter_by_supply_type: [cleanSupplyType] },
      { query: cleanSearch, filter_by_supply_type: [cleanSupplyType] },
      { search: cleanSearch, filter: { supply_type: [cleanSupplyType] } },
      { search: cleanSearch, filter_by_supply_type: [cleanSupplyType], limit: 20 },
    ];
    let lastError = null;
    for (const payload of payloads) {
      try {
        const data = await this.post("/v1/warehouse/fbo/list", payload, {
          maxRetries: 0,
          minDelayMs: OZON_DRAFT_REQUEST_DELAY_MS,
          base429DelayMs: 15000,
          rateLimitCooldownMs: 30000,
        });
        const points = extractFboShippingWarehousePoints(data);
        return {
          points,
          raw_count: points.length,
          raw_response: data,
        };
      } catch (error) {
        lastError = error;
        if (error.status === 429) throw error;
        if (error.status && ![400, 404, 422].includes(Number(error.status))) throw error;
      }
    }
    if (lastError) throw lastError;
    return { points: [], raw_count: 0, raw_response: null };
  }
  async getProductInfoList(payload) {
    try {
      return await this.post("/v3/product/info/list", payload);
    } catch (error) {
      if (error.status !== 404) throw error;
      return await this.post("/v2/product/info/list", payload);
    }
  }
  async createSupplyDraft(payload) {
    const clusterIds = normalizePositiveOzonIds(payload.cluster_ids).slice(0, 20);
    if (!clusterIds.length) {
      throw new Error("Для черновика не найден числовой macrolocal_cluster_id Ozon больше 0. Пересчитайте поставку после загрузки складов Ozon.");
    }

    const directErrors = [];
    for (const clusterId of clusterIds) {
      for (const deletionSkuMode of [1, 2]) {
        const directPayload = buildDirectDraftCreatePayload(clusterId, payload.items, deletionSkuMode);
        try {
          return await this.post("/v1/draft/direct/create", directPayload, {
            maxRetries: 0,
            minDelayMs: OZON_DRAFT_REQUEST_DELAY_MS,
            base429DelayMs: 6000,
          });
        } catch (directError) {
          directErrors.push(annotateDraftAttemptError(directError, {
            endpoint: "/v1/draft/direct/create",
            clusterId,
            deletionSkuMode,
          }));
          if (directError.status === 429) throw directError;
          if (isMacrolocalClusterValidationError(directError)) break;
          if (isDeletionSkuModeValidationError(directError)) continue;
          throw enrichDraftCreateError(directErrors);
        }
      }
    }

    throw enrichDraftCreateError(directErrors);
  }
  async createSupplyDraftMultiCluster(payload, deliveryInfo) {
    const clusterIds = normalizePositiveOzonIds(payload.cluster_ids).slice(0, 20);
    if (!clusterIds.length) {
      throw new Error("Для multi-cluster черновика не найден числовой macrolocal_cluster_id Ozon больше 0.");
    }
    if (!deliveryInfo || typeof deliveryInfo !== "object") {
      throw new Error("Multi-cluster черновик требует delivery_info. Сейчас сервис создаёт direct-черновики, где доставка выбирается в Ozon.");
    }
    const multiClusterPayload = {
      clusters_info: clusterIds.map((clusterId) => ({
        macrolocal_cluster_id: clusterId,
        items: payload.items,
      })),
      delivery_info: deliveryInfo,
      deletion_sku_mode: 1,
    };
    return await this.post("/v1/draft/multi-cluster/create", multiClusterPayload, {
      maxRetries: 0,
      minDelayMs: OZON_DRAFT_REQUEST_DELAY_MS,
      base429DelayMs: 6000,
    });
  }
  async createSupplyDraftCrossdock(payload) {
    const normalizedClusterIds = normalizePositiveOzonIds(payload.cluster_ids);
    const clusterIds = (normalizedClusterIds.filter((id) => id >= 1000).length
      ? normalizedClusterIds.filter((id) => id >= 1000)
      : normalizedClusterIds
    ).slice(0, 20);
    const dropOffPointWarehouseId = toPositiveIntegerId(payload.drop_off_point_warehouse_id);
    const dropOffWarehouseType = normalizeDropOffWarehouseType(
      payload.drop_off_point_warehouse_type
        || payload.drop_off_warehouse_type
        || payload.warehouse_type,
    ) || 1;
    if (!clusterIds.length) {
      throw new Error("Для crossdock-черновика не найден числовой macrolocal_cluster_id Ozon больше 0.");
    }
    if (!dropOffPointWarehouseId) {
      throw new Error("Для crossdock-черновика нужен drop_off_point_warehouse_id точки отгрузки Ozon.");
    }

    const attempts = [];
    for (const clusterId of clusterIds) {
      const payloads = buildCrossdockDraftCreatePayloads(clusterId, payload.items, dropOffPointWarehouseId, dropOffWarehouseType);
      for (const item of payloads) {
        try {
          return await this.post(item.endpoint, item.payload, {
            maxRetries: 0,
            minDelayMs: OZON_DRAFT_REQUEST_DELAY_MS,
            base429DelayMs: 6000,
          });
        } catch (error) {
          attempts.push(annotateDraftAttemptError(error, {
            endpoint: item.endpoint,
            clusterId,
            deletionSkuMode: item.payload.deletion_sku_mode,
            dropOffPointWarehouseId,
            dropOffWarehouseType,
            variant: item.variant,
          }));
          if (error.status === 429) throw error;
          if (error.status && ![400, 404, 405, 410, 422].includes(Number(error.status))) throw error;
        }
      }
    }
    throw enrichCrossdockDraftCreateError(attempts);
  }
  async getSupplyDraftInfo(operationId) {
    // /v1/draft/create/info отключён Ozon 16.03.2026 — только v2
    return await this.post("/v2/draft/create/info", { operation_id: operationId }, {
      maxRetries: 1,
      minDelayMs: OZON_DRAFT_REQUEST_DELAY_MS,
      base429DelayMs: 6000,
    });
  }
  async getSupplyDraftInfoByDraftId(draftId) {
    const numericDraftId = toPositiveIntegerId(draftId);
    const payloads = [
      numericDraftId ? { draft_id: numericDraftId } : null,
      { draft_id: cleanIdentifier(draftId) },
      { operation_id: cleanIdentifier(draftId) },
    ].filter(Boolean);
    let lastError = null;
    for (const payload of payloads) {
      try {
        return await this.post("/v2/draft/create/info", payload, {
          maxRetries: 0,
          minDelayMs: OZON_DRAFT_REQUEST_DELAY_MS,
          base429DelayMs: 6000,
        });
      } catch (error) {
        lastError = error;
        if (error.status === 429) throw error;
        if (error.status && ![400, 404, 405, 410].includes(Number(error.status))) throw error;
      }
    }
    if (lastError) throw lastError;
    return null;
  }
  async createLegacySupplyDraft(payload) {
    return await this.post("/v1/draft/create", payload, {
      maxRetries: 0,
      minDelayMs: Math.max(OZON_DRAFT_REQUEST_DELAY_MS, 5000),
      base429DelayMs: OZON_DRAFT_RATE_LIMIT_COOLDOWN_MS,
      rateLimitCooldownMs: OZON_DRAFT_RATE_LIMIT_COOLDOWN_MS,
    });
  }
  async getLegacySupplyDraftInfo(operationId) {
    return await this.post("/v1/draft/create/info", { operation_id: operationId }, {
      maxRetries: 0,
      minDelayMs: Math.max(OZON_DRAFT_REQUEST_DELAY_MS, 3000),
      base429DelayMs: OZON_DRAFT_RATE_LIMIT_COOLDOWN_MS,
      rateLimitCooldownMs: OZON_DRAFT_RATE_LIMIT_COOLDOWN_MS,
    });
  }
  async pollClassicDraftInfo(operationId, attempts = 1, options = {}) {
    const cleanOperationId = cleanIdentifier(operationId);
    if (!cleanOperationId) throw new Error("Ozon РЅРµ РІРµСЂРЅСѓР» operation_id РґР»СЏ С‡РµСЂРЅРѕРІРёРєР°");
    const initialDelayMs = Math.max(0, Number(options.initialDelayMs) || 0);
    let lastInfo = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (attempt === 0 && initialDelayMs > 0) {
        await sleep(initialDelayMs);
      } else if (attempt > 0) {
        await sleep(OZON_CLASSIC_DRAFT_POLL_DELAY_MS);
      }
      lastInfo = await this.getLegacySupplyDraftInfo(cleanOperationId);
      const errors = extractDraftErrors(lastInfo);
      const status = extractDraftStatus(lastInfo);
      const draftId = extractDraftId(lastInfo);
      const warehouseIds = extractAvailableWarehouseIdsFromDraftInfo(lastInfo);
      if (errors.length && !/IN_PROGRESS|PROCESS|PENDING|RUNNING/i.test(status)) {
        const error = new Error(errors.join("; "));
        error.status = 400;
        error.path = "/v1/draft/create/info";
        error.responseText = safeJsonSnippet(lastInfo, 1200);
        throw error;
      }
      if (draftId || /SUCCESS|READY|CREATED|DONE/i.test(status)) {
        return {
          operation_id: cleanOperationId,
          draft_id: draftId,
          status: status || (draftId ? "created" : "accepted"),
          warehouse_ids: warehouseIds,
          errors,
          raw_info: lastInfo,
        };
      }
    }
    return {
      operation_id: cleanOperationId,
      draft_id: extractDraftId(lastInfo),
      status: extractDraftStatus(lastInfo) || "accepted",
      warehouse_ids: extractAvailableWarehouseIdsFromDraftInfo(lastInfo),
      errors: extractDraftErrors(lastInfo),
      raw_info: lastInfo,
    };
  }
  async getClassicSupplyCreateStatus(operationId) {
    return await this.post("/v1/draft/supply/create/status", { operation_id: operationId }, {
      maxRetries: 0,
      minDelayMs: Math.max(OZON_DRAFT_REQUEST_DELAY_MS, 3000),
      base429DelayMs: 60000,
      rateLimitCooldownMs: 90000,
    });
  }
  async pollClassicSupplyCreateStatus(operationId, attempts = 1) {
    const cleanOperationId = cleanIdentifier(operationId);
    if (!cleanOperationId) throw new Error("Ozon РЅРµ РІРµСЂРЅСѓР» operation_id РґР»СЏ Р±СЂРѕРЅРё СЃР»РѕС‚Р°");
    let lastInfo = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (attempt > 0) await sleep(OZON_CLASSIC_DRAFT_POLL_DELAY_MS);
      lastInfo = await this.getClassicSupplyCreateStatus(cleanOperationId);
      const status = extractDraftStatus(lastInfo);
      const errors = extractDraftErrors(lastInfo);
      const supplyOrderId = extractSupplyOrderId(lastInfo);
      if (errors.length && !/IN_PROGRESS|PROCESS|PENDING|RUNNING/i.test(status)) {
        const error = new Error(errors.join("; "));
        error.status = 400;
        error.path = "/v1/draft/supply/create/status";
        error.responseText = safeJsonSnippet(lastInfo, 1200);
        throw error;
      }
      if (supplyOrderId || /SUCCESS|READY|CREATED|DONE|COMPLETED|FINISHED/i.test(status)) {
        return {
          operation_id: cleanOperationId,
          supply_order_id: supplyOrderId,
          status: status || "success",
          pending: false,
          errors,
          raw_info: lastInfo,
        };
      }
    }
    return {
      operation_id: cleanOperationId,
      supply_order_id: extractSupplyOrderId(lastInfo),
      status: extractDraftStatus(lastInfo) || "pending",
      pending: true,
      errors: extractDraftErrors(lastInfo),
      raw_info: lastInfo,
    };
  }
  async getDraftTimeslots(draftId, settings = {}, candidate = {}) {
    const numericDraftId = toPositiveIntegerId(draftId);
    const fallbackNow = new Date();
    const fallbackDateFrom = fallbackNow.toISOString().slice(0, 10);
    const fallbackDateTo = new Date(fallbackNow.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const dateFrom = cleanDateInput(settings.date_from) || fallbackDateFrom;
    const rawDateTo = cleanDateInput(settings.date_to) || fallbackDateTo;
    const dateTo = rawDateTo < dateFrom ? dateFrom : rawDateTo;
    const slotOptions = {
      maxRetries: 0,
      minDelayMs: OZON_SLOT_REQUEST_DELAY_MS,
      base429DelayMs: OZON_SLOT_RATE_LIMIT_COOLDOWN_MS,
      rateLimitCooldownMs: OZON_SLOT_RATE_LIMIT_COOLDOWN_MS,
    };
    if (isCrossdockCandidate(candidate)) {
      // /v1/draft/timeslot/info отключён Ozon 16.03.2026 — используем только v2
      // Для crossdock сначала пробуем БЕЗ selected_cluster_warehouses (таймслот привязан
      // к точке отгрузки, а не к складам назначения), затем с ними как фоллбэк.
      const crossdockBase = {
        draft_id: numericDraftId || draftId,
        date_from: dateFrom,
        date_to: dateTo,
        supply_type: resolveSupplyType(candidate),
      };
      try {
        const data = await this.post("/v2/draft/timeslot/info", crossdockBase, slotOptions);
        if (data && typeof data === "object" && !Array.isArray(data)) {
          data.__request_variant = { supply_type: crossdockBase.supply_type, selected_cluster_warehouses: [] };
        }
        return data;
      } catch (error) {
        if (error.status === 429) throw error;
        // Без складов не вышло — пробуем с selected_cluster_warehouses
        const selectedWarehouses = await this.resolveSelectedClusterWarehouses(draftId, candidate);
        return await this.postWithSelectedClusterWarehouseVariants("/v2/draft/timeslot/info", crossdockBase, selectedWarehouses, slotOptions);
      }
    }
    if (resolveDraftFlow(candidate) === "classic") {
      // classic flow и /v1/draft/timeslot/info отключены — идём через v2 как direct
      const selectedWarehouses = await this.resolveSelectedClusterWarehouses(draftId, candidate);
      return await this.postWithSelectedClusterWarehouseVariants("/v2/draft/timeslot/info", {
        draft_id: numericDraftId || draftId,
        date_from: dateFrom,
        date_to: dateTo,
        supply_type: resolveSupplyType(candidate),
      }, selectedWarehouses, slotOptions);
    }
    // Direct: только v2
    const selectedWarehouses = await this.resolveSelectedClusterWarehouses(draftId, candidate);
    const basePayload = {
      draft_id: numericDraftId || draftId,
      date_from: dateFrom,
      date_to: dateTo,
      supply_type: resolveSupplyType(candidate),
    };
    return await this.postWithSelectedClusterWarehouseVariants("/v2/draft/timeslot/info", basePayload, selectedWarehouses, slotOptions);
  }
  async createSupplyFromDraft(draftId, selectedSlot, settings = {}, candidate = {}) {
    // /v1/draft/supply/create отключён Ozon 16.03.2026 — для всех flow используем v2
    const normalizedSlot = normalizeTimeslotForOzon(selectedSlot);
    if (!normalizedSlot) {
      throw new Error(
        "Ozon вернул слот без полного времени from_in_timezone/to_in_timezone. " +
        "Автобронь остановлена, чтобы не отправлять пустой таймслот.",
      );
    }
    const selectedWarehouses = await this.resolveSelectedClusterWarehouses(draftId, candidate);
    const basePayload = {
      draft_id: toPositiveIntegerId(draftId) || draftId,
      timeslot: normalizedSlot,
      supply_type: resolveSupplyType(candidate),
    };
    // Если при поиске слотов v2 принял конкретный вариант — используем его же при брони
    if (candidate.timeslot_request_variant) {
      return await this.post("/v2/draft/supply/create", {
        ...basePayload,
        supply_type: candidate.timeslot_request_variant.supply_type,
        selected_cluster_warehouses: candidate.timeslot_request_variant.selected_cluster_warehouses,
      }, {
        maxRetries: 0,
        minDelayMs: OZON_SLOT_REQUEST_DELAY_MS,
        base429DelayMs: 15000,
      });
    }
    return await this.postWithSelectedClusterWarehouseVariants("/v2/draft/supply/create", basePayload, selectedWarehouses, {
      maxRetries: 0,
      minDelayMs: OZON_SLOT_REQUEST_DELAY_MS,
      base429DelayMs: 15000,
    });
  }
  async postWithSelectedClusterWarehouseVariants(endpoint, basePayload, selectedWarehouses, options) {
    const variants = buildSelectedClusterWarehousePayloadVariants(selectedWarehouses);
    const supplyTypes = buildSupplyTypeVariants(basePayload.supply_type);
    let lastError = null;
    for (const supply_type of supplyTypes) {
      for (const selected_cluster_warehouses of variants) {
        try {
          const payload = {
            ...basePayload,
            supply_type,
            selected_cluster_warehouses,
          };
          const data = await this.post(endpoint, payload, options);
          if (data && typeof data === "object" && !Array.isArray(data)) {
            data.__request_variant = {
              supply_type,
              selected_cluster_warehouses,
            };
          }
          return data;
        } catch (error) {
          lastError = error;
          if (error.status === 429) throw error;
          if (isSelectedClusterWarehousesValidationError(error) || isSupplyTypeValidationError(error)) {
            // Прикрепляем диагностику: что именно отправили Ozon
            if (!error.__sentVariant) {
              error.__sentVariant = JSON.stringify({ supply_type, selected_cluster_warehouses });
            }
            continue;
          }
          throw error;
        }
      }
    }
    // Если все варианты дали MacrolocalClusterId ошибку — добавляем диагностику и делаем фатальной
    if (lastError && isSelectedClusterWarehousesValidationError(lastError)) {
      const diagInfo = `Варианты: ${variants.map((v) => JSON.stringify(v)).join(" | ")} | selectedWarehouses: ${JSON.stringify(selectedWarehouses.slice(0, 3))}`;
      lastError.message = `${lastError.message} [debug: ${diagInfo}]`;
      // Не крутим ошибку 11 раз — пересоздать черновик
      Object.assign(lastError, { __needRecreateDraft: true });
    }
    throw lastError || new Error("Ozon не принял selected_cluster_warehouses");
  }
  async resolveSelectedClusterWarehouses(draftId, candidate = {}) {
    const cachedDraftWarehouses = normalizeSelectedClusterWarehouses(candidate.selected_cluster_warehouses)
      .filter((item) => candidate.selected_cluster_warehouses_source === "draft_info" || item.source === "draft_info");
    // Используем кэш только если в нём есть настоящий macrolocal_cluster_id (>= 1000)
    const cacheHasMacrolocal = cachedDraftWarehouses.some((item) => item.cluster_id && Number(item.cluster_id) >= 1000);
    if (cachedDraftWarehouses.length && cacheHasMacrolocal) {
      return cachedDraftWarehouses.slice(0, 20);
    }

    // Если macrolocal уже добыт ранее (любым путём) — не делаем лишних запросов к Ozon
    const existingMacrolocal = preferMacrolocalClusterIds(candidate.cluster_ids || []).filter((id) => id >= 1000);
    if (existingMacrolocal.length && candidate.macrolocal_lookup_done) {
      const warehouseIds = normalizePositiveOzonIds(candidate.warehouse_ids);
      if (warehouseIds.length) {
        return buildSelectedClusterWarehousesFromIds(existingMacrolocal, warehouseIds).slice(0, 20);
      }
    }

    let selectedWarehouses = [];
    // Пробуем draft_info только если ещё не получили macrolocal из него
    if (draftId) {
      try {
        const draftInfo = await this.getSupplyDraftInfoByDraftId(draftId);
        selectedWarehouses = extractSelectedClusterWarehousesFromDraftInfo(
          draftInfo,
          candidate.cluster_ids,
        );
        if (selectedWarehouses.length) {
          candidate.selected_cluster_warehouses = selectedWarehouses;
          candidate.selected_cluster_warehouses_source = "draft_info";
          candidate.macrolocal_lookup_done = true;
        }
      } catch (error) {
        if (error.status === 429) throw error;
      }
    }
    if (!selectedWarehouses.length) {
      selectedWarehouses = normalizeSelectedClusterWarehouses(candidate.selected_cluster_warehouses);
    }
    // Если есть warehouse_ids, но нет macrolocal — добираем macrolocal по названию города (один раз)
    const cachedHasMacro = selectedWarehouses.some((item) => item.cluster_id && Number(item.cluster_id) >= 1000);
    if (!cachedHasMacro) {
      let macrolocalIds = preferMacrolocalClusterIds(candidate.cluster_ids || []).filter((id) => id >= 1000);
      if (!macrolocalIds.length && candidate.warehouse && !candidate.macrolocal_lookup_done) {
        try {
          macrolocalIds = (await this.findMacrolocalClusterIdsForWarehouse(candidate.warehouse)).filter((id) => id >= 1000);
          candidate.macrolocal_lookup_done = true;
        } catch (error) {
          if (error.status === 429) throw error;
        }
      }
      if (macrolocalIds.length) {
        const warehouseIds = selectedWarehouses.length
          ? selectedWarehouses.map((item) => item.storage_warehouse_id)
          : normalizePositiveOzonIds(candidate.warehouse_ids);
        const rebuilt = buildSelectedClusterWarehousesFromIds(macrolocalIds, warehouseIds);
        if (rebuilt.length) {
          selectedWarehouses = rebuilt;
          candidate.cluster_ids = uniqueStrings([...(candidate.cluster_ids || []).map(String), ...macrolocalIds.map(String)]);
        }
      }
    }
    if (!selectedWarehouses.length) {
      selectedWarehouses = buildSelectedClusterWarehousesFromIds(candidate.cluster_ids, candidate.warehouse_ids);
    }
    if (!selectedWarehouses.length) {
      throw new Error(
        "Для поиска слотов Ozon требует selected_cluster_warehouses: " +
        "нужны ID складов приёмки storage_warehouse_id. " +
        "Пересоздайте поставку через кнопку «Подготовить» и запустите охотника заново.",
      );
    }
    // v2 требует macrolocal_cluster_id > 0 (и это большой id >= 1000, не classic).
    const hasMacrolocalCluster = selectedWarehouses.some((item) => item.cluster_id && Number(item.cluster_id) >= 1000);
    if (!hasMacrolocalCluster) {
      const diag = JSON.stringify({
        cluster_ids: candidate.cluster_ids || [],
        classic_cluster_ids: candidate.classic_cluster_ids || [],
        warehouse_ids: (candidate.warehouse_ids || []).slice(0, 5),
        warehouse: candidate.warehouse,
        supply_mode: candidate.supply_mode,
        selected: selectedWarehouses.slice(0, 3),
        draft_info: candidate.__draft_info_debug || "нет",
      });
      throw Object.assign(
        new Error(
          "Не удалось найти macrolocal_cluster_id для этого черновика. " +
          "Пересоздайте поставку: нажмите «Подготовить» и запустите охотника заново. " +
          `[debug: ${diag}]`,
        ),
        { __needRecreateDraft: true },
      );
    }
    return selectedWarehouses.slice(0, 20);
  }
  async createSupplyDraftFromCandidate(candidate) {
    const supplyMode = normalizeSupplyMode(candidate.supply_mode || candidate.supplyMode || candidate.delivery_mode || candidate.deliveryMode);
    const draftFlow = supplyMode === "crossdock" ? resolveCrossdockDraftFlow() : resolveDraftFlow(candidate);
    const rawClusterIds = uniqueStrings((candidate.cluster_ids || []).map(cleanIdentifier).filter(Boolean));
    const rawClassicClusterIds = uniqueStrings((
      (candidate.classic_cluster_ids && candidate.classic_cluster_ids.length)
        ? candidate.classic_cluster_ids
        : []
    ).map(cleanIdentifier).filter(Boolean));
    let classicClusterIds = normalizeClassicDraftClusterIds(rawClassicClusterIds);
    let clusterIds = normalizePositiveOzonIds(rawClusterIds);
    if (!clusterIds.length) {
      clusterIds = await this.findMacrolocalClusterIdsForWarehouse(candidate.warehouse);
    }
    if (!classicClusterIds.length && draftFlow === "classic") {
      classicClusterIds = await this.findClassicClusterIdsForWarehouse(candidate.warehouse);
    }
    if (!classicClusterIds.length) classicClusterIds = normalizeClassicDraftClusterIds(clusterIds);
    if (!clusterIds.length) {
      throw new Error(
        `Для города не найден числовой macrolocal_cluster_id Ozon больше 0. ` +
        `Нажмите «Загрузить склады Ozon», заново создайте поставку и повторите. ` +
        `Текущие ID: ${rawClusterIds.length ? rawClusterIds.join(", ") : "нет"}`,
      );
    }
    if (draftFlow === "classic" && !classicClusterIds.length) {
      throw new Error(
        `Classic /v1/draft/create needs the public Ozon cluster ID, but it was not found for "${candidate.warehouse}". ` +
        `Loaded IDs: ${rawClassicClusterIds.length ? rawClassicClusterIds.join(", ") : rawClusterIds.join(", ") || "none"}. ` +
        `Click "Load Ozon cities", recreate the supply, and try again.`,
      );
    }
    const itemMap = new Map();
    for (const item of Array.isArray(candidate.items) ? candidate.items : []) {
      const sku = cleanIdentifier(item.sku);
      const quantity = Number(item.quantity) || 0;
      if (!sku || !/^\d+$/.test(sku) || quantity <= 0) continue;
      itemMap.set(sku, (itemMap.get(sku) || 0) + Math.floor(quantity));
    }
    const items = [...itemMap.entries()].map(([sku, quantity]) => ({
      sku: Number(sku),
      quantity,
    }));
    if (!items.length) throw new Error("Для черновика нет позиций с SKU Ozon");
    if (items.length > 5000) throw new Error("Ozon accepts up to 5000 SKU in one FBO draft. Split the supply into several drafts.");
    if (supplyMode === "crossdock" && draftFlow === "modern") {
      const dropOffPointWarehouseId = getDropOffPointWarehouseId(candidate);
      const createResult = await this.createSupplyDraftCrossdock({
        cluster_ids: clusterIds,
        drop_off_point_warehouse_id: dropOffPointWarehouseId,
        drop_off_point_warehouse_type: getDropOffPointWarehouseType(candidate),
        items,
      });
      const operationId = extractOperationId(createResult);
      const draftId = extractDraftId(createResult);
      if (!operationId && !draftId) {
        const error = new Error(
          `Ozon accepted the crossdock request but did not return operation_id or draft_id. Response: ${safeJsonSnippet(createResult, 900)}`,
        );
        error.status = 200;
        error.path = "/v1/draft/crossdock/create";
        error.responseText = safeJsonSnippet(createResult, 1200);
        throw error;
      }
      return {
        operation_id: operationId,
        draft_id: draftId,
        status: draftId ? "created" : "accepted",
        items_count: items.length,
        total_quantity: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        cluster_ids: clusterIds.map(String), // macrolocal ids использованные при создании
        selected_cluster_warehouses: [],
        selected_cluster_warehouses_source: null,
        supply_type: 2,
        draft_flow: "modern",
        supply_mode: "crossdock",
        drop_off_point_warehouse_id: dropOffPointWarehouseId,
        drop_off_point_warehouse_type: getDropOffPointWarehouseType(candidate),
        errors: extractDraftErrors(createResult),
        raw_response: createResult,
      };
    }
    if (draftFlow === "classic") {
      try {
        const dropOffPointWarehouseId = getDropOffPointWarehouseId(candidate);
        if (supplyMode === "crossdock" && !dropOffPointWarehouseId) {
          throw new Error("For cross-docking enter drop_off_point_warehouse_id: the Ozon shipping point or sorting center ID.");
        }
        const draftPayload = {
          cluster_ids: classicClusterIds.map(String),
          items,
          type: supplyMode === "crossdock" ? "CREATE_TYPE_CROSSDOCK" : "CREATE_TYPE_DIRECT",
        };
        if (supplyMode === "crossdock") draftPayload.drop_off_point_warehouse_id = dropOffPointWarehouseId;
        await waitForOzonQuietPeriod(this.clientId, OZON_DRAFT_CREATE_QUIET_PERIOD_MS);
        const createResult = await this.createLegacySupplyDraft(draftPayload);
      const operationId = extractOperationId(createResult);
      if (!operationId) {
        const error = new Error(
          `Ozon did not return operation_id for classic FBO draft. Response: ${safeJsonSnippet(createResult, 900)}`,
        );
        error.status = 200;
        error.path = "/v1/draft/create";
        error.responseText = safeJsonSnippet(createResult, 1200);
        throw error;
      }
      const draftInfo = await this.pollClassicDraftInfo(
        operationId,
        OZON_CLASSIC_DRAFT_INFO_MAX_ATTEMPTS,
        { initialDelayMs: OZON_CLASSIC_DRAFT_POLL_DELAY_MS },
      );
      const errors = draftInfo.errors || [];
      if (errors.length) {
        const error = new Error(errors.join("; "));
        error.status = 400;
        error.path = "/v1/draft/create/info";
        error.responseText = safeJsonSnippet(draftInfo.raw_info, 1200);
        throw error;
      }
      if (!draftInfo.draft_id) {
        const error = new Error(
          `Ozon принял создание черновика, но после ${OZON_CLASSIC_DRAFT_INFO_MAX_ATTEMPTS} проверок не вернул draft_id. ` +
          `operation_id: ${operationId}. Попробуйте проверить этот operation_id позже или создать черновик ещё раз.`,
        );
        error.status = 202;
        error.path = "/v1/draft/create/info";
        error.operationId = operationId;
        error.responseText = safeJsonSnippet(draftInfo.raw_info, 1200);
        throw error;
      }
      return {
        operation_id: operationId,
        draft_id: draftInfo.draft_id,
        status: "created",
        items_count: items.length,
        total_quantity: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        warehouse_ids: draftInfo.warehouse_ids || [],
        selected_cluster_warehouses: [],
        selected_cluster_warehouses_source: null,
        supply_type: null,
        draft_flow: "classic",
        supply_mode: supplyMode,
        drop_off_point_warehouse_id: getDropOffPointWarehouseId(candidate) || null,
        errors: [],
        raw_response: {
          create: createResult,
          info: draftInfo.raw_info || null,
        },
      };
      } catch (error) {
        if (supplyMode === "crossdock" || !isObsoleteMethodError(error)) throw error;
      }
    }
    if (supplyMode === "crossdock") {
      throw new Error("Ozon не создал crossdock-черновик через /v1/draft/create. Проверьте classic cluster ID, точку отгрузки и роль Supply order/Admin.");
    }
    const createResult = await this.createSupplyDraft({
      cluster_ids: clusterIds,
      items,
      type: "CREATE_TYPE_DIRECT",
    });
    const operationId = extractOperationId(createResult);
    const draftId = extractDraftId(createResult);
    if (!operationId && !draftId) {
      const error = new Error(
        `Ozon принял запрос, но не вернул operation_id или draft_id. ` +
        `Черновик не считаю созданным. Ответ Ozon: ${safeJsonSnippet(createResult, 900)}`,
      );
      error.status = 200;
      error.path = "/v1/draft/direct/create";
      error.responseText = safeJsonSnippet(createResult, 1200);
      throw error;
    }
    const result = {
      operation_id: operationId,
      draft_id: draftId,
      status: draftId ? "created" : "accepted",
      items_count: items.length,
      total_quantity: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      cluster_ids: clusterIds.map(String), // macrolocal ids использованные при создании
      selected_cluster_warehouses: [],
      selected_cluster_warehouses_source: null,
      supply_type: 1,
      draft_flow: "modern",
      supply_mode: "direct",
      errors: [],
      raw_response: createResult,
    };
    return result;
  }
  async waitForDraftSelectedClusterWarehouses(draftId, clusterIds = []) {
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (attempt > 0) await sleep(OZON_DRAFT_POLL_DELAY_MS);
      try {
        const draftInfo = await this.getSupplyDraftInfoByDraftId(draftId);
        const selected = extractSelectedClusterWarehousesFromDraftInfo(draftInfo, clusterIds);
        if (selected.length) return selected;
      } catch (error) {
        lastError = error;
        if (error.status === 429) throw error;
      }
    }
    if (lastError && lastError.status && ![400, 404].includes(Number(lastError.status))) throw lastError;
    return [];
  }
  async findClassicClusterIdsForWarehouse(warehouseName) {
    const cityName = toSupplyClusterName(warehouseName);
    if (!cityName) return [];
    const warehouses = await this.getFboWarehouses();
    const cityClusters = buildCityClustersFromWarehouses(warehouses);
    const match = cityClusters.find((warehouse) => normalizeText(warehouse.name) === normalizeText(cityName));
    return match ? normalizeClassicDraftClusterIds(match.classic_cluster_ids || match.cluster_ids) : [];
  }
  async findMacrolocalClusterIdsForWarehouse(warehouseName) {
    const cityName = toSupplyClusterName(warehouseName);
    if (!cityName) return [];
    const warehouses = await this.getFboWarehouses();
    const cityClusters = buildCityClustersFromWarehouses(warehouses);
    const match = cityClusters.find((warehouse) => normalizeText(warehouse.name) === normalizeText(cityName));
    return match ? normalizePositiveOzonIds(match.cluster_ids) : [];
  }
  async findProduct({ offer_id, sku, name }) {
    this.resetLookupTrace();
    if (offer_id && isLikelyOzonSku(offer_id)) {
      const product = await this.tracedLookup("product/info/list по SKU из артикула", () => this.findByDirectSku(offer_id));
      if (product) return product;
    }
    if (offer_id) {
      const product = await this.tracedLookup("product/info/list по offer_id", async () => firstProduct(await this.getProductInfoList({ offer_id: [offer_id] })));
      if (product) return product;
    }
    const cleanSku = cleanIdentifier(sku);
    if (cleanSku && /^\d+$/.test(cleanSku)) {
      const product = await this.tracedLookup("product/info/list по SKU", () => this.findByDirectSku(cleanSku));
      if (product) return product;
      const relatedProduct = await this.tracedLookup("related-sku", () => this.findByRelatedSku(cleanSku));
      if (relatedProduct) return relatedProduct;
      const stockProduct = await this.tracedLookup("product/info/stocks", () => this.findByStockSku(cleanSku));
      if (stockProduct) return stockProduct;
      const productIdProduct = await this.tracedLookup("product/info/list по product_id", () => this.findByProductId(cleanSku));
      if (productIdProduct) return productIdProduct;
      const indexedProduct = await this.tracedLookup("каталог product/list", () => this.findBySkuInCatalog(cleanSku));
      if (indexedProduct) return indexedProduct;
    }
    if (name) return await this.tracedLookup("поиск по названию", () => this.findByName(name));
    return null;
  }
  async findByDirectSku(value) {
    const sku = cleanIdentifier(value);
    if (!sku || !/^\d+$/.test(sku)) return null;
    const payloads = [{ sku: [sku] }];
    const numericSku = Number(sku);
    if (Number.isSafeInteger(numericSku)) payloads.push({ sku: [numericSku] });
    for (const payload of payloads) {
      try {
        const product = firstProduct(await this.getProductInfoList(payload));
        if (product) return product;
      } catch (error) {
        if (!isRecoverableLookupError(error)) throw error;
      }
    }
    return null;
  }
  async findByName(name) {
    const needle = normalizeText(name);
    const products = await this.getNameIndex();
    return products.find((product) => normalizeText(product.name) === needle)
      || products.find((product) => normalizeText(product.name).includes(needle) || needle.includes(normalizeText(product.name)))
      || null;
  }
  async findBySkuInCatalog(sku) {
    const needle = cleanIdentifier(sku);
    if (!needle) return null;
    const products = await this.getNameIndex();
    return products.find((product) => {
      const candidates = [
        ...(Array.isArray(product.sku_list) ? product.sku_list : []),
        ...(Array.isArray(product.barcode_list) ? product.barcode_list : []),
        product.sku,
        product.product_id,
      ];
      return candidates.map(cleanIdentifier).includes(needle);
    }) || null;
  }
  async findByProductId(value) {
    const productId = cleanIdentifier(value);
    if (!productId || !/^\d+$/.test(productId)) return null;
    const payloads = [];
    const numericId = Number(productId);
    if (Number.isSafeInteger(numericId)) payloads.push({ product_id: [numericId] });
    payloads.push({ product_id: [productId] });
    for (const payload of payloads) {
      try {
        const product = firstProduct(await this.getProductInfoList(payload));
        if (product) return product;
      } catch (error) {
        if (!isRecoverableLookupError(error)) throw error;
      }
    }
    return null;
  }
  async findByRelatedSku(sku) {
    const relatedItems = await this.getRelatedSkus([sku]);
    const productIds = uniqueStrings(
      relatedItems
        .map((item) => item.product_id || item.productId || item.id)
        .filter(Boolean)
        .map(String),
    );
    if (!productIds.length) return null;
    const data = await this.getProductInfoList({ product_id: productIds.slice(0, 100) });
    return firstProduct(data);
  }
  async findByStockSku(sku) {
    const stocks = await this.getStocksBySku(sku);
    const first = stocks.find((item) => item.offer_id || item.product_id || item.id);
    if (!first) return null;
    if (first.offer_id) {
      return {
        offer_id: String(first.offer_id),
        sku: cleanIdentifier(first.sku || first.fbo_sku || sku),
        sku_list: uniqueStrings([first.sku, first.fbo_sku, sku].map(cleanIdentifier).filter(Boolean)),
        name: first.name ? String(first.name) : null,
      };
    }
    const productId = first.product_id || first.id;
    if (!productId) return null;
    return firstProduct(await this.getProductInfoList({ product_id: [String(productId)] }));
  }
  async getStocksBySku(sku) {
    const cleanSku = cleanIdentifier(sku);
    if (!cleanSku) return [];
    const payloads = [
      { filter: { sku: [cleanSku], visibility: "ALL" }, limit: 100, cursor: "" },
      { filter: { sku: [Number(cleanSku)], visibility: "ALL" }, limit: 100, cursor: "" },
    ];
    for (const payload of payloads) {
      try {
        const data = await this.post("/v4/product/info/stocks", payload);
        const items = data.result && Array.isArray(data.result.items) ? data.result.items : Array.isArray(data.items) ? data.items : [];
        if (items.length) return items;
      } catch {
        // Try the next payload shape.
      }
    }
    return [];
  }
  async getRelatedSkus(skus) {
    if (!skus.length) return [];
    const cleanSkus = skus.map(cleanIdentifier).filter(Boolean);
    if (!cleanSkus.length) return [];
    const numericSkus = cleanSkus.map(Number).filter(Number.isSafeInteger);
    const payloads = [
      { sku: cleanSkus },
      ...(numericSkus.length ? [{ sku: numericSkus }] : []),
      { skus: cleanSkus },
      ...(numericSkus.length ? [{ skus: numericSkus }] : []),
    ];
    for (const payload of payloads) {
      try {
        const items = extractRelatedSkuItems(await this.post("/v1/product/related-sku/get", payload));
        if (items.length) return items;
      } catch (error) {
        if (!isRecoverableLookupError(error)) throw error;
      }
    }
    return [];
  }
  async getNameIndex() {
    if (this.nameIndex) return this.nameIndex;
    const list = [];
    let lastId = "";
    while (true) {
      const data = await this.post("/v3/product/list", { filter: { visibility: "ALL" }, last_id: lastId, limit: 1000 });
      const result = data.result || {};
      const items = Array.isArray(result.items) ? result.items : [];
      list.push(...items);
      if (!result.last_id || result.last_id === lastId || !items.length) break;
      lastId = result.last_id;
    }
    const productIds = list.map((item) => Number(item.product_id)).filter(Boolean);
    const products = [];
    for (let index = 0; index < productIds.length; index += 100) {
      const data = await this.getProductInfoList({ product_id: productIds.slice(index, index + 100) });
      const items = extractProductItems(data);
      for (const item of items) {
        const product = parseProduct(item);
        if (product) products.push(product);
      }
    }
    this.nameIndex = products;
    return products;
  }
  async getTurnoverBySku(skus) {
    if (!skus.length) return new Map();
    const data = await this.post("/v1/analytics/turnover/stocks", {
      limit: Math.min(1000, skus.length),
      offset: 0,
      sku: skus.map(String),
    });
    const items = Array.isArray(data.items)
      ? data.items
      : data.result && Array.isArray(data.result.items)
        ? data.result.items
        : [];
    const result = new Map();
    for (const item of items) {
      const sku = String(item.sku || item.fbo_sku || item.seller_sku || "");
      if (!sku) continue;
      result.set(sku, {
        dailySales: Number(item.daily_sales || item.average_daily_sales || item.sales_per_day || 0),
        currentStock: Number(item.current_stock || item.stock || 0),
        turnoverDays: Number(item.turnover_days || 0),
      });
    }
    return result;
  }
  async getStocksOnWarehouses() {
    const rows = [];
    let offset = 0;
    while (offset < 5000) {
      const data = await this.post("/v2/analytics/stock_on_warehouses", {
        limit: 1000,
        offset,
        warehouse_type: "ALL",
      });
      const pageRows = data.result && Array.isArray(data.result.rows) ? data.result.rows : [];
      rows.push(...pageRows);
      if (pageRows.length < 1000) break;
      offset += pageRows.length;
    }
    return rows;
  }
  async getRegionalSalesBySku(skus) {
    if (!skus.length) return new Map();
    const { from, to } = getDateRange(ANALYTICS_PERIOD_DAYS);
    const data = await this.post("/v1/analytics/data", {
      date_from: from,
      date_to: to,
      metrics: ["ordered_units"],
      dimension: ["sku", "region"],
      filters: [],
      sort: [{ key: "ordered_units", order: "DESC" }],
      limit: 1000,
      offset: 0,
    });
    const allowed = new Set(skus.map(String));
    const rows = data.result && Array.isArray(data.result.data) ? data.result.data : [];
    const result = new Map();
    for (const row of rows) {
      const dimensions = Array.isArray(row.dimensions) ? row.dimensions : [];
      const sku = String((dimensions[0] && dimensions[0].id) || (dimensions[0] && dimensions[0].name) || "");
      if (!allowed.has(sku)) continue;
      const regionName = String((dimensions[1] && dimensions[1].name) || (dimensions[1] && dimensions[1].id) || "");
      const warehouseName = toSupplyClusterName(regionName);
      if (!warehouseName) continue;
      const units = Number(Array.isArray(row.metrics) ? row.metrics[0] : 0) || 0;
      if (!result.has(sku)) result.set(sku, new Map());
      result.get(sku).set(warehouseName, (result.get(sku).get(warehouseName) || 0) + units);
    }
    return result;
  }
}

function firstProduct(data) {
  const items = extractProductItems(data);
  for (const item of items) {
    const product = parseProduct(item);
    if (product) return product;
  }
  return null;
}

function extractProductItems(data) {
  if (!data) return [];
  if (data.result && Array.isArray(data.result.items)) return data.result.items;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.result)) return data.result;
  return [];
}

function extractRelatedSkuItems(data) {
  if (!data) return [];
  if (Array.isArray(data.items)) return data.items;
  if (data.result && Array.isArray(data.result.items)) return data.result.items;
  if (Array.isArray(data.result)) return data.result;
  return [];
}

function extractOperationId(data) {
  return findFirstIdentifierByKeys(data, ["operation_id", "operationId"]);
}

function extractDraftId(data) {
  return findFirstIdentifierByKeys(data, ["draft_id", "draftId", "draftID"]);
}

function findFirstIdentifierByKeys(data, keys) {
  if (!data || typeof data !== "object") return cleanIdentifier(data);
  const queue = [data];
  const normalizedKeys = new Set(keys);
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }
    for (const key of Object.keys(current)) {
      const value = current[key];
      if (normalizedKeys.has(key)) {
        const id = cleanIdentifier(value);
        if (id) return id;
      }
      if (value && typeof value === "object") queue.push(value);
    }
  }
  return null;
}

function extractDraftStatus(data) {
  return String(
    data && (
      data.status
      || (data.result && data.result.status)
      || ""
    ),
  ).trim();
}

function extractDraftErrors(data) {
  const errors = data && (
    data.errors
    || data.error_reasons
    || (data.result && data.result.errors)
    || (data.result && data.result.error_reasons)
  );
  return Array.isArray(errors) ? errors.map((item) => typeof item === "string" ? item : JSON.stringify(item)) : [];
}

function normalizeSelectedClusterWarehouses(items) {
  const source = Array.isArray(items) ? items : [];
  const result = [];
  const seen = new Set();
  for (const item of source) {
    if (!item || typeof item !== "object") continue;
    const storageWarehouseId = toPositiveIntegerId(
      item.storage_warehouse_id
      || item.storageWarehouseId
      || item.supply_warehouse_id
      || item.warehouse_id
      || item.warehouseId,
    );
    if (!storageWarehouseId) continue;
    const clusterId = toPositiveIntegerId(
      item.cluster_id
      || item.clusterId
      || item.macrolocal_cluster_id
      || item.macrolocalClusterId
      || item.macrocluster_id
      || item.macroclusterId,
    );
    const key = `${clusterId || "none"}:${storageWarehouseId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const selected = { storage_warehouse_id: storageWarehouseId };
    if (clusterId) selected.cluster_id = clusterId;
    if (item.source) selected.source = String(item.source);
    result.push(selected);
    if (result.length >= 20) break;
  }
  return result;
}

function buildSelectedClusterWarehousesFromIds(clusterIds, warehouseIds) {
  const clusters = preferMacrolocalClusterIds(clusterIds).slice(0, 20);
  const warehouses = normalizePositiveOzonIds(warehouseIds).slice(0, 20);
  if (!warehouses.length) return [];
  const result = [];
  const selectedClusters = clusters.length ? clusters : [null];
  for (const clusterId of selectedClusters) {
    for (const warehouseId of warehouses) {
      const item = { storage_warehouse_id: warehouseId };
      if (clusterId) item.cluster_id = clusterId;
      result.push(item);
      if (result.length >= 20) return normalizeSelectedClusterWarehouses(result);
    }
  }
  return normalizeSelectedClusterWarehouses(result);
}

function buildSelectedClusterWarehousePayloadVariants(selectedWarehouses) {
  const normalized = normalizeSelectedClusterWarehouses(selectedWarehouses);
  if (!normalized.length) return [];
  const first = normalized.slice(0, 1);
  // v2 /draft/timeslot/info требует macrolocal_cluster_id > 0 в каждом элементе.
  // Если cluster_id есть — отправляем варианты с ним (приоритет macrolocal_cluster_id).
  const hasClusterId = first.every((item) => item.cluster_id);
  const withMacrolocalClusterId = first.map((item) => ({
    ...(item.cluster_id ? { macrolocal_cluster_id: item.cluster_id } : {}),
    storage_warehouse_id: item.storage_warehouse_id,
  }));
  const withClusterId = first.map((item) => ({
    ...(item.cluster_id ? { cluster_id: item.cluster_id } : {}),
    storage_warehouse_id: item.storage_warehouse_id,
  }));
  const storageOnly = first.map((item) => ({
    storage_warehouse_id: item.storage_warehouse_id,
  }));
  // Если cluster_id есть — НЕ отправляем storageOnly (Ozon отклонит без macrolocal_cluster_id).
  // Если cluster_id нет — отправляем только storageOnly (хоть какой-то шанс).
  const variants = hasClusterId
    ? [withMacrolocalClusterId, withClusterId]
    : [storageOnly];
  const seen = new Set();
  return variants.filter((variant) => {
    const key = JSON.stringify(variant);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resolveSupplyType(candidate = {}) {
  const raw = candidate.supply_type
    || candidate.supplyType
    || (candidate.cluster_info && candidate.cluster_info.supply_type)
    || (candidate.clusterInfo && candidate.clusterInfo.supplyType);
  const parsed = toPositiveIntegerId(raw);
  return parsed || 1;
}

function resolveDraftFlow(candidate = {}) {
  // ВАЖНО: classic flow использует /v1/draft/create, /v1/draft/create/info,
  // /v1/draft/timeslot/info, /v1/draft/supply/create — все ОТКЛЮЧЕНЫ Ozon с 16.03.2026.
  // Поэтому дефолт — direct (живые методы /v1/draft/direct/create + /v2/draft/*).
  const flow = String(candidate.draft_flow || candidate.draftFlow || OZON_FBO_DRAFT_FLOW || "direct")
    .trim()
    .toLowerCase();
  // Принудительно отводим от мёртвого classic, если его не запросили явно через env
  if (flow === "classic" && OZON_FBO_DRAFT_FLOW !== "classic") {
    return "direct";
  }
  return flow;
}

function resolveCrossdockDraftFlow() {
  return String(process.env.OZON_CROSSDOCK_DRAFT_FLOW || "modern")
    .trim()
    .toLowerCase();
}

function normalizeSupplyMode(value) {
  const text = String(value || "").trim().toLowerCase();
  if (/cross|dock|крос|кросс/i.test(text)) return "crossdock";
  return "direct";
}

function isCrossdockCandidate(candidate = {}) {
  return normalizeSupplyMode(
    candidate.supply_mode
      || candidate.supplyMode
      || candidate.delivery_mode
      || candidate.deliveryMode,
  ) === "crossdock";
}

function getCrossdockTimeslotWarehouseIds(candidate = {}) {
  return normalizePositiveOzonIds([
    getDropOffPointWarehouseId(candidate),
    candidate.drop_off_warehouse_id,
    candidate.dropOffWarehouseId,
    candidate.shipping_point,
    candidate.shippingPoint,
  ]).slice(0, 1);
}

function shouldPollClassicSupplyCreateStatus(candidate = {}) {
  return resolveDraftFlow(candidate) === "classic" || isCrossdockCandidate(candidate);
}

function getDropOffPointWarehouseId(candidate = {}) {
  return toPositiveIntegerId(
    candidate.drop_off_point_warehouse_id
      || candidate.dropOffPointWarehouseId
      || candidate.dropoff_warehouse_id
      || candidate.dropoffWarehouseId
      || candidate.shipping_point
      || candidate.shippingPoint,
  );
}

function getDropOffPointWarehouseType(candidate = {}) {
  return normalizeDropOffWarehouseType(
    candidate.drop_off_point_warehouse_type
      || candidate.dropOffPointWarehouseType
      || candidate.drop_off_warehouse_type
      || candidate.dropOffWarehouseType
      || candidate.warehouse_type
      || candidate.warehouseType,
  );
}

function normalizeDropOffWarehouseType(value) {
  const text = cleanIdentifier(value).toUpperCase();
  if (!text || text === "0" || text === "WAREHOUSE_TYPE_UNSPECIFIED" || text === "WAREHOUSE_TYPE_UNKNOWN") {
    return "";
  }
  if (/FULL[_-]?FILL?MENT|FULFILLMENT|РФЦ|RFC/.test(text)) return 1;
  if (/SORT|SORTING|СОРТ|СЦ|SC/.test(text)) return 2;
  if (/PICK|PVZ|ПВЗ|POINT/.test(text)) return 3;
  return /^\d+$/.test(text) ? Number(text) : text;
}

function buildSupplyTypeVariants(value) {
  const primary = toPositiveIntegerId(value) || 1;
  return uniqueStrings([primary, 1, 2, 3].map(String))
    .map((item) => Number(item))
    .filter((item) => Number.isSafeInteger(item) && item > 0);
}

function toOzonTimestampStartOfDay(date) {
  const cleanDate = cleanDateInput(date) || new Date().toISOString().slice(0, 10);
  return `${cleanDate}T00:00:00Z`;
}

function toOzonTimestampEndOfDay(date) {
  const cleanDate = cleanDateInput(date) || new Date().toISOString().slice(0, 10);
  return `${cleanDate}T23:59:59Z`;
}

function extractSelectedClusterWarehousesFromDraftInfo(data, fallbackClusterIds = []) {
  const clusters = data && Array.isArray(data.clusters)
    ? data.clusters
    : data && data.result && Array.isArray(data.result.clusters)
      ? data.result.clusters
      : [];
  const result = [];
  const normalizedFallback = preferMacrolocalClusterIds(fallbackClusterIds || []);
  for (const cluster of clusters) {
    // Берём ТОЛЬКО настоящий macrolocal_cluster_id (не cluster.id — это внутренний
    // идентификатор ответа, который Ozon не принимает как MacrolocalClusterId).
    const realClusterIds = preferMacrolocalClusterIds(extractClusterIds(cluster));
    // Приоритет: macrolocal из черновика → fallback из кандидата (cluster_ids)
    const clusterIds = realClusterIds.length ? realClusterIds : normalizedFallback;
    const warehouses = Array.isArray(cluster.warehouses) ? cluster.warehouses : [];
    for (const warehouse of warehouses) {
      if (!isDraftWarehouseAvailable(warehouse)) continue;
      const warehouseIds = extractWarehouseIds(warehouse);
      // Каждый склад привязываем к macrolocal_cluster_id кластера (обязательно > 0)
      result.push(...buildSelectedClusterWarehousesFromIds(clusterIds.slice(0, 1), warehouseIds));
      if (result.length >= 20) return normalizeSelectedClusterWarehouses(result);
    }
  }
  return normalizeSelectedClusterWarehouses(result);
}

function extractAvailableWarehouseIdsFromDraftInfo(data, fallbackWarehouseIds = []) {
  const result = [];
  const clusters = data && Array.isArray(data.clusters)
    ? data.clusters
    : data && data.result && Array.isArray(data.result.clusters)
      ? data.result.clusters
      : [];
  for (const cluster of clusters) {
    const warehouses = Array.isArray(cluster.warehouses) ? cluster.warehouses : [];
    for (const warehouse of warehouses) {
      if (!isDraftWarehouseAvailable(warehouse)) continue;
      result.push(...extractWarehouseIds(warehouse));
      if (result.length >= 20) return normalizePositiveOzonIds(result).map(String);
    }
  }
  return normalizePositiveOzonIds(result.length ? result : fallbackWarehouseIds).slice(0, 20).map(String);
}

function isDraftWarehouseAvailable(warehouse) {
  const status = warehouse && warehouse.status && typeof warehouse.status === "object"
    ? warehouse.status
    : {};
  if (status.is_available === false) return false;
  const state = String(status.state || warehouse.state || "").toUpperCase();
  if (state.includes("NOT_AVAILABLE")) return false;
  return true;
}

function parseProduct(item) {
  if (!item || !item.offer_id) return null;
  const skuList = extractProductSkus(item);
  const barcodeList = extractProductBarcodes(item);
  return {
    offer_id: String(item.offer_id),
    product_id: item.product_id !== undefined && item.product_id !== null ? String(item.product_id) : null,
    sku: skuList[0] || null,
    sku_list: skuList,
    barcode_list: barcodeList,
    name: item.name ? String(item.name) : null,
  };
}

function extractProductSkus(item) {
  const values = [];
  for (const key of ["sku", "fbo_sku", "fbs_sku"]) {
    if (item[key] !== undefined && item[key] !== null) values.push(item[key]);
  }
  if (Array.isArray(item.sources)) {
    for (const source of item.sources) {
      for (const key of ["sku", "fbo_sku", "fbs_sku"]) {
        if (source[key] !== undefined && source[key] !== null) values.push(source[key]);
      }
    }
  }
  return uniqueStrings(values.map(cleanIdentifier).filter(Boolean));
}

function extractProductBarcodes(item) {
  const values = [];
  for (const key of ["barcode", "barcodes", "barcode_list", "bar_code", "bar_codes"]) {
    appendIdentifierValues(values, item[key]);
  }
  if (Array.isArray(item.sources)) {
    for (const source of item.sources) {
      for (const key of ["barcode", "barcodes", "barcode_list", "bar_code", "bar_codes"]) {
        appendIdentifierValues(values, source[key]);
      }
    }
  }
  return uniqueStrings(values.map(cleanIdentifier).filter(Boolean));
}

function appendIdentifierValues(target, value) {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    for (const item of value) appendIdentifierValues(target, item);
    return;
  }
  if (typeof value === "object") {
    for (const key of ["value", "barcode", "sku", "id"]) {
      if (value[key] !== undefined && value[key] !== null) appendIdentifierValues(target, value[key]);
    }
    return;
  }
  target.push(value);
}

function extractWarehousesFromClusters(data) {
  const clusters = Array.isArray(data.clusters)
    ? data.clusters
    : data.result && Array.isArray(data.result.clusters)
      ? data.result.clusters
      : [];
  const warehouses = [];

  for (const cluster of clusters) {
    const clusterIds = extractTopLevelClusterIds(cluster);
    const classicClusterIds = extractClassicTopLevelClusterIds(cluster);
    const logisticClusters = Array.isArray(cluster.logistic_clusters)
      ? cluster.logistic_clusters
      : Array.isArray(cluster.logistics_clusters)
        ? cluster.logistics_clusters
        : [];

    for (const logisticCluster of logisticClusters) {
      const items = Array.isArray(logisticCluster.warehouses) ? logisticCluster.warehouses : [];
      for (const warehouse of items) {
        if (!warehouse || !warehouse.name) continue;
        warehouses.push({
          ...warehouse,
          cluster_ids: clusterIds,
          classic_cluster_ids: classicClusterIds,
          cluster_name: cluster.name || cluster.cluster_name || "",
          logistic_cluster_name: logisticCluster.name || logisticCluster.cluster_name || "",
        });
      }
    }

    const clusterWarehouses = Array.isArray(cluster.warehouses) ? cluster.warehouses : [];
    for (const warehouse of clusterWarehouses) {
      if (!warehouse || !warehouse.name) continue;
      warehouses.push({
        ...warehouse,
        cluster_ids: clusterIds,
        classic_cluster_ids: classicClusterIds,
        cluster_name: cluster.name || cluster.cluster_name || "",
      });
    }
  }

  return warehouses.filter((warehouse) => {
    const type = String(warehouse.type || "").toUpperCase();
    const name = String(warehouse.name || "");
    if (/возврат/i.test(name)) return false;
    return !type || type.includes("FULL") || type.includes("SORTING") || type.includes("FULFILL");
  });
}

function uniqueWarehouses(warehouses) {
  const seen = new Set();
  const result = [];
  for (const warehouse of warehouses) {
    const name = extractWarehouseName(warehouse);
    const key = normalizeText(name);
    if (!name) continue;
    if (seen.has(key)) {
      const existing = result.find((item) => normalizeText(item.name) === key);
      if (existing) {
        existing.classic_cluster_ids = uniqueStrings([...(existing.classic_cluster_ids || []), ...extractClassicClusterIds(warehouse)]);
        existing.cluster_ids = uniqueStrings([...(existing.cluster_ids || []), ...extractClusterIds(warehouse)]);
        existing.warehouse_ids = uniqueStrings([...(existing.warehouse_ids || []), ...extractWarehouseIds(warehouse)]);
      }
      continue;
    }
    seen.add(key);
    result.push({
      ...warehouse,
      name,
      classic_cluster_ids: extractClassicClusterIds(warehouse),
      cluster_ids: extractClusterIds(warehouse),
      warehouse_ids: extractWarehouseIds(warehouse),
    });
  }
  return result;
}

async function buildSmartDistributionPlan(client, items, manualWarehouses) {
  const skus = [...new Set(items.map((item) => item.sku).filter(Boolean).map(String))];
  if (!skus.length) {
    return createManualDistributionPlan(
      manualWarehouses,
      "Для товаров не найден SKU Ozon, используется ручное распределение",
    );
  }

  const [warehouseResult, turnoverResult, stocksResult, regionalSalesResult] = await Promise.allSettled([
    client.getFboWarehouses(),
    client.getTurnoverBySku(skus),
    client.getStocksOnWarehouses(),
    client.getRegionalSalesBySku(skus),
  ]);

  const diagnostics = [
    describeAnalyticsResult("список FBO складов /v1/cluster/list", warehouseResult),
    describeAnalyticsResult("оборачиваемость /v1/analytics/turnover/stocks", turnoverResult),
    describeAnalyticsResult("остатки по складам /v2/analytics/stock_on_warehouses", stocksResult),
    describeAnalyticsResult("продажи /v1/analytics/data", regionalSalesResult),
  ];
  const ozonWarehouses = warehouseResult.status === "fulfilled" ? warehouseResult.value : [];
  const turnoverBySku = turnoverResult.status === "fulfilled" ? turnoverResult.value : new Map();
  const stockRows = stocksResult.status === "fulfilled" ? stocksResult.value : [];
  const stocksBySkuWarehouse = stocksResult.status === "fulfilled"
    ? buildStockIndex(stocksResult.value)
    : new Map();
  const regionalSalesBySku = regionalSalesResult.status === "fulfilled"
    ? regionalSalesResult.value
    : new Map();
  const autoWarehouses = buildTargetWarehouses({
    ozonWarehouses,
    stockRows,
    regionalSalesBySku,
    manualWarehouses,
  });
  const targetWarehouses = applyManualWarehouseMetadata(autoWarehouses, manualWarehouses);
  const distributionIndexes = {
    turnoverBySku,
    stocksBySkuWarehouse,
    regionalSalesBySku,
  };
  const activeWarehouses = selectOutputClustersByMinimumQuantity(
    items,
    targetWarehouses,
    distributionIndexes,
    MIN_OUTPUT_CLUSTER_QUANTITY,
  );

  const hasOzonWarehouseSource = ozonWarehouses.length > 0 || stockRows.length > 0 || regionalSalesBySku.size > 0;
  if (!hasOzonWarehouseSource) {
    return createManualDistributionPlan(
      manualWarehouses,
      "Ozon не вернул аналитику по продажам/остаткам, используется ручное распределение. " + diagnostics.join("; "),
    );
  }

  return {
    mode: "smart",
    warehouses: activeWarehouses,
    note: `Распределение рассчитано по ${targetWarehouses.length} складам/регионам Ozon. Новые товары без продаж идут на крупные склады, склады без потребности пропущены. ` + diagnostics.join("; "),
    note: `Smart distribution: ${activeWarehouses.length} Ozon clusters, minimum ${MIN_OUTPUT_CLUSTER_QUANTITY} pcs per output cluster. Small directions are redistributed. ` + diagnostics.join("; "),
    distributeItem(item) {
      return distributeByWeights(
        item.quantity,
        activeWarehouses,
        buildSmartWeights(item, activeWarehouses, distributionIndexes),
        { allowEmpty: true },
      );
    },
  };
}

function describeAnalyticsResult(label, result) {
  if (result.status === "rejected") {
    const message = String(result.reason && result.reason.message ? result.reason.message : result.reason);
    if (/403|forbidden|доступ|access/i.test(message)) return `${label}: нет прав роли`;
    if (/429|rate limit|частоту/i.test(message)) return `${label}: лимит Ozon, повторите позже`;
    return `${label}: ошибка ${message.slice(0, 160)}`;
  }
  const value = result.value;
  const count = value instanceof Map ? value.size : Array.isArray(value) ? value.length : 0;
  return count > 0 ? `${label}: получено записей ${count}` : `${label}: данных нет`;
}

function createManualDistributionPlan(warehouses, note) {
  const fallbackWarehouses = assignFallbackPercentages(warehouses);
  return {
    mode: "manual",
    warehouses: fallbackWarehouses,
    note,
    distributeItem(item) {
      return distributeByWeights(
        item.quantity,
        fallbackWarehouses,
        Object.fromEntries(fallbackWarehouses.map((warehouse) => [warehouse.name, Number(warehouse.percentage) || 0])),
      );
    },
  };
}

function selectOutputClustersByMinimumQuantity(items, warehouses, indexes, minQuantity) {
  if (!warehouses.length) return warehouses;
  if (warehouses.length === 1) return warehouses;
  let active = warehouses;
  for (let iteration = 0; iteration < warehouses.length; iteration += 1) {
    const totals = new Map(active.map((warehouse) => [warehouse.name, 0]));
    for (const item of items) {
      const weights = buildSmartWeights(item, active, indexes);
      const distribution = distributeByWeights(item.quantity, active, weights, { allowEmpty: true });
      for (const [warehouseName, quantity] of Object.entries(distribution)) {
        totals.set(warehouseName, (totals.get(warehouseName) || 0) + Number(quantity || 0));
      }
    }
    const keepNames = new Set(
      [...totals.entries()]
        .filter(([, quantity]) => quantity >= minQuantity)
        .map(([name]) => name),
    );
    if (!keepNames.size) {
      const topWarehouse = [...active]
        .sort((a, b) => (totals.get(b.name) || 0) - (totals.get(a.name) || 0))[0];
      return topWarehouse ? [topWarehouse] : active;
    }
    if (keepNames.size === active.length) return active;
    active = active.filter((warehouse) => keepNames.has(warehouse.name));
  }
  return active;
}

function buildSmartWeights(item, warehouses, indexes) {
  const sku = String(item.sku || "");
  const turnover = indexes.turnoverBySku.get(sku) || {};
  const stocks = indexes.stocksBySkuWarehouse.get(sku) || new Map();
  const regionalSales = indexes.regionalSalesBySku.get(sku) || new Map();
  const salesByWarehouse = matchMetricsToWarehouses(regionalSales, warehouses);
  const regionalTotal = sumValues(salesByWarehouse);
  const stocksByWarehouse = matchMetricsToWarehouses(stocks, warehouses);
  const stockTotal = sumValues(stocksByWarehouse);

  const baseSalesShares = {};
  for (const warehouse of warehouses) {
    if (regionalTotal > 0) {
      baseSalesShares[warehouse.name] = (salesByWarehouse.get(warehouse.name) || 0) / regionalTotal;
    } else if (stockTotal > 0) {
      baseSalesShares[warehouse.name] = (stocksByWarehouse.get(warehouse.name) || 0) / stockTotal;
    } else {
      baseSalesShares[warehouse.name] = 0;
    }
  }

  if (regionalTotal <= 0 && stockTotal <= 0) {
    return getNewProductFallbackWeights(warehouses);
  }

  const totalDailySales = Number(turnover.dailySales || 0) || Math.max(regionalTotal / ANALYTICS_PERIOD_DAYS, 0);
  const weights = {};
  for (const warehouse of warehouses) {
    const share = baseSalesShares[warehouse.name] || 0;
    if (share <= 0) {
      weights[warehouse.name] = 0;
      continue;
    }
    const currentStock = Number(getMatchedMetric(stocks, warehouse.name) || 0);
    const targetStock = totalDailySales > 0
      ? totalDailySales * TARGET_STOCK_DAYS * share
      : item.quantity * share;
    const deficit = Math.max(0, targetStock - currentStock);
    if (regionalTotal > 0) {
      weights[warehouse.name] = deficit * 3 + share * Math.max(totalDailySales, 1);
    } else {
      weights[warehouse.name] = share * Math.max(item.quantity, 1);
    }
  }

  return weights;
}

function getNewProductFallbackWeights(warehouses) {
  const weights = Object.fromEntries(warehouses.map((warehouse) => [warehouse.name, 0]));
  let matchedGroups = 0;

  for (const major of NEW_PRODUCT_MAJOR_WAREHOUSES) {
    const matches = warehouses.filter((warehouse) => normalizeText(warehouse.name) === normalizeText(major.name) || major.pattern.test(normalizeText(warehouse.name)));
    if (!matches.length) continue;
    matchedGroups += 1;
    for (const warehouse of matches) {
      weights[warehouse.name] += major.weight / matches.length;
    }
  }

  if (matchedGroups > 0) return weights;

  const fallbackWeights = NEW_PRODUCT_MAJOR_WAREHOUSES.map((item) => item.weight);
  warehouses.slice(0, fallbackWeights.length).forEach((warehouse, index) => {
    weights[warehouse.name] = fallbackWeights[index];
  });
  return weights;
}

function assignFallbackPercentages(warehouses) {
  const cleanWarehouses = warehouses.map((warehouse) => ({ ...warehouse }));
  const weights = getNewProductFallbackWeights(cleanWarehouses);
  const totalWeight = sumObjectValues(weights);
  if (totalWeight <= 0) {
    const percent = cleanWarehouses.length ? 100 / cleanWarehouses.length : 0;
    return cleanWarehouses.map((warehouse) => ({ ...warehouse, percentage: percent }));
  }
  return cleanWarehouses.map((warehouse) => ({
    ...warehouse,
    percentage: Number(((Number(weights[warehouse.name]) || 0) / totalWeight * 100).toFixed(4)),
  }));
}

function buildStockIndex(rows) {
  const index = new Map();
  for (const row of rows) {
    const sku = String(row.sku || row.fbo_sku || "");
    const warehouseName = toSupplyClusterName(String(row.warehouse_name || "").trim());
    if (!sku || !warehouseName) continue;
    const amount = Number(row.free_to_sell_amount ?? row.present ?? row.current_stock ?? 0) || 0;
    if (!index.has(sku)) index.set(sku, new Map());
    index.get(sku).set(warehouseName, (index.get(sku).get(warehouseName) || 0) + amount);
  }
  return index;
}

function buildTargetWarehouses({ ozonWarehouses, stockRows, regionalSalesBySku, manualWarehouses }) {
  const byCity = new Map();
  for (const warehouse of ozonWarehouses) {
    const name = extractClusterDisplayName(warehouse) || extractWarehouseName(warehouse);
    const cityName = toSupplyClusterName(name);
    if (cityName) mergeCityWarehouse(byCity, cityName, warehouse);
  }
  for (const row of stockRows) {
    const cityName = toSupplyClusterName(String(row.warehouse_name || "").trim());
    if (cityName) mergeCityWarehouse(byCity, cityName, row);
  }
  for (const salesMap of regionalSalesBySku.values()) {
    for (const name of salesMap.keys()) {
      const cityName = toSupplyClusterName(String(name || "").trim());
      if (cityName) mergeCityWarehouse(byCity, cityName, {});
    }
  }
  const result = sortCityClusters([...byCity.values()]);
  return result.length > 0 ? assignFallbackPercentages(result) : assignFallbackPercentages(manualWarehouses);
}

function applyManualWarehouseMetadata(targetWarehouses, manualWarehouses) {
  if (!targetWarehouses.length) return assignFallbackPercentages(manualWarehouses);
  const manualSelection = normalizeWarehousePercentages(manualWarehouses);
  if (!manualSelection.length) return targetWarehouses;
  const manualByKey = new Map();
  for (const manualWarehouse of manualSelection) {
    const cityName = toSupplyClusterName(manualWarehouse.name) || manualWarehouse.name;
    manualByKey.set(normalizeText(manualWarehouse.name), manualWarehouse);
    manualByKey.set(normalizeText(cityName), manualWarehouse);
  }
  return sortCityClusters(targetWarehouses.map((warehouse) => {
    const cityName = toSupplyClusterName(warehouse.name) || warehouse.name;
    const manualWarehouse = manualByKey.get(normalizeText(warehouse.name))
      || manualByKey.get(normalizeText(cityName));
    if (!manualWarehouse) return warehouse;
    return {
      ...warehouse,
      classic_cluster_ids: uniqueStrings([
        ...((warehouse && warehouse.classic_cluster_ids) || []),
        ...((manualWarehouse && manualWarehouse.classic_cluster_ids) || []),
      ].map(cleanIdentifier).filter(Boolean)),
      cluster_ids: uniqueStrings([
        ...((warehouse && warehouse.cluster_ids) || []),
        ...((manualWarehouse && manualWarehouse.cluster_ids) || []),
      ].map(cleanIdentifier).filter(Boolean)),
      warehouse_ids: uniqueStrings([
        ...((warehouse && warehouse.warehouse_ids) || []),
        ...((manualWarehouse && manualWarehouse.warehouse_ids) || []),
      ].map(cleanIdentifier).filter(Boolean)),
      selected_cluster_warehouses: normalizeSelectedClusterWarehouses([
        ...((warehouse && warehouse.selected_cluster_warehouses) || []),
        ...((manualWarehouse && manualWarehouse.selected_cluster_warehouses) || []),
      ]),
    };
  }));
}

function mergeCityWarehouse(map, cityName, source) {
  const key = normalizeText(cityName);
  if (!map.has(key)) {
    map.set(key, { name: cityName, classic_cluster_ids: [], cluster_ids: [], warehouse_ids: [], selected_cluster_warehouses: [] });
  }
  const item = map.get(key);
  item.classic_cluster_ids = uniqueStrings([...(item.classic_cluster_ids || []), ...extractClassicClusterIds(source)]);
  item.cluster_ids = uniqueStrings([...(item.cluster_ids || []), ...extractClusterIds(source)]);
  item.warehouse_ids = uniqueStrings([...(item.warehouse_ids || []), ...extractWarehouseIds(source)]);
  item.selected_cluster_warehouses = normalizeSelectedClusterWarehouses([
    ...(item.selected_cluster_warehouses || []),
    ...buildSelectedClusterWarehousesFromIds(extractClusterIds(source), extractWarehouseIds(source)),
  ]);
}

function extractWarehouseName(warehouse) {
  return String(
    warehouse.name
    || warehouse.warehouse_name
    || warehouse.delivery_method_name
    || warehouse.first_mile_type
    || warehouse.warehouse_id
    || "",
  ).trim();
}

function extractClusterDisplayName(source) {
  return String(
    (source && (
      source.cluster_name
      || source.clusterName
      || source.macrolocal_cluster_name
      || source.macrolocalClusterName
      || source.macrocluster_name
      || source.macroclusterName
    ))
    || "",
  ).trim();
}

function extractClusterIds(value) {
  const ids = [];
  if (!value || typeof value !== "object") return ids;
  appendIdentifierValues(ids, value.cluster_ids);
  for (const key of [
    "macrolocal_cluster_id",
    "macrolocalClusterId",
    "macrocluster_id",
    "macroclusterId",
    "ozon_cluster_id",
    "cluster_id",
    "clusterId",
  ]) {
    appendIdentifierValues(ids, value[key]);
  }
  return uniqueStrings(ids.map(cleanIdentifier).filter(Boolean));
}

function extractClassicClusterIds(value) {
  const ids = [];
  if (!value || typeof value !== "object") return ids;
  appendIdentifierValues(ids, value.classic_cluster_ids);
  appendIdentifierValues(ids, value.classicClusterIds);
  appendIdentifierValues(ids, value.cluster_ids);
  appendIdentifierValues(ids, value.clusterIds);
  return normalizeClassicDraftClusterIds(ids).map(String);
}

function extractTopLevelClusterIds(value) {
  const ids = extractClusterIds(value);
  if (value && typeof value === "object") appendIdentifierValues(ids, value.id);
  return uniqueStrings(ids.map(cleanIdentifier).filter(Boolean));
}

function extractClassicTopLevelClusterIds(value) {
  const ids = [];
  if (!value || typeof value !== "object") return ids;
  appendIdentifierValues(ids, value.classic_cluster_ids);
  appendIdentifierValues(ids, value.classicClusterIds);
  appendIdentifierValues(ids, value.id);
  appendIdentifierValues(ids, value.clusterId);
  appendIdentifierValues(ids, value.cluster_id);
  return normalizeClassicDraftClusterIds(ids).map(String);
}

function extractWarehouseIds(value) {
  const ids = [];
  if (!value || typeof value !== "object") return ids;
  appendIdentifierValues(ids, value.warehouse_ids);
  for (const key of [
    "warehouse_id",
    "warehouseId",
    "storage_warehouse_id",
    "storageWarehouseId",
    "supply_warehouse_id",
    "drop_off_point_warehouse_id",
  ]) {
    appendIdentifierValues(ids, value[key]);
  }
  if (value.storage_warehouse && typeof value.storage_warehouse === "object") {
    appendIdentifierValues(ids, value.storage_warehouse.warehouse_id);
    appendIdentifierValues(ids, value.storage_warehouse.id);
  }
  if (value.supply_warehouse && typeof value.supply_warehouse === "object") {
    appendIdentifierValues(ids, value.supply_warehouse.warehouse_id);
    appendIdentifierValues(ids, value.supply_warehouse.id);
  }
  return uniqueStrings(ids.map(cleanIdentifier).filter(Boolean));
}

function toCityClusterName(value) {
  const text = normalizeText(value);
  if (!text) return null;
  const alias = getKnownClusterAlias(text);
  if (alias) return alias;
  for (const rule of CITY_CLUSTER_RULES) {
    if (rule.pattern.test(text)) return rule.name;
  }
  return titleCaseCluster(value);
}

function toSupplyClusterName(value) {
  const cityName = toCityClusterName(value);
  if (!cityName) return null;
  const key = normalizeText(cityName);
  if (key === normalizeText("Нижний Новгород") || /нижн|нижегород|дзержинск/.test(normalizeText(value))) {
    return "Казань";
  }
  return cityName;
}

function getKnownClusterAlias(text) {
  const compact = String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .replace(/o/g, "о")
    .replace(/m/g, "м");
  if (
    text === "мо"
    || text === "м.о."
    || compact === "мо"
    || text === "московская область"
    || /московск.*област/i.test(text)
    || /(^|[\s_-])(гривно|хоругвино|пушкино|домодедово|жуковск|давыдов|петровск|томилино|софьино|ногинск|электросталь|чехов|подольск|раменское|коледино)([\s_-]|$)/i.test(text)
  ) {
    return NEW_PRODUCT_MAJOR_WAREHOUSES[0].name;
  }
  return null;
}

function buildCityClustersFromNames(names) {
  const seen = new Set();
  const result = [];
  for (const name of names) {
    const clusterName = toSupplyClusterName(name);
    if (!clusterName) continue;
    const key = normalizeText(clusterName);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ name: clusterName });
  }
  return sortCityClusters(result);
}

function buildCityClustersFromWarehouses(warehouses, options = {}) {
  const byCity = new Map();
  for (const warehouse of warehouses) {
    const cityName = toSupplyClusterName(extractClusterDisplayName(warehouse) || extractWarehouseName(warehouse));
    if (cityName) mergeCityWarehouse(byCity, cityName, warehouse);
  }
  const result = sortCityClusters([...byCity.values()]);
  if (!options.knownSupplyCitiesOnly) return result;
  const known = result.filter((warehouse) => isKnownSupplyCityCluster(warehouse.name));
  return known.length ? known : result;
}

function sortCityClusters(warehouses) {
  const priority = new Map(NEW_PRODUCT_MAJOR_WAREHOUSES.map((item, index) => [item.name, index]));
  return [...warehouses].sort((a, b) => {
    const aPriority = priority.has(a.name) ? priority.get(a.name) : 1000;
    const bPriority = priority.has(b.name) ? priority.get(b.name) : 1000;
    return aPriority - bPriority || a.name.localeCompare(b.name);
  });
}

function isKnownSupplyCityCluster(name) {
  const key = normalizeText(toSupplyClusterName(name) || name);
  if (!key) return false;
  return CITY_CLUSTER_RULES.some((rule) => normalizeText(rule.name) === key)
    || NEW_PRODUCT_MAJOR_WAREHOUSES.some((warehouse) => normalizeText(warehouse.name) === key);
}

function titleCaseCluster(value) {
  const cleaned = String(value || "")
    .replace(/^СЦ[_\s-]*/i, "")
    .replace(/^ТСЦ[_\s-]*/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  const firstWord = cleaned.split(" ")[0];
  return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
}

function matchMetricsToWarehouses(metrics, warehouses) {
  const result = new Map();
  for (const warehouse of warehouses) {
    result.set(warehouse.name, getMatchedMetric(metrics, warehouse.name));
  }
  return result;
}

function getMatchedMetric(metrics, warehouseName) {
  if (!metrics || !metrics.size) return 0;
  if (metrics.has(warehouseName)) return Number(metrics.get(warehouseName)) || 0;
  const warehouseKey = normalizeText(warehouseName);
  let total = 0;
  for (const [name, value] of metrics.entries()) {
    const key = normalizeText(name);
    if (!key) continue;
    if (key === warehouseKey || key.includes(warehouseKey) || warehouseKey.includes(key)) {
      total += Number(value) || 0;
    }
  }
  return total;
}

function matchTargetWarehouse(value) {
  const text = normalizeText(value);
  if (!text) return null;
  return toSupplyClusterName(text);
}

function createWarehouseFiles(items, warehouses, distributionPlan) {
  const rowsByWarehouse = new Map();
  for (const warehouse of warehouses) rowsByWarehouse.set(warehouse.name, []);
  for (const item of items) {
    const distribution = distributionPlan.distributeItem(item);
    for (const [warehouseName, quantity] of Object.entries(distribution)) {
      if (quantity > 0) rowsByWarehouse.get(warehouseName).push({ offer_id: item.offer_id, name: item.name || "", quantity });
    }
  }
  return warehouses
    .map((warehouse) => {
    const rows = rowsByWarehouse.get(warehouse.name);
    return {
      warehouse: warehouse.name,
      filename: `Ozon_FBO_${safeFilenamePart(warehouse.name)}.xlsx`,
      rowsCount: rows.length,
      totalQuantity: rows.reduce((sum, row) => sum + row.quantity, 0),
      buffer: createXlsx(rows),
    };
    })
    .filter((file) => file.rowsCount > 0);
}

function createDraftCandidates(items, warehouses, distributionPlan) {
  const rowsByWarehouse = new Map();
  for (const warehouse of warehouses) rowsByWarehouse.set(warehouse.name, []);
  for (const item of items) {
    const distribution = distributionPlan.distributeItem(item);
    for (const [warehouseName, quantity] of Object.entries(distribution)) {
      if (quantity <= 0 || !rowsByWarehouse.has(warehouseName)) continue;
      rowsByWarehouse.get(warehouseName).push({
        sku: cleanIdentifier(item.sku),
        offer_id: item.offer_id,
        name: item.name || "",
        quantity,
      });
    }
  }

  return warehouses
    .map((warehouse) => {
      const rows = rowsByWarehouse.get(warehouse.name) || [];
      const itemMap = new Map();
      for (const row of rows) {
        if (!row.sku || !/^\d+$/.test(row.sku)) continue;
        if (!itemMap.has(row.sku)) {
          itemMap.set(row.sku, {
            sku: row.sku,
            offer_id: row.offer_id,
            name: row.name,
            quantity: 0,
          });
        }
        itemMap.get(row.sku).quantity += row.quantity;
      }
      const draftItems = [...itemMap.values()].filter((item) => item.quantity > 0);
      const classicClusterIds = normalizeClassicDraftClusterIds(warehouse.classic_cluster_ids || []).map(String);
      const clusterIds = uniqueStrings((warehouse.cluster_ids || []).map(cleanIdentifier).filter(Boolean));
      const warehouseIds = uniqueStrings((warehouse.warehouse_ids || []).map(cleanIdentifier).filter(Boolean));
      const selectedClusterWarehouses = normalizeSelectedClusterWarehouses(
        warehouse.selected_cluster_warehouses,
      );
      const createClusterIds = OZON_FBO_DRAFT_FLOW === "classic"
        ? classicClusterIds
        : (classicClusterIds.length ? classicClusterIds : clusterIds);
      const reason = !createClusterIds.length
        ? "не найден cluster_id Ozon для города"
        : !draftItems.length
          ? "нет SKU Ozon для позиций"
          : "";
      return {
        warehouse: warehouse.name,
        classic_cluster_ids: classicClusterIds,
        cluster_ids: clusterIds,
        warehouse_ids: warehouseIds,
        selected_cluster_warehouses: selectedClusterWarehouses.length
          ? selectedClusterWarehouses
          : buildSelectedClusterWarehousesFromIds(clusterIds, warehouseIds),
        selected_cluster_warehouses_source: selectedClusterWarehouses.length ? "cluster_list" : "warehouse_ids",
        supply_type: 1,
        supply_mode: "direct",
        rows_count: draftItems.length,
        total_quantity: draftItems.reduce((sum, item) => sum + item.quantity, 0),
        items: draftItems,
        can_create: Boolean(createClusterIds.length && draftItems.length),
        reason,
      };
    })
    .filter((candidate) => candidate.total_quantity > 0);
}

function stopOzonBackgroundJobsForClient(clientId, message) {
  const cleanClientId = cleanIdentifier(clientId);
  if (!cleanClientId) return 0;
  let stopped = 0;
  for (const job of draftCreationJobs.values()) {
    if (job && job.client_id === cleanClientId && job.status === "running") {
      stopDraftCreationJob(job, message || "Stopped before a new Ozon run");
      stopped += 1;
    }
  }
  for (const job of slotHunterJobs.values()) {
    if (job && job.clientId === cleanClientId && job.status === "running") {
      stopSlotHunterJob(job, message || "Stopped before a new Ozon run");
      stopped += 1;
    }
  }
  return stopped;
}

function createDraftCreationJob({ clientId, apiKey, candidates }) {
  const cleanClientId = cleanIdentifier(clientId);
  const cleanApiKey = String(apiKey || "").trim();
  if (!cleanClientId || !cleanApiKey) throw new Error("Введите Client-Id и Api-Key Ozon");

  const now = new Date();
  const targets = candidates.map((candidate, index) => ({
    id: createLocalId("draft_target"),
    warehouse: candidate.warehouse || `Город ${index + 1}`,
    status: "waiting",
    attempts_count: 0,
    next_attempt_at: now.toISOString(),
    last_attempt_at: null,
    last_message: "Ждёт очереди",
    error_message: null,
    candidate,
    result: null,
  }));
  const job = {
    id: createLocalId("draft_job"),
    status: "running",
    client_id: cleanClientId,
    client: new OzonClient(cleanClientId, cleanApiKey),
    targets,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    next_attempt_at: now.toISOString(),
    last_message: `В очереди ${targets.length} город(а). Делаем по одному запросу, при лимите ждём автоматически.`,
    timer: null,
    is_processing: false,
  };
  draftCreationJobs.set(job.id, job);
  return job;
}

function sanitizeDraftCreationJob(job) {
  const targets = (job.targets || []).map((target) => ({
    id: target.id,
    warehouse: target.warehouse,
    status: target.status,
    attempts_count: target.attempts_count,
    next_attempt_at: target.next_attempt_at,
    last_attempt_at: target.last_attempt_at,
    last_message: target.last_message,
    error_message: target.error_message,
    result: target.result,
  }));
  return {
    id: job.id,
    status: job.status,
    created_at: job.created_at,
    updated_at: job.updated_at,
    next_attempt_at: job.next_attempt_at,
    last_message: job.last_message,
    targets,
    results: targets
      .map((target) => target.result)
      .filter(Boolean),
    summary: summarizeDraftCreationJob(job),
  };
}

function summarizeDraftCreationJob(job) {
  const targets = job.targets || [];
  return {
    total: targets.length,
    created: targets.filter((target) => target.status === "created").length,
    waiting: targets.filter((target) => ["waiting", "cooldown", "creating"].includes(target.status)).length,
    failed: targets.filter((target) => target.status === "failed").length,
  };
}

function runDraftCreationJob(jobId) {
  const job = draftCreationJobs.get(jobId);
  if (!job || job.status !== "running" || job.is_processing) return;
  job.is_processing = true;
  processDraftCreationJob(job)
    .catch((error) => {
      job.status = "failed";
      job.last_message = error.message || "Ошибка очереди создания черновиков";
      job.updated_at = new Date().toISOString();
    })
    .finally(() => {
      job.is_processing = false;
      if (job.status === "running") scheduleDraftCreationJob(job);
    });
}

async function processDraftCreationJob(job) {
  const now = Date.now();
  const activeTargets = job.targets.filter((target) => !["created", "failed"].includes(target.status));
  if (!activeTargets.length) {
    job.status = job.targets.some((target) => target.status === "failed") ? "failed" : "completed";
    job.last_message = job.status === "completed"
      ? "Все API-черновики созданы"
      : "Часть API-черновиков не создалась";
    job.next_attempt_at = null;
    job.updated_at = new Date().toISOString();
    return;
  }

  // Уважаем общую паузу между созданиями (спейсинг против 429)
  if (job.next_attempt_at && new Date(job.next_attempt_at).getTime() > now) {
    job.updated_at = new Date().toISOString();
    return;
  }

  const readyTarget = activeTargets
    .filter((target) => !target.next_attempt_at || new Date(target.next_attempt_at).getTime() <= now)
    .sort((a, b) => a.warehouse.localeCompare(b.warehouse))[0];

  if (!readyTarget) {
    const nextAt = activeTargets
      .map((target) => new Date(target.next_attempt_at || job.next_attempt_at).getTime())
      .filter(Number.isFinite)
      .sort((a, b) => a - b)[0];
    job.next_attempt_at = new Date(nextAt || now + DRAFT_CREATION_JOB_RATE_LIMIT_COOLDOWN_MS).toISOString();
    job.last_message = `Ждём паузу Ozon до ${new Date(job.next_attempt_at).toLocaleTimeString("ru-RU")}`;
    job.updated_at = new Date().toISOString();
    return;
  }

  await attemptDraftCreationTarget(job, readyTarget);
}

async function attemptDraftCreationTarget(job, target) {
  target.status = "creating";
  target.attempts_count += 1;
  target.last_attempt_at = new Date().toISOString();
  target.error_message = null;
  target.last_message = "Отправляем один запрос в Ozon";
  job.last_message = `Создаём API-черновик: ${target.warehouse}`;
  job.updated_at = new Date().toISOString();

  try {
    const result = await job.client.createSupplyDraftFromCandidate(target.candidate);
    target.status = "created";
    target.next_attempt_at = null;
    target.last_message = result.draft_id
      ? `API-черновик создан: ${result.draft_id}`
      : "Ozon принял создание черновика";
    target.result = {
      ok: true,
      warehouse: target.warehouse,
      ...result,
      ozon_response: safeJsonSnippet(result.raw_response, 1200),
      attempts_count: target.attempts_count,
    };
    job.last_message = target.last_message;
    // Пауза перед созданием следующего черновика, чтобы не ловить 429 Ozon.
    // Лимит создания черновиков жёсткий — успешные запросы тоже нужно разносить.
    const remainingTargets = job.targets.filter(
      (item) => !["created", "failed"].includes(item.status),
    );
    if (remainingTargets.length) {
      job.next_attempt_at = new Date(Date.now() + DRAFT_CREATION_SPACING_MS).toISOString();
      job.last_message = `Черновик создан. Пауза перед следующим, чтобы не превысить лимит Ozon`;
    }
  } catch (error) {
    const status = Number(error && error.status);
    const isRateLimited = isOzonRateLimitError(error);
    const retryMs = isRateLimited
      ? Math.max(DRAFT_CREATION_JOB_RATE_LIMIT_COOLDOWN_MS, Number(error.retryAfterMs) || 0)
      : 0;
    target.result = {
      ok: false,
      warehouse: target.warehouse,
      operation_id: error.operationId || null,
      error: error.message || "Ошибка Ozon API",
      http_status: error.status || null,
      endpoint: error.path || null,
      ozon_response: error.responseText || null,
      recent_ozon_requests: Array.isArray(error.recentRequests) ? error.recentRequests : [],
      retry_after_ms: retryMs || error.retryAfterMs || null,
      is_rate_limited: isRateLimited,
      attempts_count: target.attempts_count,
      supply_mode: target.candidate.supply_mode || target.candidate.supplyMode || null,
      drop_off_point_warehouse_id: getDropOffPointWarehouseId(target.candidate) || null,
      drop_off_point_warehouse_type: getDropOffPointWarehouseType(target.candidate) || null,
      classic_cluster_ids: Array.isArray(target.candidate.classic_cluster_ids) ? target.candidate.classic_cluster_ids : [],
      cluster_ids: Array.isArray(target.candidate.cluster_ids) ? target.candidate.cluster_ids : [],
    };
    if (isRateLimited && target.attempts_count < DRAFT_CREATION_JOB_MAX_ATTEMPTS_PER_TARGET) {
      target.status = "cooldown";
      target.next_attempt_at = new Date(Date.now() + retryMs).toISOString();
      target.last_message = `Ozon ограничил создание черновика. Повторим автоматически в ${new Date(target.next_attempt_at).toLocaleTimeString("ru-RU")}`;
      target.error_message = null;
      job.next_attempt_at = target.next_attempt_at;
      job.last_message = target.last_message;
    } else {
      target.status = "failed";
      target.next_attempt_at = null;
      target.error_message = target.result.error;
      target.last_message = isRateLimited
        ? "Достигнут лимит попыток по этому городу"
        : "Ozon отклонил запрос, повторы остановлены";
      job.last_message = target.last_message;
    }
  }
  job.updated_at = new Date().toISOString();
}

function scheduleDraftCreationJob(job) {
  if (job.timer) clearTimeout(job.timer);
  const nextAt = job.next_attempt_at
    ? new Date(job.next_attempt_at).getTime()
    : Date.now() + 5000;
  const delayMs = Math.max(3000, Math.min(Math.max(0, nextAt - Date.now()), 2147483647));
  job.timer = setTimeout(() => runDraftCreationJob(job.id), delayMs);
}

function stopDraftCreationJob(job, message) {
  if (job.timer) clearTimeout(job.timer);
  job.status = "stopped";
  job.last_message = message || "Остановлено";
  job.next_attempt_at = null;
  job.updated_at = new Date().toISOString();
}

function createSlotHunterJob({ clientId, apiKey, candidates, settings }) {
  const cleanClientId = cleanIdentifier(clientId);
  const cleanApiKey = String(apiKey || "").trim();
  if (!cleanClientId || !cleanApiKey) throw new Error("Введите Client-Id и Api-Key Ozon");

  const intervalSeconds = Math.max(
    SLOT_HUNTER_MIN_INTERVAL_SECONDS,
    Math.floor(Number(settings.interval_seconds) || SLOT_HUNTER_DEFAULT_INTERVAL_SECONDS),
  );
  const maxMinutes = Math.max(5, Math.floor(Number(settings.max_minutes) || SLOT_HUNTER_DEFAULT_MAX_MINUTES));
  const concurrencyLimit = Math.min(
    10,
    Math.max(1, Math.floor(Number(settings.concurrency_limit) || 1)),
  );
  const now = new Date();
  const autoBook = settings.auto_book === true;
  const slotSettings = normalizeSlotHunterSettings(settings, now);
  const selectedWarehouses = new Set(
    (Array.isArray(settings.selected_warehouses) ? settings.selected_warehouses : [])
      .map(normalizeText)
      .filter(Boolean),
  );
  const priorityWarehouses = new Set(
    (Array.isArray(settings.priority_warehouses) ? settings.priority_warehouses : [])
      .map(normalizeText)
      .filter(Boolean),
  );
  const selectedCandidates = candidates.filter((candidate) => {
    if (!selectedWarehouses.size) return true;
    return selectedWarehouses.has(normalizeText(candidate.warehouse || ""));
  });
  const targets = selectedCandidates.map((candidate, index) => {
    const warehouseName = candidate.warehouse || `Склад ${index + 1}`;
    const draftId = cleanIdentifier(candidate.draft_id);
    const operationId = cleanIdentifier(candidate.operation_id);
    const isPriority = priorityWarehouses.has(normalizeText(warehouseName));
    return {
      id: createLocalId("target"),
      warehouse: warehouseName,
      status: candidate.can_create === false ? "skipped" : "waiting",
      priority: isPriority ? index + 1 : 1000 + index,
      is_priority: isPriority,
      rows_count: Number(candidate.rows_count || 0),
      total_quantity: Number(candidate.total_quantity || 0),
      attempts_count: 0,
      last_attempt_at: null,
      next_attempt_at: now.toISOString(),
      operation_id: operationId,
      draft_id: draftId,
      draft_reused_logged: false,
      supply_operation_id: null,
      supply_order_id: null,
      selected_slot: null,
      last_message: candidate.can_create === false
        ? (candidate.reason || "нет данных для создания черновика")
        : draftId
          ? `Готовый API-черновик ${draftId}; ищем слот`
          : "Ожидает первой попытки",
      error_message: null,
      candidate,
    };
  });
  if (!targets.length) throw new Error("Выберите хотя бы один город для охотника на слоты");
  const job = {
    id: createLocalId("slot"),
    clientId: cleanClientId,
    apiKey: cleanApiKey,
    client: new OzonClient(cleanClientId, cleanApiKey),
    status: "running",
    mode: autoBook ? "auto_book" : "notify_only",
    auto_book: autoBook,
    interval_seconds: intervalSeconds,
    max_wait_until: new Date(now.getTime() + maxMinutes * 60 * 1000).toISOString(),
    concurrency_limit: concurrencyLimit,
    created_at: now.toISOString(),
    started_at: now.toISOString(),
    finished_at: null,
    next_attempt_at: now.toISOString(),
    last_message: "Охотник запущен",
    targets,
    attempts: [],
    timer: null,
    processing: false,
    rateLimitedUntil: null,
    nextDraftAttemptAt: now.toISOString(),
    draft_phase_until: null,
    slotSettings,
  };
  slotHunterJobs.set(job.id, job);
  return job;
}

function runSlotHunterJob(jobId) {
  const job = slotHunterJobs.get(jobId);
  if (!job || job.status !== "running") return;
  if (job.processing) return;
  job.processing = true;
  processSlotHunterCycle(job)
    .catch((error) => {
      job.last_message = error.message || "Ошибка охотника на слоты";
      addSlotHunterAttempt(job, null, "cycle", "failed", error.message || "Ошибка охотника на слоты");
    })
    .finally(() => {
      job.processing = false;
      scheduleSlotHunterJob(job);
    });
}

async function processSlotHunterCycle(job) {
  if (job.status !== "running") return;
  if (Date.now() > new Date(job.max_wait_until).getTime()) {
    finishSlotHunterJob(job, hasBookedSlot(job) ? "partial" : "expired", "Время поиска слотов истекло");
    return;
  }
  if (job.rateLimitedUntil && Date.now() < new Date(job.rateLimitedUntil).getTime()) {
    job.next_attempt_at = job.rateLimitedUntil;
    job.last_message = `Ozon ограничил запросы. Пауза до ${new Date(job.rateLimitedUntil).toLocaleTimeString("ru-RU")}`;
    return;
  }
  if (job.rateLimitedUntil && Date.now() >= new Date(job.rateLimitedUntil).getTime()) {
    job.rateLimitedUntil = null;
  }

  const activeTargets = getActiveSlotTargets(job);
  if (!activeTargets.length) {
    finishSlotHunterJob(
      job,
      job.targets.every((target) => target.status === "booked") ? "booked" : "partial",
      "Поиск завершён по всем городам",
    );
    return;
  }

  const now = Date.now();
  const readyTargets = activeTargets
    .filter((target) => !target.next_attempt_at || new Date(target.next_attempt_at).getTime() <= now)
    .filter((target) => target.draft_id || !job.nextDraftAttemptAt || new Date(job.nextDraftAttemptAt).getTime() <= now)
    .sort((a, b) => a.priority - b.priority || a.warehouse.localeCompare(b.warehouse))
    .slice(0, job.concurrency_limit);

  if (!readyTargets.length) {
    const nextTimes = activeTargets
      .map((target) => new Date(target.next_attempt_at || job.next_attempt_at).getTime())
      .filter(Number.isFinite);
    if (job.nextDraftAttemptAt) nextTimes.push(new Date(job.nextDraftAttemptAt).getTime());
    const nextAt = nextTimes.filter(Number.isFinite).sort((a, b) => a - b)[0];
    job.next_attempt_at = new Date(nextAt || now + job.interval_seconds * 1000).toISOString();
    return;
  }

  job.last_message = `Проверяем ${readyTargets.length} город(а) параллельно`;
  await Promise.all(readyTargets.map((target) => attemptSlotHunterTarget(job, target)));
}

async function attemptSlotHunterTarget(job, target) {
  if (job.status !== "running") return;
  target.attempts_count += 1;
  target.last_attempt_at = new Date().toISOString();
  target.error_message = null;
  let currentAction = target.draft_id ? "get_timeslots" : "create_draft";

  try {
    if (!target.draft_id && target.operation_id && OZON_FBO_DRAFT_FLOW === "classic") {
      currentAction = "check_draft";
      target.status = "draft_created";
      target.last_message = "Р–РґС‘Рј, РїРѕРєР° Ozon РїРѕРґРіРѕС‚РѕРІРёС‚ API-С‡РµСЂРЅРѕРІРёРє";
      addSlotHunterAttempt(job, target, "check_draft", "retrying", "РџСЂРѕРІРµСЂСЏРµРј РіРѕС‚РѕРІРЅРѕСЃС‚СЊ С‡РµСЂРЅРѕРІРёРєР°", {
        operation_id: target.operation_id,
      });
      const draftInfo = await job.client.pollClassicDraftInfo(target.operation_id, 1);
      if (Array.isArray(draftInfo.warehouse_ids) && draftInfo.warehouse_ids.length) {
        target.candidate.warehouse_ids = draftInfo.warehouse_ids;
      }
      target.candidate.draft_flow = "classic";
      if (Array.isArray(draftInfo.errors) && draftInfo.errors.length) {
        throw new Error(draftInfo.errors.join("; "));
      }
      target.draft_id = draftInfo.draft_id || target.draft_id;
      addSlotHunterAttempt(job, target, "check_draft", target.draft_id ? "success" : "retrying", target.draft_id ? `Р§РµСЂРЅРѕРІРёРє РіРѕС‚РѕРІ: ${target.draft_id}` : "Ozon РµС‰С‘ РіРѕС‚РѕРІРёС‚ С‡РµСЂРЅРѕРІРёРє", {
        operation_id: target.operation_id,
        draft_id: target.draft_id,
        status: draftInfo.status,
      });
      if (!target.draft_id) {
        scheduleSlotTargetDelay(job, target, OZON_AFTER_DRAFT_SLOT_DELAY_MS);
        job.draft_phase_until = target.next_attempt_at;
        return;
      }
    }
    if (!target.draft_id) {
      currentAction = "create_draft";
      target.status = "draft_created";
      target.last_message = "Создаём или ждём черновик Ozon";
      addSlotHunterAttempt(job, target, "create_draft", "retrying", "Создаём черновик для поиска слотов");
      const draft = await job.client.createSupplyDraftFromCandidate(target.candidate);
      target.operation_id = draft.operation_id || target.operation_id;
      target.draft_id = draft.draft_id || target.draft_id;
      if (Array.isArray(draft.selected_cluster_warehouses) && draft.selected_cluster_warehouses.length) {
        target.candidate.selected_cluster_warehouses = draft.selected_cluster_warehouses;
        target.candidate.selected_cluster_warehouses_source = draft.selected_cluster_warehouses_source || "draft_info";
      }
      // Сохраняем macrolocal cluster_ids из создания черновика — они точно правильные
      if (Array.isArray(draft.cluster_ids) && draft.cluster_ids.length) {
        target.candidate.cluster_ids = uniqueStrings([
          ...(target.candidate.cluster_ids || []).map(String),
          ...draft.cluster_ids.map(String),
        ]);
      }
      if (Array.isArray(draft.warehouse_ids) && draft.warehouse_ids.length) {
        target.candidate.warehouse_ids = draft.warehouse_ids;
      }
      if (draft.draft_flow) {
        target.candidate.draft_flow = draft.draft_flow;
      }
      if (draft.supply_mode) {
        target.candidate.supply_mode = draft.supply_mode;
      }
      if (draft.supply_type) {
        target.candidate.supply_type = draft.supply_type;
      }
      if (draft.drop_off_point_warehouse_id) {
        target.candidate.drop_off_point_warehouse_id = draft.drop_off_point_warehouse_id;
      }
      if (draft.drop_off_point_warehouse_type) {
        target.candidate.drop_off_point_warehouse_type = draft.drop_off_point_warehouse_type;
      }
      if (Array.isArray(draft.errors) && draft.errors.length) {
        throw new Error(draft.errors.join("; "));
      }
      job.nextDraftAttemptAt = new Date(Date.now() + OZON_SLOT_DRAFT_SPACING_MS).toISOString();
      addSlotHunterAttempt(
        job,
        target,
        "create_draft",
        target.draft_id ? "success" : "retrying",
        target.draft_id ? `Черновик готов: ${target.draft_id}` : "Ozon ещё создаёт черновик",
        { operation_id: target.operation_id, draft_id: target.draft_id, status: draft.status },
      );
      if (!target.draft_id) {
        scheduleSlotTargetRetry(job, target);
        return;
      }
      target.status = "draft_ready";
      target.last_message = `Ozon вернул API-черновик ${target.draft_id}. Ждём паузу перед проверкой слотов`;
      scheduleSlotTargetDelay(job, target, OZON_AFTER_DRAFT_SLOT_DELAY_MS);
      job.draft_phase_until = target.next_attempt_at;
      return;
    } else if (!target.draft_reused_logged) {
      target.draft_reused_logged = true;
      // Обогащаем кандидата macrolocal cluster_ids из draft_info (один раз при reuse)
      if (!target.candidate.macrolocal_lookup_done) {
        try {
          const draftInfo = await job.client.getSupplyDraftInfoByDraftId(target.draft_id);
          // Диагностика: сохраняем сырой ответ для отладки crossdock
          target.candidate.__draft_info_debug = safeJsonSnippet(draftInfo, 1500);
          const draftWarehouses = extractSelectedClusterWarehousesFromDraftInfo(draftInfo, target.candidate.cluster_ids);
          if (draftWarehouses.length) {
            target.candidate.selected_cluster_warehouses = draftWarehouses;
            target.candidate.selected_cluster_warehouses_source = "draft_info";
            const macrolocalFromDraft = draftWarehouses
              .map((item) => item.cluster_id)
              .filter((id) => id && Number(id) >= 1000)
              .map(String);
            if (macrolocalFromDraft.length) {
              target.candidate.cluster_ids = uniqueStrings([
                ...(target.candidate.cluster_ids || []).map(String),
                ...macrolocalFromDraft,
              ]);
              target.candidate.macrolocal_lookup_done = true;
            }
          }
          // Фоллбэк: если draft_info не дал macrolocal — ищем по названию города
          const haveMacrolocal = preferMacrolocalClusterIds(target.candidate.cluster_ids || []).some((id) => id >= 1000);
          if (!haveMacrolocal && target.candidate.warehouse) {
            const macrolocalByName = (await job.client.findMacrolocalClusterIdsForWarehouse(target.candidate.warehouse)).filter((id) => id >= 1000);
            if (macrolocalByName.length) {
              target.candidate.cluster_ids = uniqueStrings([
                ...(target.candidate.cluster_ids || []).map(String),
                ...macrolocalByName.map(String),
              ]);
              target.candidate.macrolocal_lookup_done = true;
            }
          }
        } catch (error) {
          if (error.status === 429) throw error;
          // Игнорируем другие ошибки — попробуем без обогащения
        }
      }
      target.status = "draft_ready";
      target.last_message = `Черновик готов, ищем слот`;
      scheduleSlotTargetDelay(job, target, OZON_AFTER_DRAFT_SLOT_DELAY_MS);
      job.draft_phase_until = target.next_attempt_at;
      return;
    }

    let selectedSlot = job.auto_book ? normalizeTimeslotForOzon(target.selected_slot) : null;
    if (!selectedSlot) {
      currentAction = "get_timeslots";
      target.status = "searching";
      target.last_message = "Проверяем доступные слоты";
      const timeslotInfo = await job.client.getDraftTimeslots(
        target.draft_id,
        job.slotSettings,
        target.candidate,
      );
      if (timeslotInfo && timeslotInfo.__request_variant) {
        target.candidate.timeslot_request_variant = timeslotInfo.__request_variant;
        target.candidate.supply_type = timeslotInfo.__request_variant.supply_type;
        target.candidate.selected_cluster_warehouses = timeslotInfo.__request_variant.selected_cluster_warehouses;
        target.candidate.selected_cluster_warehouses_source = "timeslot_info";
      }
      const slots = filterSlotCandidates(
        extractSlotCandidates(timeslotInfo),
        job.slotSettings,
      );
      if (!slots.length) {
        target.last_message = "Свободных слотов пока нет";
        addSlotHunterAttempt(job, target, "get_timeslots", "empty", "Слотов нет", { raw_response: timeslotInfo });
        scheduleSlotTargetRetry(job, target);
        return;
      }

      selectedSlot = normalizeTimeslotForOzon(chooseSlot(slots, job.slotSettings));
      if (!selectedSlot) {
        target.last_message = "Ozon вернул слот без полного времени";
        addSlotHunterAttempt(job, target, "get_timeslots", "empty", "Слот без полного времени, пропускаем", {
          raw_response: timeslotInfo,
        });
        scheduleSlotTargetRetry(job, target);
        return;
      }
      target.selected_slot = selectedSlot;
      target.status = "slot_found";
      target.last_message = "Слот найден";
      addSlotHunterAttempt(job, target, "get_timeslots", "success", "Слот найден", {
        available_slots: slots.slice(0, 5),
        selected_slot: selectedSlot,
      });
      if (job.auto_book) {
      target.last_message = "Слот найден. Ждём паузу перед бронью, чтобы не поймать лимит Ozon";
        scheduleSlotTargetDelay(job, target, OZON_BEFORE_BOOKING_DELAY_MS);
        return;
      }
    } else {
      target.status = "slot_found";
      target.last_message = "Слот уже найден, повторяем бронь после паузы";
    }

    if (!job.auto_book) return;

    if (target.supply_operation_id && shouldPollClassicSupplyCreateStatus(target.candidate)) {
      currentAction = "create_supply_status";
      target.last_message = "Checking whether Ozon confirmed the supply request";
      const statusInfo = await job.client.pollClassicSupplyCreateStatus(target.supply_operation_id, 1);
      if (statusInfo.pending) {
        addSlotHunterAttempt(job, target, "create_supply_status", "retrying", "Ozon is still processing the slot booking", {
          operation_id: target.supply_operation_id,
          raw_response: statusInfo.raw_info,
        });
        scheduleSlotTargetDelay(job, target, OZON_AFTER_DRAFT_SLOT_DELAY_MS);
        return;
      }
      target.supply_order_id = statusInfo.supply_order_id || target.supply_order_id;
      target.booking_rate_limit_count = 0;
      target.status = "booked";
      target.last_message = "Ozon confirmed the supply request";
      addSlotHunterAttempt(job, target, "create_supply_status", "success", "Ozon confirmed the supply request", {
        operation_id: target.supply_operation_id,
        supply_order_id: target.supply_order_id,
        raw_response: statusInfo.raw_info,
      });
      return;
    }

    currentAction = "create_supply";
    target.last_message = "Пробуем забронировать найденный слот";
    const supply = await job.client.createSupplyFromDraft(
      target.draft_id,
      selectedSlot,
      job.slotSettings,
      target.candidate,
    );
    target.supply_operation_id = extractOperationId(supply) || target.supply_operation_id;
    if (target.supply_operation_id && shouldPollClassicSupplyCreateStatus(target.candidate)) {
      const statusInfo = await job.client.pollClassicSupplyCreateStatus(target.supply_operation_id, 1);
      if (statusInfo.pending) {
        target.status = "slot_found";
        target.last_message = "Booking was sent to Ozon, waiting for confirmation";
        addSlotHunterAttempt(job, target, "create_supply_status", "retrying", "Ozon accepted the booking operation", {
          operation_id: target.supply_operation_id,
          raw_response: statusInfo.raw_info,
        });
        scheduleSlotTargetDelay(job, target, OZON_AFTER_DRAFT_SLOT_DELAY_MS);
        return;
      }
      target.supply_order_id = statusInfo.supply_order_id || extractSupplyOrderId(supply);
    } else {
      target.supply_order_id = extractSupplyOrderId(supply);
    }
    target.booking_rate_limit_count = 0;
    target.status = "booked";
    target.last_message = "Слот забронирован или заявка создана Ozon";
    addSlotHunterAttempt(job, target, "create_supply", "success", "Заявка/слот отправлены в Ozon", {
      operation_id: target.supply_operation_id || extractOperationId(supply),
      supply_order_id: target.supply_order_id,
      selected_slot: selectedSlot,
      raw_response: supply,
    });
  } catch (error) {
    const message = error.message || "Ошибка Ozon API";
    const status = Number(error && error.status);
    const isObsolete = isObsoleteMethodError(error);
    // Ошибка "пересоздайте черновик" — фатальная, нет смысла повторять
    const needRecreate = Boolean(error && error.__needRecreateDraft);
    // obsolete method — не фатально, getDraftTimeslots сам делает фоллбэк на v1/v2
    const isRequestRejected = needRecreate || (status >= 400 && status < 500 && status !== 429 && !isObsolete);
    if (error && error.operationId && !target.operation_id) {
      target.operation_id = cleanIdentifier(error.operationId);
    }
    target.error_message = status === 429 ? null : message;
    target.last_message = status === 429
      ? currentAction === "create_supply"
        ? "Слот найден, Ozon ограничил бронь. Повторим бронь после паузы"
        : "Пауза из-за лимита Ozon, повторим автоматически"
      : needRecreate
        ? `Черновик устарел. Создайте поставку заново. ${(message.match(/\[debug:.*\]/) || [""])[0]}`
        : isRequestRejected
          ? "Ozon отклонил запрос. Остановил повторы по этому городу, чтобы не крутить ошибку бесконечно"
          : message;
    target.status = status === 429 ? "cooldown" : isRequestRejected ? "failed" : "searching";
    if (status === 429) {
      pauseSlotHunterForRateLimit(job, target, error, currentAction);
    }
    addSlotHunterAttempt(
      job,
      target,
      currentAction,
      status === 429 ? "cooldown" : "failed",
      message,
      {
        http_status: status || null,
        raw_response: error.responseText || null,
      },
    );
    if (isRequestRejected) {
      return;
    }
    if (target.attempts_count >= SLOT_HUNTER_MAX_ATTEMPTS_PER_TARGET) {
      target.status = "failed";
      target.last_message = "Достигнут лимит попыток по городу";
      return;
    }
    // При 429 pauseSlotHunterForRateLimit уже выставил next_attempt_at (короткая пауза).
    // Не перезатираем его длинным интервалом — иначе ждём минуты вместо секунд.
    if (status === 429) {
      return;
    }
    scheduleSlotTargetRetry(job, target, 1);
  }
}

function scheduleSlotTargetRetry(job, target, multiplier = 1) {
  const priorityMultiplier = target && target.is_priority ? 0.55 : 1;
  const delayMs = Math.max(
    job.interval_seconds * multiplier * priorityMultiplier * 1000,
    SLOT_HUNTER_MIN_INTERVAL_SECONDS * 1000,
  );
  scheduleSlotTargetDelay(job, target, delayMs);
}

function scheduleSlotTargetDelay(job, target, delayMs) {
  target.next_attempt_at = new Date(Date.now() + delayMs + Math.floor(Math.random() * 5000)).toISOString();
}

function pauseSlotHunterForRateLimit(job, target, error, actionType = "") {
  const retryAfterMs = Number(error && error.retryAfterMs) || 0;
  if (actionType === "create_supply" && target) {
    target.booking_rate_limit_count = (Number(target.booking_rate_limit_count) || 0) + 1;
  }
  const bookingPenalty = actionType === "create_supply" && target
    ? Math.min(Number(target.booking_rate_limit_count || 1), 4)
    : 1;
  const baseCooldownMs = actionType === "create_supply"
    ? OZON_BOOKING_RATE_LIMIT_COOLDOWN_MS * bookingPenalty
    : ["create_draft", "check_draft"].includes(actionType)
      ? Math.max(OZON_DRAFT_RATE_LIMIT_COOLDOWN_MS, 10000)
      : OZON_SLOT_RATE_LIMIT_COOLDOWN_MS; // для слотов теперь 8 сек
  const cooldownMs = Math.max(baseCooldownMs, retryAfterMs);
  const nextAt = new Date(Date.now() + cooldownMs).toISOString();

  // При 429 на слоты — только конкретный target делает паузу, не весь магазин
  const isSlotAction = !["create_supply", "create_draft", "check_draft"].includes(actionType);
  if (isSlotAction) {
    if (target) {
      target.next_attempt_at = nextAt;
    }
    job.last_message = `Ozon: пауза ${Math.round(cooldownMs / 1000)} сек, повторим автоматически`;
    return;
  }

  // Для черновиков и бронирования — глобальная пауза по магазину
  job.rateLimitedUntil = nextAt;
  job.next_attempt_at = nextAt;
  job.last_message = actionType === "create_supply"
    ? `Ozon ограничил бронь слота. Делаем длинную паузу до ${new Date(nextAt).toLocaleTimeString("ru-RU")}`
    : `Ozon ограничил частоту запросов. Делаем паузу до ${new Date(nextAt).toLocaleTimeString("ru-RU")}`;
  for (const item of getActiveSlotTargets(job)) {
    const jitter = Math.floor(Math.random() * 5000);
    const extraPriorityDelay = item.is_priority ? 0 : Math.floor(job.interval_seconds * 1000);
    item.next_attempt_at = new Date(Date.now() + cooldownMs + extraPriorityDelay + jitter).toISOString();
    if (item.id !== target.id && ["waiting", "searching", "cooldown"].includes(item.status)) {
      item.status = "cooldown";
      item.last_message = "Пауза из-за лимита Ozon по магазину";
    }
  }
}

function normalizeSlotHunterSettings(settings, now) {
  const dateFrom = cleanDateInput(settings.date_from) || now.toISOString().slice(0, 10);
  const dateTo = cleanDateInput(settings.date_to) || new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return {
    date_from: dateFrom,
    date_to: dateTo < dateFrom ? dateFrom : dateTo,
    time_from: cleanTimeInput(settings.time_from),
    time_to: cleanTimeInput(settings.time_to),
    cargo_type: cleanCargoType(settings.cargo_type),
    smart_speed: settings.smart_speed !== false,
  };
}

function cleanDateInput(value) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function cleanTimeInput(value) {
  const text = String(value || "").trim();
  return /^\d{2}:\d{2}$/.test(text) ? text : "";
}

function cleanCargoType(value) {
  const text = String(value || "").trim().toLowerCase();
  if (["pallet", "pallets", "паллет", "паллеты"].includes(text)) return "pallet";
  if (["box", "boxes", "короб", "короба"].includes(text)) return "box";
  return "any";
}

function scheduleSlotHunterJob(job) {
  if (job.status !== "running") return;
  if (Date.now() > new Date(job.max_wait_until).getTime()) {
    finishSlotHunterJob(job, hasBookedSlot(job) ? "partial" : "expired", "Время поиска слотов истекло");
    return;
  }
  const activeTargets = getActiveSlotTargets(job);
  if (!activeTargets.length) {
    finishSlotHunterJob(job, job.targets.every((target) => target.status === "booked") ? "booked" : "partial", "Поиск завершён");
    return;
  }
  const nextTime = activeTargets
    .map((target) => new Date(target.next_attempt_at || new Date()).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => a - b)[0] || Date.now() + job.interval_seconds * 1000;
  const delayMs = Math.max(1000, nextTime - Date.now());
  job.next_attempt_at = new Date(Date.now() + delayMs).toISOString();
  clearTimeout(job.timer);
  job.timer = setTimeout(() => runSlotHunterJob(job.id), delayMs);
}

function stopSlotHunterJob(job, message) {
  clearTimeout(job.timer);
  job.status = "stopped";
  job.finished_at = new Date().toISOString();
  job.last_message = message || "Остановлено";
  for (const target of job.targets) {
    if (!isFinalSlotTarget(target, job)) {
      target.status = "stopped";
      target.last_message = job.last_message;
    }
  }
}

function finishSlotHunterJob(job, status, message) {
  clearTimeout(job.timer);
  job.status = status;
  job.finished_at = new Date().toISOString();
  job.last_message = message || "Задача завершена";
}

function getActiveSlotTargets(job) {
  return job.targets.filter((target) => !isFinalSlotTarget(target, job));
}

function isFinalSlotTarget(target, job) {
  if (target.status === "slot_found" && !job.auto_book) return true;
  return ["booked", "skipped", "stopped", "failed", "expired"].includes(target.status);
}

function hasBookedSlot(job) {
  return job.targets.some((target) => target.status === "booked");
}

function addSlotHunterAttempt(job, target, attemptType, status, message, extra = {}) {
  job.attempts.unshift({
    id: createLocalId("attempt"),
    target_id: target ? target.id : null,
    warehouse: target ? target.warehouse : null,
    attempt_type: attemptType,
    status,
    message,
    http_status: extra.http_status || null,
    operation_id: extra.operation_id || null,
    draft_id: extra.draft_id || null,
    supply_order_id: extra.supply_order_id || null,
    available_slots: extra.available_slots || null,
    selected_slot: extra.selected_slot || null,
    raw_response: extra.raw_response || null,
    attempted_at: new Date().toISOString(),
  });
  if (job.attempts.length > 200) job.attempts.length = 200;
}

function sanitizeSlotHunterJob(job) {
  return {
    id: job.id,
    status: job.status,
    mode: job.mode,
    auto_book: job.auto_book,
    interval_seconds: job.interval_seconds,
    concurrency_limit: job.concurrency_limit,
    max_wait_until: job.max_wait_until,
    created_at: job.created_at,
    started_at: job.started_at,
    finished_at: job.finished_at,
    next_attempt_at: job.next_attempt_at,
    rate_limited_until: job.rateLimitedUntil,
    draft_phase_until: job.draft_phase_until,
    last_message: job.last_message,
    summary: {
      targets: job.targets.length,
      booked: job.targets.filter((target) => target.status === "booked").length,
      found: job.targets.filter((target) => target.status === "slot_found").length,
      searching: job.targets.filter((target) => ["waiting", "draft_created", "draft_ready", "searching", "cooldown"].includes(target.status)).length,
      failed: job.targets.filter((target) => target.status === "failed").length,
      skipped: job.targets.filter((target) => target.status === "skipped").length,
      with_draft: job.targets.filter((target) => target.draft_id).length,
      priority: job.targets.filter((target) => target.is_priority).length,
      total_quantity: job.targets.reduce((sum, target) => sum + Number(target.total_quantity || 0), 0),
    },
    targets: job.targets.map((target) => ({
      id: target.id,
      warehouse: target.warehouse,
      status: target.status,
      priority: target.priority,
      is_priority: target.is_priority,
      rows_count: target.rows_count,
      total_quantity: target.total_quantity,
      attempts_count: target.attempts_count,
      last_attempt_at: target.last_attempt_at,
      next_attempt_at: target.next_attempt_at,
      operation_id: target.operation_id,
      draft_id: target.draft_id,
      supply_operation_id: target.supply_operation_id,
      supply_order_id: target.supply_order_id,
      selected_slot: target.selected_slot,
      last_message: target.last_message,
      error_message: target.error_message,
    })),
    attempts: job.attempts.slice(0, 80),
  };
}

function extractSlotCandidates(data) {
  const slots = [];
  const seen = new Set();
  const addSlot = (slot, context = {}) => {
    if (!slot || typeof slot !== "object") return;
    const enriched = {
      ...context,
      ...slot,
    };
    const key = JSON.stringify(enriched);
    if (seen.has(key)) return;
    seen.add(key);
    slots.push(enriched);
  };

  collectDraftTimeslotCandidates(data, addSlot);

  function visit(value, path = "") {
    if (!value) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, path);
      return;
    }
    if (typeof value !== "object") return;
    if (looksLikeSlotObject(value, path)) {
      addSlot(value);
    }
    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      if (/slot|time|date|interval|period|result|items|warehouses/i.test(childPath)) visit(child, childPath);
    }
  }

  visit(data);
  return slots;
}

function collectDraftTimeslotCandidates(data, addSlot) {
  const rows = data && Array.isArray(data.drop_off_warehouse_timeslots)
    ? data.drop_off_warehouse_timeslots
    : data && data.result && Array.isArray(data.result.drop_off_warehouse_timeslots)
      ? data.result.drop_off_warehouse_timeslots
      : data && Array.isArray(data.dropOffWarehouseTimeslots)
        ? data.dropOffWarehouseTimeslots
        : [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const context = {
      drop_off_warehouse_id: extractSlotWarehouseId(row),
      warehouse_timezone: row.warehouse_timezone || row.warehouseTimezone || null,
    };
    const days = Array.isArray(row.days) ? row.days : [];
    for (const day of days) {
      if (!day || typeof day !== "object") continue;
      const timeslots = Array.isArray(day.timeslots) ? day.timeslots : [];
      for (const slot of timeslots) {
        addSlot(slot, {
          ...context,
          date_in_timezone: day.date_in_timezone || day.dateInTimezone || null,
        });
      }
    }
  }
}

function looksLikeSlotObject(value, path) {
  const keys = Object.keys(value).map((key) => key.toLowerCase());
  const keyText = keys.join(" ");
  const pathText = String(path || "").toLowerCase();
  const hasTimeShape = /(slot|time|date|interval|period|from|to|begin|end)/.test(`${pathText} ${keyText}`);
  const hasPrimitiveValue = Object.values(value).some((item) => ["string", "number", "boolean"].includes(typeof item));
  return hasTimeShape && hasPrimitiveValue && keys.length <= 20;
}

function filterSlotCandidates(slots, settings = {}) {
  return slots.filter((slot) => slotMatchesSettings(slot, settings));
}

function slotMatchesSettings(slot, settings = {}) {
  if (!normalizeTimeslotForOzon(slot)) return false;
  const text = JSON.stringify(slot || {}).toLowerCase();
  if (settings.cargo_type === "pallet" && /box|короб/i.test(text) && !/pallet|паллет/i.test(text)) return false;
  if (settings.cargo_type === "box" && /pallet|паллет/i.test(text) && !/box|короб/i.test(text)) return false;
  const moments = extractDateTimeValues(slot);
  if (!moments.length) return true;
  return moments.some((moment) => {
    const date = moment.slice(0, 10);
    const time = moment.slice(11, 16);
    if (settings.date_from && date < settings.date_from) return false;
    if (settings.date_to && date > settings.date_to) return false;
    if (settings.time_from && time && time < settings.time_from) return false;
    if (settings.time_to && time && time > settings.time_to) return false;
    return true;
  });
}

function extractDateTimeValues(value) {
  const results = [];
  function visit(item) {
    if (!item) return;
    if (typeof item === "string") {
      const matches = item.match(/\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2})?)?/g);
      if (matches) results.push(...matches.map((match) => match.replace(" ", "T")));
      return;
    }
    if (Array.isArray(item)) {
      for (const child of item) visit(child);
      return;
    }
    if (typeof item === "object") {
      for (const child of Object.values(item)) visit(child);
    }
  }
  visit(value);
  return uniqueStrings(results);
}

function normalizeTimeslotForOzon(slot) {
  if (!slot || typeof slot !== "object") return null;
  const from = firstTimestampByKey(slot, [
    "from_in_timezone",
    "fromInTimezone",
    "from",
    "date_from",
    "dateFrom",
    "start",
    "start_at",
    "startAt",
    "begin",
    "begin_at",
    "beginAt",
  ]);
  const to = firstTimestampByKey(slot, [
    "to_in_timezone",
    "toInTimezone",
    "to",
    "date_to",
    "dateTo",
    "end",
    "end_at",
    "endAt",
    "finish",
    "finish_at",
    "finishAt",
  ]);
  if (!from || !to) return null;
  const result = {
    ...removeEmptyStrings(slot),
    from_in_timezone: from,
    to_in_timezone: to,
  };
  return result;
}

function firstTimestampByKey(value, keys) {
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  const fallback = [];
  const queue = [value];
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }
    for (const [key, child] of Object.entries(current)) {
      if (typeof child === "string") {
        const normalized = normalizeOzonLocalTimestamp(child);
        if (!normalized) continue;
        if (wanted.has(key.toLowerCase())) return normalized;
        fallback.push(normalized);
      } else if (child && typeof child === "object") {
        queue.push(child);
      }
    }
  }
  return fallback[0] || null;
}

function extractSlotWarehouseId(slot) {
  if (!slot || typeof slot !== "object") return null;
  const direct = toPositiveIntegerId(
    slot.drop_off_warehouse_id
    || slot.dropOffWarehouseId
    || slot.warehouse_id
    || slot.warehouseId
    || slot.storage_warehouse_id
    || slot.storageWarehouseId
    || slot.supply_warehouse_id
    || slot.supplyWarehouseId,
  );
  if (direct) return direct;
  if (slot.supply_warehouse && typeof slot.supply_warehouse === "object") {
    return toPositiveIntegerId(slot.supply_warehouse.warehouse_id || slot.supply_warehouse.id);
  }
  return null;
}

function normalizeOzonLocalTimestamp(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})(?::(\d{2}))?/);
  if (!match) return "";
  return `${match[1]}T${match[2]}:${match[3] || "00"}`;
}

function removeEmptyStrings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (child === "") continue;
    result[key] = child;
  }
  return result;
}

function chooseSlot(slots, settings = {}) {
  return [...slots].sort((a, b) => {
    const aScore = scoreSlot(a, settings);
    const bScore = scoreSlot(b, settings);
    return bScore - aScore || stringifySlotForSort(a).localeCompare(stringifySlotForSort(b));
  })[0] || null;
}

function scoreSlot(slot, settings = {}) {
  const text = JSON.stringify(slot || {}).toLowerCase();
  let score = 0;
  if (settings.cargo_type === "pallet" && /pallet|паллет/i.test(text)) score += 20;
  if (settings.cargo_type === "box" && /box|короб/i.test(text)) score += 20;
  const moments = extractDateTimeValues(slot);
  for (const moment of moments) {
    const date = moment.slice(0, 10);
    const time = moment.slice(11, 16);
    if (settings.date_from && date >= settings.date_from) score += 5;
    if (settings.date_to && date <= settings.date_to) score += 5;
    if (settings.time_from && time >= settings.time_from) score += 3;
    if (settings.time_to && time <= settings.time_to) score += 3;
  }
  return score;
}

function stringifySlotForSort(slot) {
  return JSON.stringify(slot || {});
}

function extractSupplyOrderId(data) {
  return findFirstIdentifierByKeys(data, [
    "supply_order_id",
    "supplyOrderId",
    "order_id",
    "orderId",
  ]);
}

function createLocalId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function distributeByWeights(quantity, warehouses, weights, options = {}) {
  const totalWeight = sumObjectValues(weights);
  if (totalWeight <= 0 && options.allowEmpty) {
    return Object.fromEntries(warehouses.map((warehouse) => [warehouse.name, 0]));
  }
  const fallbackWeight = warehouses.length ? 1 / warehouses.length : 0;
  const values = warehouses.map((warehouse) => ({
    name: warehouse.name,
    weight: totalWeight > 0 ? Number(weights[warehouse.name] || 0) : fallbackWeight,
    quantity: Math.floor(quantity * (totalWeight > 0 ? Number(weights[warehouse.name] || 0) / totalWeight : fallbackWeight)),
  }));
  let remainder = quantity - values.reduce((sum, item) => sum + item.quantity, 0);
  [...values].sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name)).slice(0, remainder).forEach((item) => { item.quantity += 1; });
  return Object.fromEntries(values.map((item) => [item.name, item.quantity]));
}

function createXlsx(rows) {
  const sheetRows = [
    TEMPLATE_COLUMNS.map((value) => ({ type: "s", value })),
    ...rows.map((row) => [
      { type: "s", value: row.offer_id },
      { type: "s", value: row.name },
      { type: "n", value: row.quantity },
    ]),
  ];
  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>
${sheetRows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((cell, columnIndex) => {
  const ref = `${indexToColumnName(columnIndex)}${rowIndex + 1}`;
  return cell.type === "n"
    ? `<c r="${ref}"><v>${cell.value}</v></c>`
    : `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(cell.value)}</t></is></c>`;
}).join("")}</row>`).join("\n")}
</sheetData>
</worksheet>`;
  return createZip([
    { name: "[Content_Types].xml", data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`) },
    { name: "_rels/.rels", data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
    { name: "xl/workbook.xml", data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Ozon FBO" sheetId="1" r:id="rId1"/></sheets></workbook>`) },
    { name: "xl/_rels/workbook.xml.rels", data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`) },
    { name: "xl/styles.xml", data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="1"><xf xfId="0"/></cellXfs></styleSheet>`) },
    { name: "xl/worksheets/sheet1.xml", data: Buffer.from(sheetXml) },
  ]);
}

function createInputTemplateXlsx() {
  const sheetRows = [
    [
      { type: "s", value: "SKU Ozon" },
      { type: "s", value: "Артикул продавца" },
      { type: "s", value: "Название товара" },
      { type: "s", value: "Количество" },
    ],
  ];
  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<cols>
<col min="1" max="1" width="18" customWidth="1"/>
<col min="2" max="2" width="22" customWidth="1"/>
<col min="3" max="3" width="38" customWidth="1"/>
<col min="4" max="4" width="14" customWidth="1"/>
</cols>
<sheetData>
${sheetRows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((cell, columnIndex) => {
  const ref = `${indexToColumnName(columnIndex)}${rowIndex + 1}`;
  return cell.type === "n"
    ? `<c r="${ref}"><v>${cell.value}</v></c>`
    : `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(cell.value)}</t></is></c>`;
}).join("")}</row>`).join("\n")}
</sheetData>
<dataValidations count="1">
<dataValidation type="whole" operator="greaterThan" allowBlank="1" sqref="D2:D5000"><formula1>0</formula1></dataValidation>
</dataValidations>
</worksheet>`;
  return createZip([
    { name: "[Content_Types].xml", data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`) },
    { name: "_rels/.rels", data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
    { name: "xl/workbook.xml", data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Товары" sheetId="1" r:id="rId1"/></sheets></workbook>`) },
    { name: "xl/_rels/workbook.xml.rels", data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`) },
    { name: "xl/styles.xml", data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="1"><xf xfId="0"/></cellXfs></styleSheet>`) },
    { name: "xl/worksheets/sheet1.xml", data: Buffer.from(sheetXml) },
  ]);
}

function createZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data);
    const compressed = zlib.deflateRawSync(data);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(0, 10);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, compressed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(0, 12);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + compressed.length;
  }
  const central = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, central, eocd]);
}

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function validateWarehouses(warehouses) {
  const total = warehouses.reduce((sum, warehouse) => sum + Number(warehouse.percentage), 0);
  if (Math.abs(total - 100) > 0.001) throw new Error("Сумма процентов складов должна быть 100");
}

function normalizeWarehousePercentages(warehouses) {
  const cleanWarehouses = warehouses
    .filter((warehouse) => warehouse && String(warehouse.name || "").trim())
    .map((warehouse) => ({
      name: String(warehouse.name).trim(),
      percentage: Math.max(0, Number(warehouse.percentage) || 0),
    }));
  if (!cleanWarehouses.length) return DEFAULT_WAREHOUSES;

  const total = cleanWarehouses.reduce((sum, warehouse) => sum + warehouse.percentage, 0);
  if (total > 0) {
    return cleanWarehouses.map((warehouse) => ({
      ...warehouse,
      percentage: warehouse.percentage / total * 100,
    }));
  }

  return assignFallbackPercentages(cleanWarehouses);
}

function sumValues(map) {
  let total = 0;
  for (const value of map.values()) total += Number(value) || 0;
  return total;
}

function sumObjectValues(object) {
  return Object.values(object).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const text = String(value || "").trim();
    const key = normalizeText(text);
    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

function getDateRange(days) {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - days);
  return {
    from: formatDate(from),
    to: formatDate(to),
  };
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function safeFilenamePart(value) {
  return String(value || "warehouse")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120) || "warehouse";
}

function normalizeColumn(value) {
  return String(value || "").trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function cleanCell(value) {
  const text = String(value || "").trim();
  return text || null;
}

function cleanIdentifier(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const normalized = normalizeExcelNumberText(text);
  return normalized || text;
}

function normalizeExcelNumberText(value) {
  const text = String(value || "").trim().replace(",", ".");
  if (!text) return "";
  if (/^\d+\.0+$/.test(text)) return text.replace(/\.0+$/, "");
  if (/^[+-]?\d+(?:\.\d+)?e[+-]?\d+$/i.test(text) || /^\d+\.\d+$/.test(text)) {
    const number = Number(text);
    if (Number.isSafeInteger(number)) return number.toFixed(0);
  }
  return text;
}

function isLikelyOzonSku(value) {
  const text = cleanIdentifier(value);
  return Boolean(text && /^\d{7,}$/.test(text));
}

function isRecoverableLookupError(error) {
  const status = Number(error && error.status);
  if (status === 400 || status === 404) return true;
  const message = String((error && error.message) || "");
  return /invalid|parameter|not found|не найден/i.test(message);
}

function isEndpointFallbackError(error) {
  const status = Number(error && error.status);
  if ([400, 404, 405, 410].includes(status)) return true;
  const message = String((error && error.message) || "");
  return /not found|obsolete|deprecated|устар|unknown method|invalid request|не найден/i.test(message);
}

function isVersionFallbackError(error) {
  const status = Number(error && error.status);
  if ([400, 404, 405, 410].includes(status)) {
    const message = String((error && error.message) || "");
    const responseText = String((error && error.responseText) || "");
    // 400 только если это именно "obsolete/deprecated" — не любой 400
    if (status === 400) {
      return /obsolete|deprecated|cannot be used|unknown method/i.test(`${message} ${responseText}`);
    }
    return true;
  }
  const message = String((error && error.message) || "");
  const responseText = String((error && error.responseText) || "");
  return /not found|obsolete|deprecated|устар|unknown method|method not allowed|не найден/i.test(`${message} ${responseText}`);
}

function isObsoleteMethodError(error) {
  const status = Number(error && error.status);
  if (![400, 404, 405, 410].includes(status)) return false;
  const message = String((error && error.message) || "");
  const responseText = String((error && error.responseText) || "");
  return /obsolete|deprecated|cannot be used|method not allowed|unknown method/i.test(`${message} ${responseText}`);
}

function isSelectedClusterWarehousesValidationError(error) {
  const status = Number(error && error.status);
  if (status !== 400) return false;
  const message = String((error && error.message) || "");
  const responseText = String((error && error.responseText) || "");
  return /SelectedClusterWarehouses|selected_cluster_warehouses|storage_warehouse_id|cluster_id|macrolocal_cluster_id|unknown field/i.test(`${message} ${responseText}`);
}

function isSupplyTypeValidationError(error) {
  const status = Number(error && error.status);
  if (status !== 400) return false;
  const message = String((error && error.message) || "");
  const responseText = String((error && error.responseText) || "");
  return /SupplyType|supply_type|specified supply type|wrong delivery flow|delivery flow|is CrossDock|not allowed parameter .*warehouse_id|warehouse_id .*specified supply type/i.test(`${message} ${responseText}`);
}

function isCrossdockDeliveryFlowError(error) {
  const status = Number(error && error.status);
  if (status !== 400) return false;
  const message = String((error && error.message) || "");
  const responseText = String((error && error.responseText) || "");
  return /wrong delivery flow|is CrossDock/i.test(`${message} ${responseText}`);
}

function buildDirectDraftCreatePayload(macrolocalClusterId, items, deletionSkuMode) {
  return {
    cluster_info: {
      macrolocal_cluster_id: macrolocalClusterId,
      items,
    },
    deletion_sku_mode: deletionSkuMode,
  };
}

function buildCrossdockDraftCreatePayloads(macrolocalClusterId, items, dropOffPointWarehouseId, dropOffWarehouseType) {
  return [
    {
      endpoint: "/v1/draft/crossdock/create",
      variant: "crossdock.delivery_info.drop_off_warehouse.warehouse_id+warehouse_type",
      payload: {
        cluster_info: {
          macrolocal_cluster_id: macrolocalClusterId,
          items,
        },
        delivery_info: {
          type: 1,
          drop_off_warehouse: {
            warehouse_id: dropOffPointWarehouseId,
            warehouse_type: dropOffWarehouseType,
          },
        },
        deletion_sku_mode: 1,
      },
    },
  ];
}

function annotateDraftAttemptError(error, meta) {
  error.draftMeta = meta;
  return error;
}

function isDeletionSkuModeValidationError(error) {
  const message = String((error && error.message) || "");
  const responseText = String((error && error.responseText) || "");
  return /DeletionSkuMode|deletion_sku_mode/i.test(`${message} ${responseText}`);
}

function isMacrolocalClusterValidationError(error) {
  const message = String((error && error.message) || "");
  const responseText = String((error && error.responseText) || "");
  return /MacrolocalClusterId|macrolocal_cluster_id/i.test(`${message} ${responseText}`);
}

function enrichDraftCreateError(errors) {
  const items = Array.isArray(errors) ? errors : [errors].filter(Boolean);
  const details = items.map((error) => {
    const meta = error && error.draftMeta
      ? `cluster=${error.draftMeta.clusterId}, deletion_sku_mode=${error.draftMeta.deletionSkuMode}: `
      : "";
    return `${meta}${formatLookupError(error)}`;
  }).join(" | ");
  const error = new Error(
    `Ozon не создал direct-черновик поставки. Проверили доступные macrolocal_cluster_id и варианты deletion_sku_mode. Детали: ${details}`,
  );
  const lastError = items[items.length - 1];
  error.status = lastError && lastError.status;
  error.path = "/v1/draft/direct/create";
  error.responseText = items.map((item) => {
    const meta = item && item.draftMeta
      ? `cluster=${item.draftMeta.clusterId}, deletion_sku_mode=${item.draftMeta.deletionSkuMode}: `
      : "";
    return item && item.responseText ? `${meta}${item.responseText}` : "";
  }).filter(Boolean).join(" | ").slice(0, 1200);
  return error;
}

function enrichCrossdockDraftCreateError(errors) {
  const items = Array.isArray(errors) ? errors : [errors].filter(Boolean);
  const details = items.map((error) => {
    const meta = error && error.draftMeta
      ? `${error.draftMeta.endpoint}, ${error.draftMeta.variant}, cluster=${error.draftMeta.clusterId}, drop_off=${error.draftMeta.dropOffPointWarehouseId}: `
      : "";
    return `${meta}${formatLookupError(error)}`;
  }).join(" | ");
  const error = new Error(
    `Ozon не создал crossdock-черновик. Проверили modern crossdock и multi-cluster endpoints. Детали: ${details}`,
  );
  const lastError = items[items.length - 1];
  error.status = lastError && lastError.status;
  error.path = items.map((item) => item && item.draftMeta && item.draftMeta.endpoint).filter(Boolean).join(" | ") || "/v1/draft/crossdock/create";
  error.responseText = items.map((item) => {
    const meta = item && item.draftMeta
      ? `${item.draftMeta.endpoint}, ${item.draftMeta.variant}, cluster=${item.draftMeta.clusterId}: `
      : "";
    return item && item.responseText ? `${meta}${item.responseText}` : "";
  }).filter(Boolean).join(" | ").slice(0, 1200);
  return error;
}

function buildOzonApiErrorMessage(path, status, text) {
  const raw = String(text || "").trim();
  let readable = raw;
  try {
    const parsed = JSON.parse(raw);
    readable = parsed.message
      || parsed.error
      || parsed.detail
      || parsed.description
      || JSON.stringify(parsed);
  } catch {
    readable = raw || "пустой ответ";
  }
  const hint = getOzonApiErrorHint(status, readable);
  const details = String(readable || "пустой ответ").slice(0, 700);
  return `Ozon API ${path} вернул ${status}: ${details}${hint ? ` ${hint}` : ""}`;
}

function getOzonApiErrorHint(status, message) {
  const text = String(message || "");
  if (Number(status) === 403 || /permission|forbidden|access|role|denied|доступ|прав|роль/i.test(text)) {
    return "Для создания черновиков нужен API-ключ с ролью Supply order или Admin. Admin read only и Supply order ReadOnly подходят только для чтения.";
  }
  if (Number(status) === 429 || /rate limit|too many|частот/i.test(text)) {
    return "Это лимит Ozon: сервис поставит общую паузу по магазину и повторит позже.";
  }
  if (Number(status) === 400 || /invalid|required|обязател|невалид/i.test(text)) {
    return "Если ошибка про обязательные поля, пришлите этот текст: по нему видно, какой параметр Ozon требует для черновика.";
  }
  return "";
}

function formatLookupError(error) {
  const status = error && error.status ? `${error.status} ` : "";
  return `${status}${String((error && error.message) || error || "unknown").slice(0, 240)}`;
}

function normalizePositiveOzonIds(values) {
  const rawValues = Array.isArray(values) ? values : [values];
  const ids = [];
  for (const value of rawValues) {
    const id = toPositiveIntegerId(value);
    if (id) ids.push(String(id));
  }
  return uniqueStrings(ids).map((value) => Number(value));
}

// Macrolocal cluster id у Ozon — это большие id (>= 1000). Classic — маленькие (< 1000).
// Для v2 /draft/timeslot/info и /draft/supply/create нужен именно macrolocal.
function preferMacrolocalClusterIds(values) {
  const all = normalizePositiveOzonIds(values);
  const macrolocal = all.filter((id) => id >= 1000);
  return macrolocal.length ? macrolocal : all;
}

function normalizeClassicDraftClusterIds(values) {
  return normalizePositiveOzonIds(values)
    .filter((id) => id > 0 && id < 1000);
}

function extractFboShippingWarehousePoints(data) {
  const rows = [];
  if (Array.isArray(data && data.search)) rows.push(...data.search);
  if (data && data.result) {
    if (Array.isArray(data.result.search)) rows.push(...data.result.search);
    if (Array.isArray(data.result.warehouses)) rows.push(...data.result.warehouses);
    if (Array.isArray(data.result)) rows.push(...data.result);
  }
  if (Array.isArray(data && data.warehouses)) rows.push(...data.warehouses);

  const seen = new Set();
  const points = [];
  for (const row of rows) {
    const point = normalizeFboShippingWarehousePoint(row);
    if (!point || !point.id) continue;
    const key = `${point.id}:${normalizeText(point.name)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    points.push(point);
  }
  return points;
}

function normalizeFboShippingWarehousePoint(row) {
  if (!row || typeof row !== "object") return null;
  const id = cleanIdentifier(
    row.drop_off_point_warehouse_id
      || row.dropOffPointWarehouseId
      || row.dropoff_point_id
      || row.dropoffPointId
      || row.drop_off_warehouse_id
      || row.dropOffWarehouseId
      || row.warehouse_id
      || row.warehouseId
      || row.id
      || row.place_id
      || row.placeId,
  );
  const name = String(
    row.name
      || row.warehouse_name
      || row.warehouseName
      || row.title
      || row.display_name
      || row.displayName
      || "",
  ).trim();
  const address = String(
    row.address
      || row.full_address
      || row.fullAddress
      || row.location
      || row.description
      || "",
  ).trim();
  const warehouseType = String(
    row.warehouse_type
      || row.warehouseType
      || (row.drop_off_warehouse && row.drop_off_warehouse.warehouse_type)
      || (row.dropOffWarehouse && row.dropOffWarehouse.warehouseType)
      || (row.warehouse && row.warehouse.warehouse_type)
      || (row.warehouse && row.warehouse.warehouseType)
      || row.type
      || "",
  ).trim();
  const limits = [
    row.box_count !== undefined ? `коробов: ${row.box_count}` : "",
    row.pallet_count !== undefined ? `палет: ${row.pallet_count}` : "",
    row.max_box_count !== undefined ? `макс. коробов: ${row.max_box_count}` : "",
    row.max_pallet_count !== undefined ? `макс. палет: ${row.max_pallet_count}` : "",
  ].filter(Boolean);
  return {
    id,
    name: name || id,
    address,
    warehouse_type: warehouseType,
    limits,
  };
}

function toPositiveIntegerId(value) {
  const text = cleanIdentifier(value);
  if (!text || !/^\d+$/.test(text)) return null;
  const number = Number(text);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function safeJsonSnippet(value, maxLength = 800) {
  try {
    return JSON.stringify(value).slice(0, maxLength);
  } catch {
    return String(value || "").slice(0, maxLength);
  }
}

function parseQuantity(value) {
  const number = Number(String(value || "").replace(/\s+/g, "").replace(",", "."));
  return Number.isInteger(number) && number > 0 ? number : null;
}

function columnNameToIndex(name) {
  let value = 0;
  for (const char of name) value = value * 26 + char.charCodeAt(0) - 64;
  return value - 1;
}

function indexToColumnName(index) {
  let name = "";
  let value = index + 1;
  while (value > 0) {
    const mod = (value - 1) % 26;
    name = String.fromCharCode(65 + mod) + name;
    value = Math.floor((value - mod) / 26);
  }
  return name;
}

function escapeXml(value) {
  return String(value ?? "").replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[char]));
}

function decodeXml(value) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function summarizeOzonPayload(path, payload) {
  const cleanPath = String(path || "");
  if (
    cleanPath.includes("/draft/create")
    || cleanPath.includes("/draft/direct/create")
    || cleanPath.includes("/draft/crossdock/create")
    || cleanPath.includes("/draft/multi-cluster/create")
  ) {
    const clusterInfo = payload && payload.cluster_info;
    const clustersInfo = Array.isArray(payload && payload.clusters_info) ? payload.clusters_info : [];
    const items = Array.isArray(payload && payload.items)
      ? payload.items
      : Array.isArray(clusterInfo && clusterInfo.items)
        ? clusterInfo.items
        : clustersInfo.flatMap((cluster) => Array.isArray(cluster.items) ? cluster.items : []);
    const deliveryInfo = payload && payload.delivery_info && typeof payload.delivery_info === "object"
      ? payload.delivery_info
      : {};
    return {
      type: payload && payload.type,
      cluster_ids: payload && payload.cluster_ids,
      macrolocal_cluster_id: clusterInfo && clusterInfo.macrolocal_cluster_id,
      clusters_info: clustersInfo.map((cluster) => cluster.macrolocal_cluster_id).filter(Boolean),
      delivery_info_type: deliveryInfo.type,
      drop_off_point_warehouse_id:
        (payload && payload.drop_off_point_warehouse_id)
        || deliveryInfo.drop_off_point_warehouse_id
        || deliveryInfo.drop_off_warehouse_id
        || (deliveryInfo.drop_off_warehouse && deliveryInfo.drop_off_warehouse.warehouse_id)
        || (deliveryInfo.drop_off_warehouse && deliveryInfo.drop_off_warehouse.id)
        || deliveryInfo.warehouse_id,
      drop_off_point_warehouse_type:
        (payload && payload.drop_off_point_warehouse_type)
        || deliveryInfo.drop_off_point_warehouse_type
        || deliveryInfo.drop_off_warehouse_type
        || (deliveryInfo.drop_off_warehouse && deliveryInfo.drop_off_warehouse.warehouse_type)
        || (deliveryInfo.drop_off_warehouse && deliveryInfo.drop_off_warehouse.type)
        || deliveryInfo.warehouse_type,
      deletion_sku_mode: payload && payload.deletion_sku_mode,
      items_count: items.length,
      total_quantity: items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
      first_skus: items.slice(0, 5).map((item) => cleanIdentifier(item.sku)).filter(Boolean),
    };
  }
  if (cleanPath.includes("/draft/create/info")) {
    return { operation_id: cleanIdentifier(payload && payload.operation_id) };
  }
  if (cleanPath.includes("/draft/supply/create")) {
    return {
      draft_id: cleanIdentifier(payload && payload.draft_id),
      warehouse_id: cleanIdentifier(payload && payload.warehouse_id),
      timeslot: payload && payload.timeslot,
    };
  }
  if (cleanPath.includes("/draft/timeslot")) {
    return {
      draft_id: cleanIdentifier(payload && payload.draft_id),
      date_from: payload && payload.date_from,
      date_to: payload && payload.date_to,
      warehouse_ids: payload && payload.warehouse_ids,
    };
  }
  return summarizeGenericOzonPayload(payload);
}

function summarizeGenericOzonPayload(payload) {
  if (!payload || typeof payload !== "object") return {};
  const result = {};
  for (const [key, value] of Object.entries(payload)) {
    if (/key|token|secret/i.test(key)) continue;
    if (Array.isArray(value)) result[key] = value.length > 10 ? [...value.slice(0, 10), `+${value.length - 10}`] : value;
    else if (value && typeof value === "object") result[key] = "[object]";
    else result[key] = value;
  }
  return result;
}

function summarizeOzonResponseHeaders(response) {
  const headers = {};
  for (const key of [
    "retry-after",
    "x-request-id",
    "x-o3-request-id",
    "x-trace-id",
    "x-ratelimit-limit",
    "x-ratelimit-remaining",
    "x-ratelimit-reset",
  ]) {
    const value = response.headers.get(key);
    if (value) headers[key] = value;
  }
  return headers;
}

function recordOzonApiRequest(event) {
  ozonRequestLog.push({
    id: createLocalId("ozon_req"),
    at: new Date().toISOString(),
    client_id: cleanIdentifier(event.client_id) || "default",
    path: event.path,
    scope: event.scope || getOzonThrottleScope(event.path),
    attempt: event.attempt || 1,
    status: event.status,
    duration_ms: event.duration_ms,
    payload: event.payload || {},
    response_headers: event.response_headers || {},
    response_text: event.response_text || null,
    error: event.error || null,
  });
  while (ozonRequestLog.length > 500) ozonRequestLog.shift();
}

function getRecentOzonRequests(clientId, options = {}) {
  const cleanClientId = cleanIdentifier(clientId);
  const now = Date.now();
  const windowMs = Number(options.windowMs || 120000);
  const limit = Math.max(1, Number(options.limit || 40));
  return ozonRequestLog
    .filter((item) => (!cleanClientId || item.client_id === cleanClientId))
    .filter((item) => now - new Date(item.at).getTime() <= windowMs)
    .slice(-limit)
    .reverse();
}

function getLastOzonRequestTime(clientId) {
  const cleanClientId = cleanIdentifier(clientId);
  const item = [...ozonRequestLog]
    .reverse()
    .find((entry) => !cleanClientId || entry.client_id === cleanClientId);
  return item ? new Date(item.at).getTime() : 0;
}

async function waitForOzonQuietPeriod(clientId, quietMs) {
  const ms = Math.max(0, Number(quietMs) || 0);
  if (!ms) return;
  const lastAt = getLastOzonRequestTime(clientId);
  if (!lastAt) return;
  const waitMs = Math.max(0, lastAt + ms - Date.now());
  if (waitMs > 0) await sleep(waitMs);
}

function getRetryDelayMs(response, attempt, baseDelayMs = 1000) {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1000;
  return Math.min(25000, baseDelayMs * Math.pow(2, attempt)) + Math.floor(Math.random() * 1000);
}

function getOzonRateLimitDelayMs(response, attempt, options = {}) {
  const baseDelay = getRetryDelayMs(response, attempt, options.base429DelayMs);
  const cooldown = Number(options.rateLimitCooldownMs || OZON_GLOBAL_RATE_LIMIT_COOLDOWN_MS);
  return Math.max(baseDelay, Number.isFinite(cooldown) ? cooldown : 0);
}

function getOzonThrottleScope(path) {
  const cleanPath = String(path || "").toLowerCase();
  if (cleanPath.includes("/draft/create") || cleanPath.includes("/draft/supply/create")) {
    return "draft-write";
  }
  if (cleanPath.includes("/draft/")) return "draft-read";
  if (cleanPath.includes("/analytics/")) return "analytics";
  if (cleanPath.includes("/product/")) return "product";
  if (cleanPath.includes("/cluster/") || cleanPath.includes("/warehouse/")) return "warehouse";
  return "default";
}

function isOzonRateLimitError(error) {
  return Number(error && error.status) === 429
    || /429|rate limit|too many requests|частот/i.test(String((error && error.message) || ""));
}

function getDraftCreateRetryDelayMs(attempt, error) {
  const retryAfterMs = Number(error && error.retryAfterMs);
  if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
    return Math.min(60000, Math.max(3000, retryAfterMs));
  }
  const delays = [3000, 7000, 12000, 20000, 30000];
  return delays[Math.max(0, Number(attempt || 1) - 1)] || 30000;
}

async function waitForGlobalOzonRequestTurn(clientId, scope, minDelayMs) {
  const cleanClientId = cleanIdentifier(clientId) || "default";
  const keys = [`${cleanClientId}:__all__`];
  const scopeKey = `${cleanClientId}:${scope || "default"}`;
  if (!keys.includes(scopeKey)) keys.push(scopeKey);
  const now = Date.now();
  const states = keys.map((key) => ({
    key,
    state: ozonThrottleStates.get(key) || { nextRequestAt: 0, rateLimitedUntil: 0 },
  }));
  const waitUntil = states.reduce(
    (max, item) => Math.max(max, item.state.nextRequestAt || 0, item.state.rateLimitedUntil || 0),
    0,
  );
  const waitMs = Math.max(0, waitUntil - now);
  const reservationStart = Math.max(now + waitMs, waitUntil);
  for (const item of states) {
    item.state.nextRequestAt = reservationStart + Math.max(0, Number(minDelayMs) || 0);
    ozonThrottleStates.set(item.key, item.state);
  }
  if (waitMs > 0) await sleep(waitMs);
}

function markGlobalOzonRateLimit(clientId, scope, delayMs) {
  const cleanClientId = cleanIdentifier(clientId) || "default";
  const keys = [`${cleanClientId}:__all__`];
  const scopeKey = `${cleanClientId}:${scope || "default"}`;
  if (!keys.includes(scopeKey)) keys.push(scopeKey);
  const until = Date.now() + Math.max(0, Number(delayMs) || OZON_GLOBAL_RATE_LIMIT_COOLDOWN_MS);
  for (const key of keys) {
    const state = ozonThrottleStates.get(key) || { nextRequestAt: 0, rateLimitedUntil: 0 };
    state.rateLimitedUntil = Math.max(state.rateLimitedUntil || 0, until);
    state.nextRequestAt = Math.max(state.nextRequestAt || 0, state.rateLimitedUntil);
    ozonThrottleStates.set(key, state);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
