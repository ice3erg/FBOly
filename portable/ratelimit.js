"use strict";

// Лёгкий in-memory rate limiter со скользящим окном. Без Redis/внешних
// зависимостей — этого достаточно для одного инстанса на Render (free
// plan = 1 процесс). Если сервис масштабируется на несколько инстансов,
// лимит станет per-instance — тогда стоит вынести счётчики в Redis, но
// это отдельная задача и для текущего масштаба избыточно.
//
// Назначение — притормозить брутфорс паролей, перебор email при
// регистрации и спам платежами. Не заменяет CAPTCHA/2FA, но закрывает
// самый дешёвый вектор автоматического перебора.

const buckets = new Map();

// Периодически чистим протухшие бакеты, чтобы Map не рос бесконечно от
// одноразовых IP. Раз в 10 минут — дёшево.
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
}, CLEANUP_INTERVAL_MS).unref();

/**
 * @param {string} key   — уникальный ключ (например `login:1.2.3.4`)
 * @param {number} limit — сколько запросов разрешено за окно
 * @param {number} windowMs — длина окна в мс
 * @returns {{ allowed: boolean, retryAfterSec: number }}
 */
function check(key, limit, windowMs) {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (entry.count < limit) {
    entry.count += 1;
    return { allowed: true, retryAfterSec: 0 };
  }
  return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
}

// Достаём client IP с учётом обратного прокси Render (X-Forwarded-For).
// Берём ПЕРВЫЙ адрес из списка — он ближе всего к реальному клиенту;
// дальнейшие значения клиент может подделать, но первый проставляет
// доверенный прокси Render. Фоллбэк — адрес сокета.
function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length) {
    return forwarded.split(",")[0].trim();
  }
  return (req.socket && req.socket.remoteAddress) || "unknown";
}

module.exports = { check, clientIp };
