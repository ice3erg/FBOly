# FBOly: контекст проекта для переноса в Claude

Дата контекста: 2026-06-23  
Проект: `FBOly`  
Слоган: `Закрываем боли селлеров`  
Папка проекта на Windows: `C:\Users\princ\Documents\Codex\2026-05-12\mvp-ozon-fbo-excel-sku-ozon`

Этот файл нужен, чтобы другой ассистент или разработчик быстро понял проект и продолжил работу без чтения всей переписки.

Важно: не вставлять в этот файл реальные `Client-Id` и `Api-Key`. В проекте ключи вводятся пользователем в интерфейсе и сохраняются только локально в браузере в текущем MVP.

## 1. Что это за сервис

`FBOly` — веб-сервис для селлеров Ozon, который автоматизирует подготовку FBO-поставок:

1. Пользователь подключает один или несколько магазинов Ozon через Seller API.
2. Загружает Excel с товарами.
3. Сервис сопоставляет товары с карточками Ozon.
4. Считает распределение количества по кластерам Ozon.
5. Создаёт Excel-файлы в формате шаблона Ozon.
6. Основной сценарий: создаёт API-черновики поставки в Ozon.
7. Далее вкладка `Слоты` / `Охотник на слоты` должна искать слот по готовым черновикам и, если включено, автоматически бронировать поставку.

Идея продукта: сделать простой SaaS для селлеров, чтобы они не мучились с Excel, Ozon API, черновиками поставок и ловлей слотов.

## 2. Пользовательский сценарий

Идеальный сценарий интерфейса:

1. Пользователь заходит в сервис.
2. В разделе `Магазин` подключает магазин Ozon:
   - название магазина;
   - `Client-Id`;
   - `Api-Key`;
   - статус подключения;
   - кнопка `Проверить подключение`;
   - кнопка `Сделать активным`, если магазинов несколько.
3. В разделе `Поставка` выбирает активный магазин из выпадающего списка.
4. Загружает Excel:
   - колонки: `SKU Ozon`, `артикул`, `название товара`, `количество`;
   - если есть только `SKU Ozon` или название, сервис ищет артикул через Ozon API;
   - если в колонке `артикул` лежит offer_id, сервис должен использовать его как offer_id и не ломать сопоставление.
5. Сервис автоматически распределяет товары по кластерам.
6. Пользователь видит понятный результат:
   - сколько товаров найдено;
   - сколько ошибок;
   - сколько кластеров;
   - сколько штук;
   - объяснение человеческим текстом: `FBOly проверил товары, остатки, продажи и кластеры Ozon, затем распределил товары по направлениям`.
7. Пользователь может скачать ZIP/XLSX, но главный упор на кнопку `Создать черновики в Ozon`.
8. После создания черновиков должен быть понятный переход в `Слоты`.
9. Во вкладке `Слоты` пользователь выбирает режим:
   - просто уведомлять;
   - автоматически бронировать.
10. Для кроссдокинга пользователь выбирает точку отгрузки через поиск, похожий на интерфейс Ozon.

## 3. Бренд и дизайн

Название: `FBOly`.

Визуальный стиль:

- тёмная premium SaaS-тема;
- основной фон: `#07070A`, `#0F0F14`;
- карточки: `rgba(255,255,255,0.04)`;
- акценты: `#7C3AED`, `#8B5CF6`, `#A855F7`;
- текст: белый;
- вторичный текст: `#A1A1AA`;
- бордеры: `rgba(255,255,255,0.08)`;
- мягкое фиолетовое свечение у главных кнопок;
- без перегруженной “космической” админки.

Логотип:

- файл: `frontend/public/fboly-logo.png`;
- в шапке/сайдбаре использовать иконку без дублирования надписи внутри картинки;
- рядом текст `FBOly`, но если логотип уже содержит надпись, нужно использовать обрезанную иконку или отдельный icon-only asset.

Текущие пожелания пользователя по UX:

- вкладка `Новая поставка` должна называться просто `Поставка`;
- вкладка `Магазины` лучше в единственном числе: `Магазин`;
- подключение API должно быть именно в `Магазин`/профиле, не на экране поставки;
- выбор магазина в поставке — выпадающий список, а не отдельная большая кнопка в углу;
- убрать лишние технические ID из основного интерфейса;
- не показывать новичку `лимиты`, `интервалы`, `concurrency`, `rate limit` как настройки;
- все технические детали оставить в отладке/журнале, но основной UI должен говорить человечески.

## 4. Текущий стек

Frontend:

- Next.js 14;
- TypeScript;
- Tailwind CSS;
- локальные компоненты в стиле shadcn/ui;
- lucide-react для иконок;
- JSZip для сборки ZIP на фронте;
- основной файл интерфейса: `frontend/app/page.tsx`;
- стили: `frontend/app/globals.css`;
- layout/meta: `frontend/app/layout.tsx`.

Backend:

- сейчас фактически рабочий backend — portable Node.js сервер: `portable/server.js`;
- Python/FastAPI backend тоже есть в `backend/app/*`, но он ранний и не содержит всю текущую логику черновиков/слотов;
- для текущей разработки не путать: основная логика Ozon, черновиков, распределения и слотов в `portable/server.js`.

Старый FastAPI слой:

- `backend/app/main.py`;
- `backend/app/ozon_api_client.py`;
- `backend/app/excel_service.py`;
- `backend/app/models.py`;
- `backend/app/config.py`.

Его можно использовать как базу для будущего production backend, но текущий MVP живёт в `portable/server.js`.

## 5. Как запускать

Самый простой запуск на Windows:

```bat
start-web-service.bat
```

Он открывает два окна:

- API: `http://localhost:8000`;
- Frontend: `http://localhost:3000`.

Backend portable:

```bat
start-backend-portable.bat
```

Frontend:

```bat
start-frontend.bat
```

В PowerShell нельзя использовать `npm`, потому что часто блокируется `npm.ps1`. Использовать:

```powershell
npm.cmd install
npm.cmd run dev
```

Если запускать вручную:

```powershell
cd "C:\Users\princ\Documents\Codex\2026-05-12\mvp-ozon-fbo-excel-sku-ozon"
set PORT=8000
node .\portable\server.js
```

А во втором терминале:

```powershell
cd "C:\Users\princ\Documents\Codex\2026-05-12\mvp-ozon-fbo-excel-sku-ozon\frontend"
npm.cmd run dev
```

Важно:

- backend должен быть на `8000`;
- frontend должен быть на `3000`;
- если backend случайно запустить без `PORT=8000`, он займёт `3000` и сломает фронт;
- перед `next build` нужно остановить dev-сервер Next.js на `3000`, иначе на Windows может повредиться `.next`.

Проверка:

```text
http://localhost:8000/health
http://localhost:3000/
```

Текущая версия portable backend на момент последней правки:

```text
2026-05-19-crossdock-single-dropoff-slot
```

## 6. Основные файлы

Главные:

- `frontend/app/page.tsx` — почти весь frontend;
- `frontend/app/globals.css` — глобальный дизайн;
- `frontend/public/fboly-logo.png` — логотип;
- `portable/server.js` — рабочий backend;
- `start-web-service.bat` — запуск всего сервиса;
- `start-backend-portable.bat` — запуск backend на 8000;
- `start-frontend.bat` — запуск frontend;
- `backend/saas_schema.sql` — набросок будущей SaaS-схемы.

Документы:

- `README.md`;
- `WEB_SERVICE_GUIDE.md`;
- `USER_GUIDE.md`;
- `SLOT_BOOKING_AUTOMATION.md`;
- `SAAS_PLAN.md`.

Примечание: часть старых markdown-документов и строк в `portable/server.js` может выглядеть битой в терминале из-за кодировки. Новый контекстный файл написан нормальным UTF-8.

## 7. Frontend: состояние и структура

Главный файл: `frontend/app/page.tsx`.

Важные константы:

```ts
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const APP_NAME = "FBOly";
const AUTH_STORAGE_KEY = "ozon-fbo-service-user";
const STORES_STORAGE_KEY = "ozon-fbo-service-stores";
const ACTIVE_STORE_STORAGE_KEY = "ozon-fbo-service-active-store";
const HISTORY_STORAGE_KEY = "ozon-fbo-service-history";
```

Текущий frontend хранит beta-профиль и магазины в `localStorage`.

Важные View-компоненты:

- `OverviewView`;
- `SupplyView`;
- `ProfileView`;
- `OzonView`;
- `SlotHunterView`;
- `HistoryView`;
- `SettingsView`.

На практике сейчас нужно стремиться к такой навигации:

- `Поставка`;
- `Слоты`;
- `Магазин`;
- `История`.

Лишние разделы можно скрывать или объединять, но не ломать текущие обработчики.

## 8. Frontend endpoints, которые используются

Из `frontend/app/page.tsx`:

- `POST /api/ozon/check` — проверить подключение магазина;
- `POST /api/ozon/warehouses` — загрузить кластеры/склады Ozon;
- `GET /api/templates/input` — скачать входной шаблон Excel;
- `POST /api/process` — обработать Excel и получить распределение;
- `POST /api/ozon/draft-jobs` — создать API-черновики через background job;
- `GET /api/ozon/draft-jobs/{id}` — polling статуса создания черновиков;
- `POST /api/ozon/draft-jobs/{id}/stop` — остановить создание черновиков;
- `POST /api/ozon/fbo-warehouses/search` — поиск точки отгрузки для кроссдокинга;
- `POST /api/slot-hunter/jobs` — запустить охотника на слоты;
- `GET /api/slot-hunter/jobs/{id}` — polling охотника;
- `POST /api/slot-hunter/jobs/{id}/stop` — остановить охотника;
- `GET /api/ozon/request-log` — отладочный журнал последних запросов к Ozon.

## 9. Backend portable: основные API

Файл: `portable/server.js`.

Роуты:

- `GET /` — старый встроенный HTML интерфейс backend, сейчас не основной;
- `GET /health`;
- `GET /api/ozon/request-log`;
- `GET /api/templates/input`;
- `POST /api/ozon/check`;
- `POST /api/ozon/warehouses`;
- `POST /api/ozon/fbo-warehouses/search`;
- `POST /api/ozon/drafts`;
- `POST /api/ozon/draft-jobs`;
- `GET /api/ozon/draft-jobs/{job_id}`;
- `POST /api/ozon/draft-jobs/{job_id}/stop`;
- `POST /api/slot-hunter/jobs`;
- `GET /api/slot-hunter/jobs/{job_id}`;
- `POST /api/slot-hunter/jobs/{job_id}/stop`;
- `POST /api/process`.

В backend есть:

- `draftCreationJobs` — Map для фонового создания черновиков;
- `slotHunterJobs` — Map для охотника на слоты;
- `ozonThrottleStates` — общий throttle по Ozon API;
- `ozonRequestLog` — последние запросы к Ozon для диагностики.

## 10. Ozon API, который используется

Для товаров:

- `/v3/product/info/list`;
- `/v3/product/list`;
- запасные варианты старых product endpoints частично сохранены.

Для складов/кластеров:

- `/v1/cluster/list`;
- `/v1/warehouse/fbo/list` для поиска точек отгрузки кроссдокинга.

Для аналитики:

- `/v1/analytics/turnover/stocks`;
- `/v2/analytics/stock_on_warehouses`;
- `/v1/analytics/data`.

Для черновиков:

- direct/self delivery:
  - `/v1/draft/create` classic flow;
  - `/v1/draft/direct/create` modern flow;
  - `/v1/draft/create/info` или `/v2/draft/create/info`;
- crossdock:
  - `/v1/draft/create` classic flow with `CREATE_TYPE_CROSSDOCK`;
  - `/v1/draft/crossdock/create` modern flow.

Для слотов/создания поставки:

- `/v1/draft/timeslot/info`;
- `/v2/draft/timeslot/info`;
- `/v1/draft/supply/create`;
- `/v2/draft/supply/create`;
- `/v1/draft/supply/create/status`;
- `/v2/draft/supply/create/status`.

Важно: Ozon FBO Supply API менялся в 2026 году, поэтому часть методов ведёт себя нестабильно. В текущем MVP приходилось подбирать payload по реальным ошибкам Ozon.

## 11. Ozon API роли

Для чтения товаров/аналитики:

- `Product read-only`;
- `Warehouse`;
- `Report`;
- `Supply order ReadOnly` иногда полезен.

Для создания черновиков и бронирования:

- `Supply order`;
- или `Admin`.

Пользователь давал `Admin read only`, но для создания черновиков этого недостаточно. Для записи нужна роль `Supply order` или `Admin`.

## 12. Excel: вход и выход

Входной Excel:

Поддерживаемые смысловые колонки:

- `SKU Ozon`;
- `артикул`;
- `название товара`;
- `количество`.

Нужно учитывать разные названия колонок:

- SKU: `SKU Ozon`, `Ozon SKU`, `SKU`, `Ozon ID`;
- артикул: `артикул`, `offer_id`, `offer id`, `vendor code`;
- название: `название`, `название товара`, `имя`, `name`, `product name`;
- количество: `количество`, `кол-во`, `qty`, `quantity`.

Важный кейс пользователя:

- у него SKU/offer_id часто лежит в колонке `артикул`;
- сервис должен корректно искать товар по offer_id и не возвращать странные артикулы с точкой;
- если строка уже содержит offer_id, не нужно обязательно искать SKU.

Выходной Excel для Ozon строго:

```text
артикул
имя (необязательно)
количество
```

Именно такие колонки, именно в таком порядке.

## 13. Распределение по кластерам

Исходная задача:

- распределять количество по процентам складов;
- округлять вниз;
- остаток отдавать складам с самым большим процентом;
- итог по всем складам всегда должен совпадать с исходным количеством.

Текущая бизнес-логика расширена:

- сервис должен распределять не по техническим складам, а по кластерам Ozon;
- технические хабы типа `ветаптека`, отдельные сортировочные точки, блоки и т.п. не должны превращаться в отдельные направления поставки;
- для продававшихся товаров учитывать аналитику продаж/остатков/оборачиваемости;
- где товар больше продаётся и требуется, туда больше;
- где меньше требуется, туда меньше;
- где не требуется, скип;
- новые товары без статистики отправлять в крупные кластеры;
- не делать файлы/поставки по 1-2 штуки;
- минимальный порог на выходной кластер сейчас задан через `MIN_OUTPUT_CLUSTER_QUANTITY`, по умолчанию `15`.

Пользователь отдельно уточнял актуальные кластеры из кабинета Ozon:

- `Москва, МО и Дальние регионы`;
- `Санкт-Петербург и СЗО`;
- `Казань`;
- `Ростов`;
- `Екатеринбург`;
- `Пермь`;
- `Оренбург`;
- `Самара`;
- `Воронеж`;
- `Новосибирск`;
- `Краснодар`;
- `Уфа`;
- `Омск`;
- `Дальний Восток`;
- `Тюмень`;
- `Красноярск`;
- `Саратов`;
- `Калининград`;
- `Беларусь`;
- `Астана`;
- `Алматы`;
- `Махачкала`;
- `Невинномысск`;
- и др.

Важно: нельзя “приклеивать” Самару и Уфу к Казани. Это отдельные кластеры, если Ozon так отдаёт их в кабинете.

Нижний Новгород по состоянию разговора мог попадать в другой кластер, но нельзя жёстко зашивать это без данных Ozon. Нужно использовать `/v1/cluster/list` и реальные cluster IDs.

## 14. Создание API-черновиков

В интерфейсе блок называется `API-черновики Ozon`.

Пользователь выбирает города/кластеры и нажимает `Создать API-черновики`.

Текущая логика:

- frontend отправляет выбранные `DraftCandidate[]` в `POST /api/ozon/draft-jobs`;
- backend создаёт job и последовательно создаёт черновики;
- frontend poll-ит `GET /api/ozon/draft-jobs/{id}`;
- успешный результат содержит `draft_id`;
- `draft_id` не всегда сразу виден отдельной строкой в личном кабинете Ozon, но может использоваться для поиска слота.

Была большая боль:

- Ozon часто возвращал `429 You have reached request rate limit per second`;
- часть этих 429 была настоящей частотной защитой;
- часть выглядела как 429, но на практике была следствием неправильного payload или неправильного flow.

Ключевой рабочий успех:

- direct/self delivery черновик начал создаваться;
- слот был найден;
- заявка/слот отправлены в Ozon;
- пример успешного ответа: `{"error_reasons":[],"draft_id":...}`.

## 15. Direct vs Crossdock

Пользователь хочет оба режима:

1. Самостоятельная поставка/direct.
2. Кроссдокинг/crossdock.

В интерфейсе на создании черновика нужен выбор:

- `Самостоятельно`;
- `Кроссдокинг`.

Если выбран кроссдокинг:

- нужно выбрать точку отгрузки;
- поиск через `/v1/warehouse/fbo/list`;
- payload должен включать supply type `CREATE_TYPE_CROSSDOCK`;
- выбранная точка должна иметь:
  - `warehouse_id`;
  - `warehouse_type`.

Пример выбранной пользователем точки:

```text
СПБ_КОЛПИНО_РФЦ_КРОССДОКИНГ
ID: 1020001649204000
WAREHOUSE_TYPE_SORTING_CENTER
```

Пользователь хочет поиск точки как в Ozon: поле с подсказками, адресом, ID и типом склада.

## 16. Ключевая проблема с кроссдокингом и слотами

Direct работал, но кроссдокинг при поиске слота давал ошибки.

Типичные ошибки, которые уже встречались:

```text
Requested wrong delivery flow. Draft ... is CrossDock
```

```text
when supply type is 'DIRECT', only one item in selected_cluster_warehouse allowed
```

```text
not allowed parameter warehouse_id for specified supply type
```

```text
invalid from_in_timezone: parsing time "...Z": extra text: "Z"
```

```text
invalid DraftTimeslotInfoRequest.DateFrom
```

```text
Draft ... can't find warehouse scoring result ...
```

```text
You have reached request rate limit per second
```

Последнее важное расследование:

- для crossdock в `/v1/draft/timeslot/info` backend отправлял не только выбранную точку кроссдока, а массив из множества `warehouse_ids` кластера;
- пример неправильного payload:

```json
{
  "draft_id": "DRAFT_ID",
  "date_from": "2026-05-19T00:00:00Z",
  "date_to": "2026-06-02T23:59:59Z",
  "warehouse_ids": [
    "1020001649204000",
    "1020005008983880",
    "20547966415000",
    "..."
  ]
}
```

Для кроссдокинга это неверно: нужно использовать только выбранную точку отгрузки, например:

```json
{
  "draft_id": "DRAFT_ID",
  "date_from": "2026-05-19T00:00:00Z",
  "date_to": "2026-06-02T23:59:59Z",
  "warehouse_ids": ["1020001649204000"]
}
```

В `portable/server.js` была внесена правка:

```js
function getCrossdockTimeslotWarehouseIds(candidate = {}) {
  return normalizePositiveOzonIds([
    getDropOffPointWarehouseId(candidate),
    candidate.drop_off_warehouse_id,
    candidate.dropOffWarehouseId,
    candidate.shipping_point,
    candidate.shippingPoint,
  ]).slice(0, 1);
}
```

Версия после этой правки:

```js
const APP_VERSION = "2026-05-19-crossdock-single-dropoff-slot";
```

После такой правки нужно перезапустить backend, иначе старая логика останется в памяти.

## 17. Что нужно доделать по слотам

Пользователь очень не хочет видеть в UI технические лимиты/интервалы.

Нужно переделать вкладку `Слоты`:

Убрать или спрятать из основного UI:

- `Интервал`;
- `Параллельно`;
- `Умная частота`;
- `лимит Ozon`;
- `rate limit`;
- технические паузы.

Оставить внутри backend аккуратные задержки и throttle, но пользователю показывать человеческие статусы:

- `Готовим черновик`;
- `Ищем окно`;
- `Ozon пока не принял запрос, повторим автоматически`;
- `Слот найден`;
- `Бронируем слот`;
- `Заявка создана`;
- `Нужно действие в Ozon`;
- `Ошибка Ozon`.

В журнале для разработчика можно оставлять HTTP 429 и payload, но не делать это главным текстом для новичка.

Текущие места в frontend:

- `SlotHunterView` в `frontend/app/page.tsx`, примерно с `function SlotHunterView`;
- строки, где есть тексты `Умная частота`, `Интервал`, `лимит до`, `лимит Ozon`, `пауза`;
- статус-маппинг около `rate_limited` / `cooldown`.

Текущие места в backend:

- `attemptSlotHunterTarget`;
- `pauseSlotHunterForRateLimit`;
- `buildOzonApiErrorMessage`;
- константы:
  - `SLOT_HUNTER_DEFAULT_INTERVAL_SECONDS`;
  - `SLOT_HUNTER_MIN_INTERVAL_SECONDS`;
  - `OZON_SLOT_RATE_LIMIT_COOLDOWN_MS`;
  - `OZON_BOOKING_RATE_LIMIT_COOLDOWN_MS`;
  - `OZON_AFTER_DRAFT_SLOT_DELAY_MS`;
  - `OZON_BEFORE_BOOKING_DELAY_MS`.

Важно: не убирать полностью backend throttle, иначе можно реально заблокироваться у Ozon. Нужно убрать технические настройки из UI, а не безопасность.

## 18. Известные реальные ошибки и как их понимать

`fetch failed` при сопоставлении товаров:

- backend не может достучаться до `https://api-seller.ozon.ru`;
- причины: интернет, DNS, VPN/прокси, антивирус, sandbox, backend запущен не там;
- проверка: `POST /api/ozon/check` должен вернуть ошибку Ozon, а не `fetch failed`.

`Client-Id header value should be positive integer`:

- это хорошо для диагностики, значит до Ozon дошли, но `Client-Id` неверный.

`obsolete method cannot be used`:

- старый метод Ozon больше нельзя использовать;
- было с `/v1/warehouse/list`;
- для FBO кластеров используем `/v1/cluster/list`, для точек FBO `/v1/warehouse/fbo/list`.

`value must contain at least 1 item(s)` на `/v1/warehouse/fbo/list`:

- в payload нужен `filter_by_supply_type`, например `["CREATE_TYPE_CROSSDOCK"]`.

`DeletionSkuMode value must not be in list [0]`:

- для draft create нужно передавать валидный deletion mode, не `0`.

`DeliveryInfo.Type value must not be in list [0]`:

- для crossdock modern endpoint нужен заполненный `delivery_info.type`.

`drop_off_warehouse is required for delivery_info.type = DROPOFF`:

- для crossdock нужен `delivery_info.drop_off_warehouse`.

`WarehouseType value must not be in list [0]`:

- у drop-off warehouse должен быть `warehouse_type`, например `WAREHOUSE_TYPE_SORTING_CENTER`.

`Requested wrong delivery flow. Draft ... is CrossDock`:

- для crossdock используется не тот endpoint/payload поиска слотов, direct-flow не подходит.

`429 You have reached request rate limit per second`:

- иногда реальный лимит;
- иногда Ozon возвращает это на цепочке ошибок/неправильного flow;
- всегда нужно смотреть `GET /api/ozon/request-log` и payload последнего запроса.

## 19. Диагностика Ozon запросов

Backend сохраняет последние реальные запросы к Ozon.

Endpoint:

```text
GET http://localhost:8000/api/ozon/request-log?seconds=600
```

Что смотреть:

- `path`;
- `status`;
- `payload`;
- `response_text`;
- время запроса.

Этот endpoint помог найти, что кроссдокинг отправлял много `warehouse_ids` вместо одной точки.

Не показывать этот журнал обычному пользователю как основной интерфейс. Это инструмент отладки.

## 20. SaaS и монетизация

Текущий MVP без настоящей серверной регистрации и оплаты.

Пользователь хочет сначала сделать красивый полноценный сервис, оплату потом.

Будущая модель:

- 1 пробная попытка / 1 бесплатная поставка;
- дальше подписка;
- ориентир цены: около 2 000 ₽/мес для небольшого селлера;
- можно рассмотреть тарифы:
  - `Старт`: 1 магазин, ограничение по поставкам;
  - `Рост`: несколько магазинов, больше поставок, охотник на слоты;
  - `Профи`: много магазинов, история, авто-бронь, приоритетный поиск;
  - опционально тариф от оборота, но лучше начинать с простой подписки.

Production SaaS, который нужен позже:

- PostgreSQL;
- нормальная регистрация/логин;
- hashed passwords;
- JWT или secure cookies;
- шифрование Ozon Api-Key на backend;
- хранение магазинов на backend;
- история обработок;
- хранение ZIP/XLSX или object storage;
- Redis + worker для фоновых задач;
- платежи:
  - ЮKassa / CloudPayments / Robokassa для РФ;
  - таблица subscriptions;
  - trial usage limits;
  - webhook оплаты.

В `backend/saas_schema.sql` уже есть заготовка схемы.

## 21. Важные пожелания пользователя

Не ломать существующую рабочую логику.

Не переписывать всё с нуля.

Сначала понять текущие компоненты и бизнес-логику, затем аккуратно улучшать.

Тексты должны быть человеческими:

- не `API credential validation`, а `Проверить подключение`;
- не `processing result`, а `Результат обработки`;
- не `cluster allocation`, а `Распределение по кластерам`.

Интерфейс должен быть понятен новичку:

- где выбран магазин;
- куда загрузить Excel;
- что произошло после обработки;
- какие кластеры выбраны;
- что будет отправлено в Ozon;
- где перейти к поиску слота.

Пользователь эмоционально реагирует, если:

- вместо реальной причины показывается “лимит Ozon”;
- сервис долго ждёт без понятного прогресса;
- появляется технический мусор;
- меняется рабочая логика direct при исправлении crossdock;
- экран входа блокирует доступ к приложению.

## 22. Последнее состояние перед созданием этого файла

Direct/self delivery:

- работал заметно стабильнее;
- черновик создавался;
- слот находился;
- заявка создавалась.

Crossdock:

- черновик начал создаваться при правильной точке отгрузки;
- поиск слота давал 429/ошибки;
- найдено, что backend отправлял много `warehouse_ids` вместо одной выбранной точки crossdock;
- правка функции `getCrossdockTimeslotWarehouseIds` уже внесена в `portable/server.js`;
- обязательно перезапустить backend, чтобы правка вступила в силу.

UI:

- бренд FBOly внедрён;
- логотип добавлен;
- есть тёмный premium UI;
- но пользователь считает, что UX ещё надо упростить:
  - убрать дубли логотипа;
  - убрать магазин из нижнего угла, где он появляется только после скролла;
  - сделать выбор магазина в поставке выпадающим списком;
  - переименовать `Магазины` в `Магин`/`Магазин`;
  - убрать технические ID/лимиты/интервалы из основного UI.

## 23. Как безопасно продолжать разработку

Перед правками:

```powershell
cd "C:\Users\princ\Documents\Codex\2026-05-12\mvp-ozon-fbo-excel-sku-ozon"
```

Проверка backend синтаксиса:

```powershell
node --check .\portable\server.js
```

Проверка frontend:

```powershell
cd frontend
npm.cmd run build
```

Важно для Windows:

- перед `npm.cmd run build` остановить `next dev` на 3000;
- если `.next` сломался, остановить frontend, удалить `frontend\.next`, перезапустить.

Нельзя:

- хранить реальные Ozon ключи в репозитории;
- отдавать пользователю технические логи вместо понятного объяснения;
- удалять рабочие функции direct при фиксе crossdock;
- жёстко зашивать кластеры вместо данных Ozon;
- создавать поставки по техническим складам вместо кластеров.

## 24. Что Claude должен сделать первым, если продолжает проект

Приоритет 1:

1. Перезапустить backend и убедиться, что `/health` показывает версию `2026-05-19-crossdock-single-dropoff-slot`.
2. Проверить crossdock slot payload через `/api/ozon/request-log`: там должен быть один `warehouse_id`, выбранная точка отгрузки.
3. Если crossdock всё ещё падает, смотреть не текст UI, а реальный payload/response Ozon.

Приоритет 2:

1. Упростить `SlotHunterView`:
   - убрать `Интервал`, `Параллельно`, `Умная частота`;
   - скрыть `лимит Ozon` из основного UI;
   - оставить режим `Только уведомлять` / `Автоматически бронировать`;
   - оставить выбор периода и список черновиков.
2. В backend заменить пользовательские сообщения про `лимит` на нейтральные:
   - `Ozon пока не принял запрос, повторим автоматически`;
   - `Ждём ответ Ozon`;
   - `Повторим автоматически`.

Приоритет 3:

1. Навести UX:
   - `Поставка`;
   - `Слоты`;
   - `Магазин`;
   - `История`;
   - активный магазин в верхней панели;
   - выбор магазина в `Поставка` через dropdown.
2. Убрать дублирование логотипа.

Приоритет 4:

1. Подготовить production SaaS backend:
   - PostgreSQL;
   - users;
   - stores;
   - encrypted Ozon keys;
   - subscription/trial;
   - background worker for slot hunting.

## 25. Короткий prompt для Claude

Можно передать Claude такой prompt вместе с этим файлом:

```text
Ты продолжаешь проект FBOly. Прочитай PROJECT_CONTEXT_FOR_CLAUDE.md полностью.
Не переписывай проект с нуля и не ломай рабочую логику.
Главный рабочий backend сейчас portable/server.js, frontend в frontend/app/page.tsx.
Сначала исправь crossdock slot hunting: проверь, что для crossdock /draft/timeslot/info отправляется только выбранный drop-off warehouse_id, а не все warehouse_ids кластера.
Потом упрости UI вкладки Слоты: убери интервалы, лимиты, concurrency и технические статусы из основного интерфейса. Пользователь должен видеть понятный процесс: черновик готов, ищем окно, слот найден, бронируем, заявка создана.
Сохрани direct/self delivery, потому что он уже работает.
После правок проверь node --check portable/server.js и npm.cmd run build во frontend.
```

