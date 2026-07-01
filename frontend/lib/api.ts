// Общие утилиты для работы с API FBOly. Перенесено без изменений
// из прежнего монолитного frontend/app/page.tsx, чтобы сохранить
// поведение (в частности — сообщение об офлайн-бэкенде).

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (typeof window !== "undefined" &&
  window.location.hostname === "localhost" &&
  window.location.port === "3000"
    ? "http://localhost:8000"
    : "");

export function createBrowserId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function formatRequestError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return "Не удалось связаться с сервером FBOly. Проверьте подключение к интернету и повторите попытку.";
  }
  return message;
}

export function isOzonRateLimitMessage(message: string) {
  return /429|частот|частоту|rate limit|too many requests/i.test(message);
}
