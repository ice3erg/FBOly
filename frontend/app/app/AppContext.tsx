"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { API_URL, createBrowserId, formatRequestError } from "@/lib/api";
import type { ProcessResponse } from "@/lib/types";

export type AppUser = {
  name: string;
  email: string;
  organization: string;
};

export type OzonStore = {
  id: string;
  title: string;
  clientId: string;
  apiKey: string;
  status: "idle" | "success" | "error";
  statusMessage: string;
  checkedAt?: string | null;
};

export type ConnectionStatus =
  | { type: "idle"; message: string }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

const AUTH_STORAGE_KEY = "ozon-fbo-service-user";
const FBOLY_AUTH_SESSION_KEY = "fboly-auth-session";
const STORES_STORAGE_KEY = "ozon-fbo-service-stores";
const ACTIVE_STORE_STORAGE_KEY = "ozon-fbo-service-active-store";
const CREDENTIALS_STORAGE_KEY = "ozon-fbo-service-credentials";
const LAST_PROCESS_RESULT_KEY = "fboly-last-process-result";

const DEFAULT_USER: AppUser = {
  name: "Пользователь",
  email: "seller@example.ru",
  organization: "Мой магазин Ozon",
};

type AppContextValue = {
  ready: boolean;
  user: AppUser;
  setUser: (user: AppUser) => void;
  logout: () => void;

  stores: OzonStore[];
  activeStoreId: string | null;
  activeStore: OzonStore | null;
  clientId: string;
  apiKey: string;
  connectionStatus: ConnectionStatus;
  isCheckingConnection: boolean;

  selectStore: (storeId: string) => void;
  addStore: () => void;
  removeStore: (storeId: string) => void;
  handleClientIdChange: (value: string) => void;
  handleApiKeyChange: (value: string) => void;
  updateStoreTitle: (storeId: string, title: string) => void;
  checkStoreConnection: (storeId?: string) => Promise<void>;

  // Результат последней обработки Excel на Поставке — общий для Поставки и
  // Слотов, потому что охотник на слоты работает с теми же кандидатами
  // (drop_off_point/кластеры), что были рассчитаны при загрузке файла.
  // Раньше это была одна SPA-страница с общим состоянием; теперь это два
  // роута, поэтому результат живёт в контексте, а не в page.tsx.
  lastProcessResult: ProcessResponse | null;
  setLastProcessResult: (result: ProcessResponse | null) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [user, setUserState] = useState<AppUser>(DEFAULT_USER);
  const [stores, setStores] = useState<OzonStore[]>([]);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [clientId, setClientId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    type: "idle",
    message: "Кабинет Ozon ещё не проверен",
  });
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const [lastProcessResult, setLastProcessResultState] = useState<ProcessResponse | null>(null);
  const setLastProcessResult = useCallback((result: ProcessResponse | null) => {
    setLastProcessResultState(result);
    try {
      if (result) window.localStorage.setItem(LAST_PROCESS_RESULT_KEY, JSON.stringify(result));
      else window.localStorage.removeItem(LAST_PROCESS_RESULT_KEY);
    } catch {
      // localStorage может быть переполнен на очень больших поставках — не блокируем UI
    }
  }, []);

  // ── Auth-гейт + загрузка сохранённого состояния ──
  useEffect(() => {
    let session: { email?: string; name?: string } | null = null;
    try {
      const raw = window.localStorage.getItem(FBOLY_AUTH_SESSION_KEY);
      if (!raw) {
        router.replace("/auth");
        return;
      }
      session = JSON.parse(raw);
    } catch {
      window.localStorage.removeItem(FBOLY_AUTH_SESSION_KEY);
      router.replace("/auth");
      return;
    }

    if (session?.email || session?.name) {
      setUserState({
        name: session.name || session.email?.split("@")[0] || "Пользователь",
        email: session.email || "",
        organization: "Мой магазин Ozon",
      });
    }

    const savedUser = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (savedUser) {
      try {
        setUserState(JSON.parse(savedUser) as AppUser);
      } catch {
        window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(DEFAULT_USER));
      }
    } else {
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(DEFAULT_USER));
    }

    const savedStores = window.localStorage.getItem(STORES_STORAGE_KEY);
    const savedActiveStoreId = window.localStorage.getItem(ACTIVE_STORE_STORAGE_KEY);
    if (savedStores) {
      try {
        const parsedStores = JSON.parse(savedStores) as OzonStore[];
        const validStores = parsedStores.filter((store) => store.id);
        const activeId =
          savedActiveStoreId && validStores.some((store) => store.id === savedActiveStoreId)
            ? savedActiveStoreId
            : validStores[0]?.id ?? null;
        setStores(validStores);
        setActiveStoreId(activeId);
        const activeStoreRecord = validStores.find((store) => store.id === activeId);
        setClientId(activeStoreRecord?.clientId ?? "");
        setApiKey(activeStoreRecord?.apiKey ?? "");
        setConnectionStatus({
          type:
            activeStoreRecord?.status === "success"
              ? "success"
              : activeStoreRecord?.status === "error"
                ? "error"
                : "idle",
          message: activeStoreRecord?.statusMessage ?? "Выберите магазин в профиле",
        });
      } catch {
        window.localStorage.removeItem(STORES_STORAGE_KEY);
        window.localStorage.removeItem(ACTIVE_STORE_STORAGE_KEY);
      }
    } else {
      // Миграция со старого одиночного набора ключей (до мульти-магазинов)
      const savedCredentials = window.localStorage.getItem(CREDENTIALS_STORAGE_KEY);
      if (savedCredentials) {
        try {
          const parsed = JSON.parse(savedCredentials) as { clientId?: string; apiKey?: string };
          const migratedStore: OzonStore = {
            id: createBrowserId("store"),
            title: "Основной магазин",
            clientId: parsed.clientId ?? "",
            apiKey: parsed.apiKey ?? "",
            status: "idle",
            statusMessage: "Ключи Ozon загружены из профиля браузера",
            checkedAt: null,
          };
          setStores([migratedStore]);
          setActiveStoreId(migratedStore.id);
          setClientId(migratedStore.clientId);
          setApiKey(migratedStore.apiKey);
        } catch {
          window.localStorage.removeItem(CREDENTIALS_STORAGE_KEY);
        }
      }
    }

    setReady(true);

    // Результат последней обработки Excel — переживает обновление страницы
    // и прямой заход на /app/slots, минуя /app/supply (раньше терялся,
    // так как жил только в памяти React).
    try {
      const savedResult = window.localStorage.getItem(LAST_PROCESS_RESULT_KEY);
      if (savedResult) setLastProcessResultState(JSON.parse(savedResult));
    } catch {
      window.localStorage.removeItem(LAST_PROCESS_RESULT_KEY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistStores = useCallback((nextStores: OzonStore[], nextActiveStoreId: string | null) => {
    window.localStorage.setItem(STORES_STORAGE_KEY, JSON.stringify(nextStores));
    if (nextActiveStoreId) {
      window.localStorage.setItem(ACTIVE_STORE_STORAGE_KEY, nextActiveStoreId);
    }
  }, []);

  const saveStores = useCallback(
    (nextStores: OzonStore[], nextActiveStoreId: string | null = activeStoreId) => {
      setStores(nextStores);
      setActiveStoreId(nextActiveStoreId);
      persistStores(nextStores, nextActiveStoreId);
    },
    [activeStoreId, persistStores],
  );

  const setUser = useCallback((next: AppUser) => {
    setUserState(next);
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    window.localStorage.removeItem(FBOLY_AUTH_SESSION_KEY);
    router.push("/auth");
  }, [router]);

  const updateStoreById = useCallback(
    (storeId: string, patch: Partial<OzonStore>) => {
      setStores((current) => {
        const nextStores = current.map((store) => (store.id === storeId ? { ...store, ...patch } : store));
        persistStores(nextStores, activeStoreId);
        if (storeId === activeStoreId) {
          const nextActive = nextStores.find((store) => store.id === storeId);
          setClientId(nextActive?.clientId ?? "");
          setApiKey(nextActive?.apiKey ?? "");
          setConnectionStatus({
            type: nextActive?.status === "success" ? "success" : nextActive?.status === "error" ? "error" : "idle",
            message: nextActive?.statusMessage ?? "Магазин выбран",
          });
        }
        return nextStores;
      });
    },
    [activeStoreId, persistStores],
  );

  const addStore = useCallback(() => {
    const nextStore: OzonStore = {
      id: createBrowserId("store"),
      title: `Магазин ${stores.length + 1}`,
      clientId: "",
      apiKey: "",
      status: "idle",
      statusMessage: "Ключи ещё не проверялись",
      checkedAt: null,
    };
    const nextStores = [...stores, nextStore];
    saveStores(nextStores, nextStore.id);
    setClientId("");
    setApiKey("");
    setConnectionStatus({ type: "idle", message: nextStore.statusMessage });
  }, [stores, saveStores]);

  const removeStore = useCallback(
    (storeId: string) => {
      const nextStores = stores.filter((store) => store.id !== storeId);
      const nextActiveId = storeId === activeStoreId ? nextStores[0]?.id ?? null : activeStoreId;
      saveStores(nextStores, nextActiveId);
      const nextActive = nextStores.find((store) => store.id === nextActiveId);
      setClientId(nextActive?.clientId ?? "");
      setApiKey(nextActive?.apiKey ?? "");
      setConnectionStatus({
        type: nextActive?.status === "success" ? "success" : nextActive?.status === "error" ? "error" : "idle",
        message: nextActive?.statusMessage ?? "Магазин не выбран",
      });
    },
    [stores, activeStoreId, saveStores],
  );

  const selectStore = useCallback(
    (storeId: string) => {
      const store = stores.find((item) => item.id === storeId);
      if (!store) return;
      setActiveStoreId(store.id);
      setClientId(store.clientId);
      setApiKey(store.apiKey);
      setConnectionStatus({
        type: store.status === "success" ? "success" : store.status === "error" ? "error" : "idle",
        message: store.statusMessage || `${store.title} выбран`,
      });
      persistStores(stores, store.id);
    },
    [stores, persistStores],
  );

  const updateStoreTitle = useCallback(
    (storeId: string, title: string) => updateStoreById(storeId, { title }),
    [updateStoreById],
  );

  const handleClientIdChange = useCallback(
    (value: string) => {
      setClientId(value);
      if (activeStoreId) {
        updateStoreById(activeStoreId, {
          clientId: value,
          status: "idle",
          statusMessage: "Ключи изменены, проверьте подключение",
        });
      }
    },
    [activeStoreId, updateStoreById],
  );

  const handleApiKeyChange = useCallback(
    (value: string) => {
      setApiKey(value);
      if (activeStoreId) {
        updateStoreById(activeStoreId, {
          apiKey: value,
          status: "idle",
          statusMessage: "Ключи изменены, проверьте подключение",
        });
      }
    },
    [activeStoreId, updateStoreById],
  );

  const checkStoreConnection = useCallback(
    async (storeId: string = activeStoreId ?? "") => {
      const store = stores.find((item) => item.id === storeId);
      if (!store) return;
      if (!store.clientId.trim() || !store.apiKey.trim()) {
        updateStoreById(storeId, { status: "error", statusMessage: "Введите Client ID и API Key" });
        return;
      }
      if (storeId === activeStoreId) {
        setIsCheckingConnection(true);
        setConnectionStatus({ type: "idle", message: "Проверяем подключение" });
      }
      try {
        const response = await fetch(`${API_URL}/api/ozon/check`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: store.clientId.trim(),
            api_key: store.apiKey.trim(),
          }),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.detail ?? "Не удалось подключиться к Ozon");
        }
        updateStoreById(storeId, {
          status: "success",
          statusMessage: payload.message ?? "Подключение работает",
          checkedAt: new Date().toISOString(),
        });
      } catch (error) {
        const message = formatRequestError(error, "Ошибка проверки подключения");
        updateStoreById(storeId, { status: "error", statusMessage: message, checkedAt: new Date().toISOString() });
      } finally {
        if (storeId === activeStoreId) setIsCheckingConnection(false);
      }
    },
    [stores, activeStoreId, updateStoreById],
  );

  const activeStore = stores.find((store) => store.id === activeStoreId) ?? null;

  const value: AppContextValue = {
    ready,
    user,
    setUser,
    logout,
    stores,
    activeStoreId,
    activeStore,
    clientId,
    apiKey,
    connectionStatus,
    isCheckingConnection,
    selectStore,
    addStore,
    removeStore,
    handleClientIdChange,
    handleApiKeyChange,
    updateStoreTitle,
    checkStoreConnection,
    lastProcessResult,
    setLastProcessResult,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
