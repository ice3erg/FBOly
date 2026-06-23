# Как загрузить FBOly на GitHub и запустить на одном Render-хостинге

Эта папка уже очищена для загрузки в GitHub.

Загружать нужно содержимое папки:

```text
github-upload/FBOly
```

Не загружать исходную рабочую папку целиком, потому что в ней есть `node_modules`, `.next`, логи и локальные временные файлы.

## Что уже исключено

- `frontend/node_modules`
- `frontend/.next`
- `logs`
- `.logs`
- `*.log`
- реальные `.env`
- `backend/.env.txt`
- архивы `*.zip`
- Python cache и виртуальные окружения

## Что можно загрузить

- `frontend` — Next.js интерфейс
- `portable/server.js` — текущий рабочий backend
- `backend` — ранний FastAPI backend и будущая SaaS-база
- `tools`
- `examples`
- стартовые `.bat`/`.ps1` скрипты
- документацию
- `PROJECT_CONTEXT_FOR_CLAUDE.md`

## Бесплатный запуск как один сайт

Основной вариант теперь такой:

```text
GitHub repo -> Render Web Service -> один URL
```

На одном Render-сервисе будут работать:

- сайт;
- backend API `/api/...`;
- `/health`.

В корне уже есть:

```text
package.json
render.yaml
```

На Render выбирайте:

```text
Runtime: Node
Build Command: npm run build
Start Command: npm start
Plan: Free
```

Подробная инструкция: `RENDER_ONE_HOST_DEPLOY.md`.

## Быстрый локальный запуск после клонирования

На Windows:

```bat
start-web-service.bat
```

Или вручную:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Backend:

```powershell
set PORT=8000
node .\portable\server.js
```

Адреса:

```text
Frontend: http://localhost:3000
Backend:  http://localhost:8000
```

## Важно

Не коммитить реальные ключи Ozon, платежек, `.env` и логи.
