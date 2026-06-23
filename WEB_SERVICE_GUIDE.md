# FBOly: веб-сервис без платежей

Это версия продукта до монетизации: красивый веб-кабинет, регистрация/вход в beta-режиме, подключение Ozon API, загрузка Excel, история обработок и подготовка к серверной авторизации.

## Что уже сделано

- Новый интерфейс `FBOly` на Next.js.
- Первый экран с регистрацией и входом.
- Рабочий кабинет:
  - обзор;
  - новая поставка;
  - история;
  - охотник на слоты;
  - Ozon API;
  - настройки.
- Сохранение beta-профиля в браузере.
- Сохранение Ozon API в браузере.
- Загрузка Excel в существующий FastAPI backend.
- Скачивание ZIP/XLSX.
- Backend больше не требует, чтобы сумма процентов складов была ровно 100: веса нормализуются автоматически.
- Добавлена продуктовая спецификация модуля автопоиска FBO-слотов: `SLOT_BOOKING_AUTOMATION.md`.
- Добавлена вкладка `Охотник на слоты` с запуском, остановкой и журналом попыток.

## Что ещё не production

Регистрация сейчас работает как beta-кабинет в браузере. Для публичного сервиса следующим шагом нужно подключить:

- PostgreSQL;
- реальные пароли через hash;
- JWT или cookie-сессии;
- зашифрованное хранение Ozon Api-Key на backend;
- историю обработок в базе;
- фоновые задачи поиска слотов;
- файловое хранилище для ZIP/XLSX.

Схема базы уже подготовлена в `backend/saas_schema.sql`.

## Запуск frontend

Нужен обычный Node.js LTS с `npm`.

Самый простой запуск на Windows:

```powershell
cd "C:\Users\princ\Documents\Codex\2026-05-12\mvp-ozon-fbo-excel-sku-ozon"
.\start-web-service.bat
```

Скрипт откроет два окна:

- `FBOly API` на `http://localhost:8000`;
- `FBOly Frontend` на `http://localhost:3000`.

Оба окна нужно держать открытыми.

Если запускаете вручную из PowerShell и видите ошибку `npm.ps1 ... выполнение сценариев отключено`, используйте `npm.cmd`:

```powershell
cd "C:\Users\princ\Documents\Codex\2026-05-12\mvp-ozon-fbo-excel-sku-ozon\frontend"
npm.cmd install
npm.cmd run dev
```

Frontend откроется:

```text
http://localhost:3000
```

## Запуск backend

Нужен Python 3.11+.

```powershell
cd "C:\Users\princ\Documents\Codex\2026-05-12\mvp-ozon-fbo-excel-sku-ozon\backend"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend будет доступен:

```text
http://localhost:8000
```

## Следующий шаг

Следующая разработка должна быть не про оплату, а про настоящий SaaS-фундамент:

1. PostgreSQL в `docker-compose.yml`.
2. Alembic/SQLAlchemy модели.
3. `/auth/register`, `/auth/login`, `/auth/me`.
4. `/ozon-accounts` для сохранения Ozon-ключей.
5. Привязка `/api/process` к авторизованной организации.
6. `/slot-booking` endpoints и worker для поиска/бронирования слотов через официальный Ozon API.
