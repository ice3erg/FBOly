"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";
import { BrandMark } from "../BrandMark";
import styles from "./auth.module.css";

const AUTH_STORAGE_KEY = "fboly-auth-session";

type AuthMode = "login" | "register";

type FieldErrors = {
  name?: string;
  email?: string;
  password?: string;
  confirm?: string;
};

function validate(
  mode: AuthMode,
  fields: { name: string; email: string; password: string; confirm: string },
): FieldErrors {
  const errors: FieldErrors = {};
  if (mode === "register" && !fields.name.trim()) {
    errors.name = "Введите имя";
  }
  if (!fields.email.trim()) {
    errors.email = "Введите email";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) {
    errors.email = "Некорректный email";
  }
  if (!fields.password) {
    errors.password = "Введите пароль";
  } else if (fields.password.length < 6) {
    errors.password = "Минимум 6 символов";
  }
  if (mode === "register" && fields.password && fields.confirm !== fields.password) {
    errors.confirm = "Пароли не совпадают";
  }
  return errors;
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.24 4.24M9.5 5.1A10.9 10.9 0 0 1 12 5c7 0 11 7 11 7a13.2 13.2 0 0 1-3.1 3.6M6.2 6.2A13.4 13.4 0 0 0 1 12s4 7 11 7a10.8 10.8 0 0 0 4.2-.85" />
    </svg>
  ) : (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [shop, setShop] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [shakeField, setShakeField] = useState<string | null>(null);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const session = localStorage.getItem(AUTH_STORAGE_KEY);
      if (session) router.replace("/app/supply");
    } catch {
      // localStorage недоступен — остаёмся на форме входа
    }
  }, [router]);

  function switchMode(next: AuthMode) {
    setMode(next);
    setErrors({});
    setGlobalError("");
    setPassword("");
    setConfirm("");
    setShowPassword(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setGlobalError("");

    const fieldErrors = validate(mode, { name, email, password, confirm });
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      const firstBad = fieldErrors.name ? "name" : fieldErrors.email ? "email" : "password";
      setShakeField(firstBad);
      setTimeout(() => setShakeField(null), 400);
      (firstBad === "name" ? nameRef : firstBad === "email" ? emailRef : passwordRef).current?.focus();
      return;
    }
    if (mode === "register" && !agreed) {
      setGlobalError("Примите условия сервиса для продолжения");
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(
          mode === "login"
            ? { email: email.trim(), password }
            : { email: email.trim(), password, name: name.trim() },
        ),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail || "Не удалось войти. Попробуйте ещё раз.");
      }
      // Сессия теперь живёт в httpOnly cookie (сервер сам её выставил в
      // ответе) — здесь кэшируем только отображаемые данные пользователя
      // для мгновенной отрисовки профиля без похода на /api/auth/me.
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload.user));
      router.push("/app/supply");
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : "Не удалось войти. Попробуйте ещё раз.");
      setLoading(false);
    }
  }

  if (!mounted) return null;

  const isLogin = mode === "login";

  return (
    <div className={styles.page}>
      <a className={styles.brand} href="/">
        <BrandMark height={30} />
      </a>

      <div className={styles.card}>
        <div className={styles.accentLine} />

        <div className={styles.title}>{isLogin ? "Добро пожаловать" : "Создать аккаунт"}</div>
        <div className={styles.subtitle}>
          {isLogin ? "Войдите в свой аккаунт FBOly" : "Начните автоматизировать поставки"}
        </div>

        <div className={styles.tabSwitcher} role="tablist">
          <div
            className={styles.tabIndicator}
            style={{ transform: isLogin ? "translateX(0)" : "translateX(calc(100% + 3px))" }}
          />
          <button
            type="button"
            className={`${styles.tabBtn} ${isLogin ? styles.tabActive : styles.tabInactive}`}
            role="tab"
            aria-selected={isLogin}
            onClick={() => switchMode("login")}
          >
            Вход
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${!isLogin ? styles.tabActive : styles.tabInactive}`}
            role="tab"
            aria-selected={!isLogin}
            onClick={() => switchMode("register")}
          >
            Регистрация
          </button>
        </div>

        <form className={styles.formFields} onSubmit={handleSubmit} noValidate>
          <div className={`${styles.field} ${isLogin ? styles.hidden : ""} ${shakeField === "name" ? styles.shake : ""}`}>
            <label className={styles.label} htmlFor="inputName">Имя</label>
            <input
              ref={nameRef}
              className={`${styles.input} ${errors.name ? styles.invalid : ""}`}
              type="text"
              placeholder="Алексей Иванов"
              id="inputName"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {errors.name && <div className={styles.fieldError}>{errors.name}</div>}
          </div>

          <div className={shakeField === "email" ? styles.shake : ""}>
            <label className={styles.label} htmlFor="inputEmail">Email</label>
            <input
              ref={emailRef}
              className={`${styles.input} ${errors.email ? styles.invalid : ""}`}
              type="email"
              placeholder="seller@example.ru"
              id="inputEmail"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {errors.email && <div className={styles.fieldError}>{errors.email}</div>}
          </div>

          <div className={shakeField === "password" ? styles.shake : ""}>
            <label className={styles.label} htmlFor="inputPassword">
              Пароль
              <button
                type="button"
                className={styles.link}
                disabled={!isLogin}
                onClick={() => alert("Ссылка для восстановления пароля будет отправлена на email.")}
              >
                Забыли пароль?
              </button>
            </label>
            <div className={styles.passwordWrap}>
              <input
                ref={passwordRef}
                className={`${styles.input} ${errors.password ? styles.invalid : ""}`}
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                id="inputPassword"
                autoComplete={isLogin ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className={styles.passwordToggle}
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((s) => !s)}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
            {errors.password && <div className={styles.fieldError}>{errors.password}</div>}
          </div>

          <div className={`${styles.field} ${isLogin ? styles.hidden : ""}`}>
            <label className={styles.label} htmlFor="inputConfirm">Повторите пароль</label>
            <input
              className={`${styles.input} ${errors.confirm ? styles.invalid : ""}`}
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              id="inputConfirm"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {errors.confirm && <div className={styles.fieldError}>{errors.confirm}</div>}
          </div>

          <div className={`${styles.field} ${isLogin ? styles.hidden : ""}`}>
            <label className={styles.label} htmlFor="inputShop">Магазин на Ozon (опционально)</label>
            <input
              className={styles.input}
              type="text"
              placeholder="Название магазина или Client-Id"
              id="inputShop"
              autoComplete="organization"
              value={shop}
              onChange={(e) => setShop(e.target.value)}
            />
          </div>

          {!isLogin && (
            <div className={styles.agreeRow}>
              <input
                type="checkbox"
                id="agree"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              <label htmlFor="agree">
                Согласен с условиями сервиса и политикой обработки данных
              </label>
            </div>
          )}

          {globalError && <div className={`${styles.errorMsg} ${styles.show}`}>{globalError}</div>}

          <button className={styles.btnSubmit} type="submit" disabled={loading}>
            {loading ? (
              <>
                <svg className={styles.spin} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
                  <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
                </svg>
                Загрузка…
              </>
            ) : isLogin ? "Войти" : "Зарегистрироваться"}
          </button>
        </form>

        <div className={styles.toggleRow}>
          <button type="button" className={styles.link} onClick={() => switchMode(isLogin ? "register" : "login")}>
            {isLogin ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
          </button>
        </div>

        <div className={styles.footer}>
          <span className={styles.footerDot}><span className={styles.footerInner} /></span>
          Соединение защищено
        </div>
      </div>
    </div>
  );
}
