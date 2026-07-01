"use strict";

// Пароли и сессии — сознательно без jsonwebtoken/bcrypt как зависимостей:
// node:crypto уже даёт всё нужное (scrypt для паролей, HMAC для подписи
// токенов), а держать сессии как непрозрачный токен + хеш в БД проще
// отзывать (logout, компрометация), чем самодостаточный JWT.
const crypto = require("node:crypto");
const db = require("./db");

const SESSION_SECRET = process.env.SESSION_SECRET || "";
const SESSION_COOKIE_NAME = "fboly_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 дней

if (!SESSION_SECRET) {
  console.warn(
    "[auth] SESSION_SECRET is not set — using an insecure fallback signing key. " +
      "Set SESSION_SECRET in production (Render → Environment) or sessions won't be trustworthy across deploys.",
  );
}
const EFFECTIVE_SECRET = SESSION_SECRET || "insecure-dev-fallback-secret-change-me";

// ── Пароли ──────────────────────────────────────────────────────────────
// Верхняя граница длины пароля: scrypt по стоимости растёт с длиной входа,
// поэтому без лимита гигантский пароль (например, 10 МБ) — это дешёвый DoS
// (один запрос надолго занимает event loop). 1024 символа с запасом хватает
// любому реальному паролю/парольной фразе.
const MAX_PASSWORD_LENGTH = 1024;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password, stored) {
  const [salt, derivedHex] = String(stored || "").split(":");
  if (!salt || !derivedHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(derivedHex, "hex");
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

// ── Сессии ──────────────────────────────────────────────────────────────
function signToken(token) {
  return crypto.createHmac("sha256", EFFECTIVE_SECRET).update(token).digest("hex");
}

// Сравнение подписи в постоянном времени — обычное `a !== b` для HMAC
// теоретически даёт timing-side-channel на подбор валидной подписи.
function verifyTokenSignature(token, signature) {
  const expected = signToken(token);
  const a = Buffer.from(String(signature || ""), "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function hashToken(token) {
  // В БД храним хеш токена, не сам токен — утечка таблицы sessions не даёт
  // готовые сессии, как и с паролями.
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.query(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)`, [
    hashToken(token),
    userId,
    expiresAt,
  ]);
  return `${token}.${signToken(token)}`;
}

function parseCookie(req) {
  const header = req.headers.cookie || "";
  const match = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!match) return null;
  try {
    return decodeURIComponent(match.slice(SESSION_COOKIE_NAME.length + 1));
  } catch {
    return null;
  }
}

async function getUserFromCookie(req) {
  const raw = parseCookie(req);
  if (!raw) return null;
  const [token, signature] = raw.split(".");
  if (!token || !signature) return null;
  // Проверяем подпись до похода в БД — отсекает заведомо подделанные
  // значения без лишнего запроса. Сравнение в постоянном времени.
  if (!verifyTokenSignature(token, signature)) return null;
  const { rows } = await db.query(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)],
  );
  return rows[0] || null;
}

async function destroySessionFromCookie(req) {
  const raw = parseCookie(req);
  if (!raw) return;
  const [token] = raw.split(".");
  if (!token) return;
  await db.query(`DELETE FROM sessions WHERE token_hash = $1`, [hashToken(token)]);
}

function sessionCookieHeader(tokenWithSignature) {
  const secure = process.env.NODE_ENV === "production" || process.env.FORCE_SECURE_COOKIE === "1" ? " Secure;" : "";
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(tokenWithSignature)}; HttpOnly;${secure} SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

function clearCookieHeader() {
  // Атрибуты (Secure/SameSite/Path) должны совпадать с sessionCookieHeader,
  // иначе часть браузеров не считает это той же cookie и не удаляет её.
  const secure = process.env.NODE_ENV === "production" || process.env.FORCE_SECURE_COOKIE === "1" ? " Secure;" : "";
  return `${SESSION_COOKIE_NAME}=; HttpOnly;${secure} SameSite=Lax; Path=/; Max-Age=0`;
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
    plan_active_until: user.plan_active_until,
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSession,
  getUserFromCookie,
  destroySessionFromCookie,
  sessionCookieHeader,
  clearCookieHeader,
  publicUser,
  MAX_PASSWORD_LENGTH,
};
