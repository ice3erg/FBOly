"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Zap,
} from "lucide-react";

const AUTH_STORAGE_KEY = "fboly-auth-session";

type AuthMode = "login" | "register";

type FieldError = {
  name?: string;
  email?: string;
  password?: string;
  confirm?: string;
};

function validate(mode: AuthMode, fields: {
  name: string;
  email: string;
  password: string;
  confirm: string;
}): FieldError {
  const errors: FieldError = {};
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

function LogoMark() {
  return (
    <div
      className="flex items-center justify-center rounded-2xl"
      style={{
        width: 52,
        height: 52,
        background: "linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)",
        boxShadow: "0 0 32px rgba(124,58,237,0.55), inset 0 1px 0 rgba(255,255,255,0.18)",
      }}
    >
      <Zap className="h-7 w-7 text-white" strokeWidth={2.2} />
    </div>
  );
}

function FieldWrapper({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-zinc-300">{label}</label>
      {children}
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}

function AuthInput({
  type = "text",
  placeholder,
  value,
  onChange,
  autoComplete,
  hasError,
  suffix,
}: {
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  hasError?: boolean;
  suffix?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className={[
          "w-full rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition",
          "h-12",
          hasError
            ? "border border-red-500/60 bg-red-500/[0.06]"
            : "border border-white/[0.09] bg-white/[0.05] focus:border-violet-500/60 focus:bg-white/[0.07]",
          suffix ? "pr-12" : "",
        ].join(" ")}
      />
      {suffix && (
        <div className="absolute inset-y-0 right-0 flex items-center pr-4">
          {suffix}
        </div>
      )}
    </div>
  );
}

const FEATURES = [
  "Автоматическое распределение товаров по кластерам Ozon",
  "Создание черновиков поставки через Seller API",
  "Охотник на слоты — найдёт окно и забронирует сам",
];

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(true);
  const [errors, setErrors] = useState<FieldError>({});
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Если уже авторизован — редиректим на главную
    try {
      const session = localStorage.getItem(AUTH_STORAGE_KEY);
      if (session) {
        router.replace("/");
      }
    } catch {}
  }, [router]);

  function switchMode(next: AuthMode) {
    setMode(next);
    setErrors({});
    setGlobalError("");
    setPassword("");
    setConfirm("");
    setShowPassword(false);
    setShowConfirm(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setGlobalError("");

    const fieldErrors = validate(mode, { name, email, password, confirm });
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    if (mode === "register" && !agreed) {
      setGlobalError("Примите условия сервиса для продолжения");
      return;
    }

    setErrors({});
    setLoading(true);

    // Имитируем запрос — здесь будет реальный API
    await new Promise((r) => setTimeout(r, 800));

    try {
      localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({
          email: email.trim(),
          name: name.trim() || email.split("@")[0],
          createdAt: new Date().toISOString(),
        }),
      );
      router.push("/");
    } catch {
      setGlobalError("Не удалось сохранить сессию. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) return null;

  return (
    <main
      className="min-h-screen text-white"
      style={{
        background:
          "radial-gradient(circle at 10% 90%, rgba(124,58,237,0.28) 0%, transparent 38rem)," +
          "radial-gradient(circle at 85% 8%, rgba(139,92,246,0.18) 0%, transparent 32rem)," +
          "linear-gradient(rgba(255,255,255,0.016) 1px, transparent 1px)," +
          "linear-gradient(90deg, rgba(255,255,255,0.016) 1px, transparent 1px)," +
          "linear-gradient(180deg, #07070a 0%, #0b0b12 50%, #050507 100%)",
        backgroundSize: "auto, auto, 34px 34px, 34px 34px, auto",
      }}
    >
      {/* Header */}
      <header className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <LogoMark />
          <span className="text-2xl font-semibold tracking-tight">
            FBO<span className="text-violet-400">ly</span>
          </span>
        </div>
        <a
          href="/"
          className="group flex items-center gap-2 rounded-lg border border-white/[0.09] bg-white/[0.04] px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white"
        >
          Войти в кабинет
          <ArrowRight className="h-4 w-4 text-violet-400 transition group-hover:translate-x-0.5" />
        </a>
      </header>

      {/* Body */}
      <div className="mx-auto grid max-w-[1400px] min-h-[calc(100vh-76px)] items-center gap-10 px-6 py-10 lg:grid-cols-2 lg:gap-16 lg:py-0">

        {/* Left — promo */}
        <section className="hidden lg:block">
          <div className="max-w-[520px]">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-300">
              <Sparkles className="h-4 w-4" />
              Закрываем боли селлеров
            </div>

            <h1 className="text-5xl font-semibold leading-[1.06] tracking-tight xl:text-6xl">
              Поставки Ozon FBO{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: "linear-gradient(135deg, #A78BFA 0%, #7C3AED 60%)",
                }}
              >
                без рутины
              </span>
            </h1>

            <p className="mt-6 text-lg leading-8 text-zinc-400">
              FBOly распределяет товары по кластерам, готовит файлы и ловит слоты — вам остаётся только подтвердить.
            </p>

            <ul className="mt-10 space-y-5">
              {FEATURES.map((feat) => (
                <li key={feat} className="flex items-start gap-4">
                  <div
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: "rgba(124,58,237,0.18)",
                      border: "1px solid rgba(124,58,237,0.35)",
                      boxShadow: "0 0 16px rgba(124,58,237,0.18)",
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4 text-violet-400" />
                  </div>
                  <span className="text-base text-zinc-200">{feat}</span>
                </li>
              ))}
            </ul>

            <div className="mt-12 flex items-center gap-3 text-sm text-zinc-500">
              <ShieldCheck className="h-4 w-4 text-violet-500" />
              Ключи Ozon вводятся только внутри кабинета и нигде не хранятся на сервере
            </div>
          </div>
        </section>

        {/* Right — auth card */}
        <section className="mx-auto w-full max-w-[460px] lg:mx-0">
          {/* Mode switcher */}
          <div
            className="mb-7 flex rounded-xl p-1"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            {(["register", "login"] as AuthMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={[
                  "flex-1 rounded-lg py-2.5 text-sm font-semibold transition",
                  mode === m
                    ? "bg-violet-600 text-white shadow-[0_2px_16px_rgba(124,58,237,0.40)]"
                    : "text-zinc-400 hover:text-zinc-200",
                ].join(" ")}
              >
                {m === "register" ? "Регистрация" : "Вход"}
              </button>
            ))}
          </div>

          {/* Card */}
          <div
            className="rounded-2xl p-7 sm:p-8"
            style={{
              background: "rgba(11,11,20,0.85)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow:
                "0 0 0 1px rgba(124,58,237,0.12), 0 24px 60px rgba(0,0,0,0.55), 0 0 80px rgba(124,58,237,0.10)",
              backdropFilter: "blur(20px)",
            }}
          >
            {/* Top line accent */}
            <div
              className="pointer-events-none absolute inset-x-7 top-0 h-px"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.6), transparent)",
              }}
            />

            <div className="mb-6 flex items-center gap-4">
              <LogoMark />
              <div>
                <h2 className="text-xl font-semibold">
                  {mode === "register" ? "Создать аккаунт" : "С возвращением"}
                </h2>
                <p className="mt-0.5 text-sm text-zinc-500">
                  {mode === "register"
                    ? "Начните автоматизировать поставки"
                    : "Войдите в личный кабинет"}
                </p>
              </div>
            </div>

            {globalError && (
              <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/[0.08] px-4 py-3 text-sm text-red-400">
                {globalError}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {mode === "register" && (
                <FieldWrapper label="Имя" error={errors.name}>
                  <AuthInput
                    placeholder="Как вас зовут?"
                    value={name}
                    onChange={(v) => { setName(v); setErrors((e) => ({ ...e, name: undefined })); }}
                    autoComplete="name"
                    hasError={!!errors.name}
                  />
                </FieldWrapper>
              )}

              <FieldWrapper label="Email" error={errors.email}>
                <AuthInput
                  type="email"
                  placeholder="seller@example.ru"
                  value={email}
                  onChange={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: undefined })); }}
                  autoComplete="email"
                  hasError={!!errors.email}
                />
              </FieldWrapper>

              <FieldWrapper label="Пароль" error={errors.password}>
                <AuthInput
                  type={showPassword ? "text" : "password"}
                  placeholder={mode === "register" ? "Минимум 6 символов" : "Введите пароль"}
                  value={password}
                  onChange={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: undefined })); }}
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  hasError={!!errors.password}
                  suffix={
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="text-zinc-500 transition hover:text-zinc-300"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />
              </FieldWrapper>

              {mode === "register" && (
                <FieldWrapper label="Повторите пароль" error={errors.confirm}>
                  <AuthInput
                    type={showConfirm ? "text" : "password"}
                    placeholder="Ещё раз"
                    value={confirm}
                    onChange={(v) => { setConfirm(v); setErrors((e) => ({ ...e, confirm: undefined })); }}
                    autoComplete="new-password"
                    hasError={!!errors.confirm}
                    suffix={
                      <button
                        type="button"
                        onClick={() => setShowConfirm((s) => !s)}
                        className="text-zinc-500 transition hover:text-zinc-300"
                        tabIndex={-1}
                      >
                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    }
                  />
                </FieldWrapper>
              )}

              {mode === "login" && (
                <div className="flex justify-end">
                  <button type="button" className="text-sm text-violet-400 transition hover:text-violet-300">
                    Забыли пароль?
                  </button>
                </div>
              )}

              {mode === "register" && (
                <label className="flex cursor-pointer items-start gap-3 pt-1 text-sm text-zinc-400">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-white/20 accent-violet-500"
                  />
                  <span>
                    Согласен с{" "}
                    <span className="text-violet-400 transition hover:text-violet-300 cursor-pointer">
                      условиями сервиса
                    </span>{" "}
                    и{" "}
                    <span className="text-violet-400 transition hover:text-violet-300 cursor-pointer">
                      политикой конфиденциальности
                    </span>
                  </span>
                </label>
              )}

              <button
                type="submit"
                disabled={loading}
                className="relative mt-2 flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl text-sm font-semibold text-white transition disabled:opacity-70"
                style={{
                  background: loading
                    ? "rgba(124,58,237,0.6)"
                    : "linear-gradient(135deg, #7C3AED 0%, #9333EA 100%)",
                  boxShadow: loading ? "none" : "0 4px 24px rgba(124,58,237,0.45)",
                }}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : mode === "register" ? (
                  <UserPlus className="h-4 w-4" />
                ) : (
                  <LockKeyhole className="h-4 w-4" />
                )}
                {loading
                  ? "Подождите..."
                  : mode === "register"
                    ? "Создать аккаунт"
                    : "Войти в кабинет"}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-zinc-500">
              {mode === "register" ? "Уже есть аккаунт?" : "Ещё нет аккаунта?"}{" "}
              <button
                type="button"
                onClick={() => switchMode(mode === "register" ? "login" : "register")}
                className="font-medium text-violet-400 transition hover:text-violet-300"
              >
                {mode === "register" ? "Войти" : "Зарегистрироваться"}
              </button>
            </p>

            <div className="mt-6 flex items-center gap-2 justify-center text-xs text-zinc-600">
              <ShieldCheck className="h-3.5 w-3.5" />
              Ключи Ozon API хранятся только в вашем браузере
            </div>
          </div>

          {/* Social proof */}
          <div className="mt-6 flex items-center justify-center gap-6 text-xs text-zinc-600">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
              Сервис работает
            </span>
            <span>·</span>
            <span>Бесплатный доступ на старте</span>
            <span>·</span>
            <span>Без карты</span>
          </div>
        </section>
      </div>
    </main>
  );
}
