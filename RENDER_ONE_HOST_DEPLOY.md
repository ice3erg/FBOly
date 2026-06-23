# Деплой FBOly на один Render Web Service

Этот вариант запускает всё на одном домене:

```text
https://fboly.onrender.com
```

На этом же домене будет:

- сайт FBOly;
- backend API `/api/...`;
- healthcheck `/health`.

## Что уже настроено

В корне проекта есть:

- `package.json`
- `render.yaml`

Render будет выполнять:

```bash
npm run build
npm start
```

`npm run build`:

1. ставит зависимости frontend;
2. собирает Next.js в `frontend/out`;
3. backend `portable/server.js` потом раздаёт эту папку как сайт.

## Как запустить на Render

1. Залей содержимое папки `github-upload/FBOly` в GitHub.
2. Зайди на Render.
3. New → Web Service.
4. Подключи GitHub-репозиторий.
5. Если Render увидел `render.yaml`, просто подтверди создание сервиса.
6. Если настраиваешь вручную:

```text
Runtime: Node
Build Command: npm run build
Start Command: npm start
Plan: Free
```

7. После деплоя открой:

```text
https://ТВОЙ-СЕРВИС.onrender.com
```

8. Проверь backend:

```text
https://ТВОЙ-СЕРВИС.onrender.com/health
```

## Важно

В этом режиме `NEXT_PUBLIC_API_URL` не нужен. Frontend ходит в `/api` на том же домене.

Для локальной разработки старый режим тоже работает:

- frontend: `http://localhost:3000`
- backend: `http://localhost:8000`

Если открыть собранный сайт через backend на `http://localhost:8000`, он тоже будет ходить в `/api` на том же хосте.

