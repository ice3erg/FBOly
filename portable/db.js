"use strict";

// Слой работы с БД. До этого файла в проекте не было ни одной внешней
// npm-зависимости (портативный сервер был на чистом Node) — pg это первая
// осознанная зависимость, нужна для реальных аккаунтов/подписок.
//
// Если DATABASE_URL не задан — модуль просто отключён (isEnabled() === false),
// а все auth/billing-роуты отвечают понятной ошибкой вместо падения всего
// сервера. Так можно деплоить сервис и без БД, если аккаунты пока не нужны.
const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL || "";

// Managed Postgres на Render требует TLS, но с самоподписанным/промежуточным
// сертификатом без полной цепочки — поэтому rejectUnauthorized: false, как
// это обычно и делают для Render/Heroku-style Postgres. Задайте
// DATABASE_SSL=0, если подключаетесь к локальному Postgres без TLS вообще.
const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "0" ? false : { rejectUnauthorized: false },
      max: Number(process.env.DATABASE_POOL_MAX || 5),
    })
  : null;

if (pool) {
  pool.on("error", (error) => {
    // Ошибки на простаивающих соединениях пула не должны ронять процесс.
    console.error("[db] idle client error:", error.message);
  });
}

function isEnabled() {
  return Boolean(pool);
}

async function query(text, params) {
  if (!pool) {
    const error = new Error("Аккаунты и оплата временно недоступны: DATABASE_URL не задан на сервере");
    error.statusCode = 503;
    throw error;
  }
  return pool.query(text, params);
}

// Простая ручная миграция вместо отдельного инструмента — оправдано для
// одного сервиса с тремя таблицами. Идемпотентна (IF NOT EXISTS), можно
// звать при каждом старте процесса.
async function migrate() {
  if (!pool) return;
  // gen_random_uuid() встроена в ядро PostgreSQL с версии 13 — отдельное
  // расширение (pgcrypto/uuid-ossp) не требуется. Специально не делаем
  // CREATE EXTENSION: на managed-Postgres (Render и т.п.) роль приложения
  // часто не имеет прав на создание расширений, и миграция бы падала.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      plan TEXT NOT NULL DEFAULT 'start',
      plan_active_until TIMESTAMPTZ,
      yookassa_payment_method_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan TEXT NOT NULL,
      amount_kopeks INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS payments_user_id_idx ON payments(user_id);`);
  console.log("[db] migration complete");
}

module.exports = { query, migrate, isEnabled };
