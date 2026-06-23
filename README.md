# Ozon FBO Excel MVP

Веб-сервис для подготовки Excel-файлов поставок Ozon FBO.

Пользователь открывает страницу, вводит `Client-Id` и `Api-Key` Ozon Seller, загружает Excel с товарами и получает готовые XLSX-файлы по складам.

## Быстрый запуск для пользователя без Docker

Если Docker Desktop не запускается, используйте portable-режим.

1. Откройте папку проекта.
2. Запустите:

```text
start-portable.bat
```

3. Не закрывайте открывшееся окно сервера.
4. Откройте приложение:

```text
http://localhost:3000
```

5. Введите `Client-Id` и `Api-Key` в интерфейсе.
6. Нажмите `Проверить подключение`.
7. Загрузите Excel и нажмите `Создать файлы`.

Portable-режим не требует Docker, Python, npm и установки зависимостей. Для него нужен только Node.js. Если Node.js не найден, скрипт напишет ссылку на установку Node.js LTS.

Остановка portable-режима:

```text
stop-portable.bat
```

## Запуск через Docker

Docker-режим оставлен как опциональный.

1. Установите Docker Desktop:

```text
https://www.docker.com/products/docker-desktop/
```

2. Запустите Docker Desktop и дождитесь, пока он будет готов.
3. Запустите:

```text
start-service.bat
```

Остановка Docker-режима:

```text
stop-service.bat
```

Подробная инструкция для пользователя: [USER_GUIDE.md](USER_GUIDE.md).

План превращения MVP в полноценный веб-сервис: [WEB_SERVICE_GUIDE.md](WEB_SERVICE_GUIDE.md).

Спецификация модуля автоматического поиска FBO-слотов: [SLOT_BOOKING_AUTOMATION.md](SLOT_BOOKING_AUTOMATION.md).

Тестовый входной Excel: [examples/test_products.xlsx](examples/test_products.xlsx).

## Что умеет сервис

- читает `.xlsx` и `.xls`;
- принимает Excel с колонками SKU Ozon, артикул, название товара, количество;
- ищет артикул через Ozon Seller API, если в файле есть SKU или название;
- получает список FBO-складов/кластеров из Ozon через `/v1/cluster/list`;
- объединяет технические склады и хабы Ozon в городские кластеры;
- распределяет количество по складам автоматически по продажам, оборачиваемости и остаткам Ozon;
- пропускает склады без потребности и не создаёт пустые файлы;
- для новых товаров без аналитики распределяет по крупным складам: Москва, Санкт-Петербург, Казань, Ростов, Екатеринбург, Воронеж;
- использует проценты складов как запасной вариант, если аналитика Ozon недоступна;
- округляет вниз и отдаёт остаток складам с самым большим процентом;
- создаёт отдельный Excel-файл на каждый склад;
- содержит вкладку `Охотник на слоты` для фонового поиска и попытки бронирования FBO-слотов по рассчитанным городам;
- показывает ошибки по товарам, которые не удалось найти;
- собирает все XLSX в ZIP через JSZip.

## Выходные файлы

Сервис создаёт:

- `Ozon_FBO_Москва_Хоругвино.xlsx`
- `Ozon_FBO_Санкт-Петербург.xlsx`
- `Ozon_FBO_Казань.xlsx`

В каждом файле строго 3 колонки в таком порядке:

```text
артикул
имя (необязательно)
количество
```

## Docker запуск из терминала

```bash
docker compose up --build
```

Frontend:

```text
http://localhost:3000
```

Backend API:

```text
http://localhost:8000
```

Фоновый запуск:

```bash
docker compose up --build -d
```

Остановка:

```bash
docker compose down
```

## Ручной запуск backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Для PowerShell:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Ручной запуск frontend

```bash
cd frontend
npm.cmd install
npm.cmd run dev
```

На Windows можно запустить одной командой из корня проекта:

```text
start-web-service.bat
```

## Переменные окружения

Для обычного запуска переменные Ozon не нужны: пользователь вводит ключи в веб-интерфейсе.

Рекомендуемая роль Ozon API ключа:

```text
Admin read only
```

Минимальный набор ролей: `Product read-only`, `Warehouse`, `Report`, `Supply order ReadOnly`.

Опционально можно задать ключи на уровне backend. Для этого создайте `backend/.env`:

```env
OZON_CLIENT_ID=
OZON_API_KEY=
OZON_API_BASE_URL=https://api-seller.ozon.ru
ALLOWED_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000"]
```

И добавьте в сервис `backend` в `docker-compose.yml`:

```yaml
env_file:
  - ./backend/.env
```

Для frontend при ручном запуске:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Поддерживаемые входные колонки

- SKU: `SKU Ozon`, `Ozon SKU`, `SKU`, `Ozon ID`
- артикул: `артикул`, `offer_id`, `offer id`, `vendor code`
- название: `название`, `название товара`, `имя`, `name`, `product name`
- количество: `количество`, `кол-во`, `qty`, `quantity`

Если в строке уже есть `артикул`, API не нужен. Если есть только SKU или название, backend использует Ozon API ключи из интерфейса.

## Структура

```text
backend/
  app/
    main.py
    ozon_api_client.py
    excel_service.py
    models.py
    config.py
frontend/
  app/
  components/ui/
  lib/
```

## Ozon API module

`backend/app/ozon_api_client.py` реализует:

- авторизацию через заголовки `Client-Id` и `Api-Key`;
- получение списка товаров: `POST /v3/product/list`;
- получение информации по offer_id / SKU / product_id: `POST /v3/product/info/list` с fallback на `POST /v2/product/info/list`;
- поиск товара по offer_id, SKU или названию;
- получение остатков: `POST /v4/product/info/stocks`;
- получение складов: `POST /v1/warehouse/list`;
- подготовку draft-структуры для будущего создания поставок.
