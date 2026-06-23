# Как загрузить FBOly на GitHub

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

## Быстрый запуск после клонирования

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

