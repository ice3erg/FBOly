"use strict";

// Интеграция с ЮKassa (https://yookassa.ru/developers/api).
//
// Важный момент безопасности: тело вебхука-уведомления НЕ считается
// источником истины сам по себе (его в теории можно подделать, не имея
// доступа к IP-подсети ЮKassa). Вместо allowlist по IP уведомлений мы при
// получении вебхука перезапрашиваем реальный статус платежа напрямую через
// API ЮKassa (Basic Auth shopId:secretKey) и обновляем тариф только на
// основании этого ответа — так подделать апгрейд тарифа нельзя, даже зная
// payment_id.
const crypto = require("node:crypto");
const db = require("./db");

const YOOKASSA_SHOP_ID = process.env.YOOKASSA_SHOP_ID || "";
const YOOKASSA_SECRET_KEY = process.env.YOOKASSA_SECRET_KEY || "";
const YOOKASSA_API_BASE = "https://api.yookassa.ru/v3";
// Публичный URL приложения — нужен для return_url (куда ЮKassa вернёт
// пользователя после оплаты). Задайте PUBLIC_APP_URL в Render, например
// https://fboly.onrender.com — иначе return_url будет относительным и
// ЮKassa может отклонить запрос на создание платежа.
const PUBLIC_APP_URL = (process.env.PUBLIC_APP_URL || "").replace(/\/+$/, "");

// Цены синхронизированы с /pricing и /app/profile — см. коммит с
// пересчётом тарифов по рынку конкурентов (июль 2026).
const PLANS = {
  pro: { title: "Pro", amountRub: 1990 },
  team: { title: "Команда", amountRub: 4990 },
};

function isConfigured() {
  return Boolean(YOOKASSA_SHOP_ID && YOOKASSA_SECRET_KEY);
}

function authHeader() {
  return `Basic ${Buffer.from(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`).toString("base64")}`;
}

async function createPayment({ userId, userEmail, plan }) {
  if (!isConfigured()) {
    const error = new Error("Оплата временно недоступна: ЮKassa не настроена на сервере (нет YOOKASSA_SHOP_ID/YOOKASSA_SECRET_KEY)");
    error.statusCode = 503;
    throw error;
  }
  const planInfo = PLANS[plan];
  if (!planInfo) {
    const error = new Error("Неизвестный тариф");
    error.statusCode = 400;
    throw error;
  }

  const amountValue = planInfo.amountRub.toFixed(2);
  const returnUrl = `${PUBLIC_APP_URL}/app/profile?billing=success`;

  const response = await fetch(`${YOOKASSA_API_BASE}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
      "Idempotence-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      amount: { value: amountValue, currency: "RUB" },
      capture: true,
      // Сохраняем метод оплаты — нужен для будущего автосписания при
      // продлении подписки (сейчас продление всё ещё делает пользователь
      // вручную, см. заметку в README про recurring).
      save_payment_method: true,
      confirmation: { type: "redirect", return_url: returnUrl },
      description: `Подписка FBOly — ${planInfo.title} (1 месяц)`,
      metadata: { user_id: userId, plan },
      receipt: userEmail
        ? {
            customer: { email: userEmail },
            items: [
              {
                description: `Подписка FBOly — тариф ${planInfo.title}, 1 месяц`,
                quantity: "1.00",
                amount: { value: amountValue, currency: "RUB" },
                vat_code: 1,
                payment_subject: "service",
                payment_mode: "full_payment",
              },
            ],
          }
        : undefined,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    const error = new Error((payload && payload.description) || "Ошибка создания платежа в ЮKassa");
    error.statusCode = 502;
    error.details = payload;
    throw error;
  }

  await db.query(`INSERT INTO payments (id, user_id, plan, amount_kopeks, status) VALUES ($1, $2, $3, $4, $5)`, [
    payload.id,
    userId,
    plan,
    Math.round(planInfo.amountRub * 100),
    payload.status,
  ]);

  return {
    paymentId: payload.id,
    confirmationUrl: (payload.confirmation && payload.confirmation.confirmation_url) || null,
    status: payload.status,
  };
}

async function fetchPaymentStatus(paymentId) {
  const response = await fetch(`${YOOKASSA_API_BASE}/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: authHeader() },
  });
  if (!response.ok) {
    const error = new Error("Не удалось проверить статус платежа в ЮKassa");
    error.statusCode = 502;
    throw error;
  }
  return response.json();
}

async function handleWebhookNotification(body) {
  const paymentId = body && body.object && body.object.id;
  if (!paymentId) return { ok: false, reason: "no payment id in webhook body" };

  const payment = await fetchPaymentStatus(paymentId);

  const { rows } = await db.query(`SELECT * FROM payments WHERE id = $1`, [paymentId]);
  const paymentRow = rows[0];
  if (!paymentRow) return { ok: false, reason: "unknown payment id" };

  await db.query(`UPDATE payments SET status = $1, updated_at = now() WHERE id = $2`, [payment.status, paymentId]);

  if (payment.status === "succeeded") {
    const activeUntil = new Date();
    activeUntil.setMonth(activeUntil.getMonth() + 1);
    const paymentMethodId =
      payment.payment_method && payment.payment_method.saved ? payment.payment_method.id : null;
    await db.query(
      `UPDATE users SET plan = $1, plan_active_until = $2, yookassa_payment_method_id = COALESCE($3, yookassa_payment_method_id) WHERE id = $4`,
      [paymentRow.plan, activeUntil, paymentMethodId, paymentRow.user_id],
    );
  }

  return { ok: true, status: payment.status };
}

module.exports = { isConfigured, createPayment, fetchPaymentStatus, handleWebhookNotification, PLANS };
