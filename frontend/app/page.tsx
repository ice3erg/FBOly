"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import {
  Activity,
  Archive,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronRight,
  Cloud,
  Download,
  Eye,
  EyeOff,
  FileArchive,
  FileSpreadsheet,
  History,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  MapPin,
  Plus,
  PlugZap,
  Radar,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Square,
  Store,
  Upload,
  UserPlus,
  Warehouse,
  XCircle,
  Zap,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type WarehousePercentage = {
  name: string;
  percentage: number;
  cluster_ids?: string[];
  classic_cluster_ids?: string[];
  warehouse_ids?: string[];
};

type WarehouseFile = {
  warehouse: string;
  filename: string;
  content_base64?: string;
  rows_count: number;
  total_quantity: number;
};

type ProcessingError = {
  row_number: number;
  message: string;
  input: Record<string, string | number | null>;
  diagnostics?: string[];
};

type ResolvedItem = {
  row_number: number;
  offer_id: string;
  name: string | null;
  quantity: number;
  source: string;
  sku: string | null;
};

type DraftCandidate = {
  warehouse: string;
  rows_count: number;
  total_quantity: number;
  can_create?: boolean;
  reason?: string;
  operation_id?: string | null;
  draft_id?: string | null;
  draft_status?: string | null;
  cluster_ids?: string[];
  warehouse_ids?: string[];
  selected_cluster_warehouses?: Array<{
    cluster_id?: number | string;
    macrolocal_cluster_id?: number | string;
    storage_warehouse_id?: number | string;
    warehouse_id?: number | string;
    source?: string;
  }>;
  selected_cluster_warehouses_source?: string;
  supply_type?: number | string;
  supply_mode?: "direct" | "crossdock" | string | null;
  drop_off_point_warehouse_id?: string | number | null;
  drop_off_point_warehouse_type?: string | number | null;
  draft_flow?: string | null;
  items?: Array<{
    sku: string;
    offer_id: string;
    name: string;
    quantity: number;
  }>;
};

type DraftCreationResult = {
  ok: boolean;
  warehouse: string;
  operation_id?: string | null;
  draft_id?: string | null;
  status?: string | null;
  items_count?: number | null;
  total_quantity?: number | null;
  error?: string;
  http_status?: number | null;
  endpoint?: string | null;
  ozon_response?: string | null;
  retry_after_ms?: number | null;
  is_rate_limited?: boolean | null;
  attempts_count?: number | null;
  recent_ozon_requests?: Array<{
    at: string;
    path: string;
    status: number | string;
    scope?: string;
    payload?: Record<string, unknown>;
    response_text?: string | null;
    response_headers?: Record<string, string>;
  }> | null;
  classic_cluster_ids?: string[] | number[] | null;
  cluster_ids?: string[] | number[] | null;
  warehouse_ids?: string[] | number[] | null;
  selected_cluster_warehouses?: DraftCandidate["selected_cluster_warehouses"];
  selected_cluster_warehouses_source?: string | null;
  supply_type?: number | string | null;
  supply_mode?: string | null;
  drop_off_point_warehouse_id?: string | number | null;
  drop_off_point_warehouse_type?: string | number | null;
  draft_flow?: string | null;
};

type DraftStatus = {
  type: "idle" | "success" | "error";
  message: string;
  results: DraftCreationResult[];
};

type CrossdockPoint = {
  id: string;
  name: string;
  address?: string;
  warehouse_type?: string;
  limits?: string[];
};

type DraftCreationJob = {
  id: string;
  status: string;
  next_attempt_at?: string | null;
  last_message?: string | null;
  results?: DraftCreationResult[];
  targets?: Array<{
    warehouse: string;
    status: string;
    attempts_count: number;
    next_attempt_at?: string | null;
    last_message?: string | null;
    error_message?: string | null;
    result?: DraftCreationResult | null;
  }>;
  summary?: {
    total: number;
    created: number;
    waiting: number;
    failed: number;
  };
};

type SlotHunterTarget = {
  id: string;
  warehouse: string;
  status: string;
  priority: number;
  is_priority?: boolean;
  rows_count: number;
  total_quantity: number;
  attempts_count: number;
  last_attempt_at?: string | null;
  next_attempt_at?: string | null;
  operation_id?: string | null;
  draft_id?: string | null;
  supply_operation_id?: string | null;
  supply_order_id?: string | null;
  selected_slot?: unknown;
  last_message?: string | null;
  error_message?: string | null;
};

type SlotHunterAttempt = {
  id: string;
  target_id?: string | null;
  warehouse?: string | null;
  attempt_type: string;
  status: string;
  message: string;
  http_status?: number | null;
  raw_response?: unknown;
  attempted_at: string;
};

type SlotHunterJob = {
  id: string;
  status: string;
  mode: "auto_book" | "notify_only";
  auto_book: boolean;
  interval_seconds: number;
  concurrency_limit: number;
  max_wait_until: string;
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  next_attempt_at?: string | null;
  rate_limited_until?: string | null;
  draft_phase_until?: string | null;
  last_message?: string | null;
  summary: {
    targets: number;
    booked: number;
    found: number;
    searching: number;
    failed: number;
    skipped: number;
    with_draft?: number;
    priority?: number;
    total_quantity: number;
  };
  targets: SlotHunterTarget[];
  attempts: SlotHunterAttempt[];
};

type ProcessResponse = {
  files: WarehouseFile[];
  errors: ProcessingError[];
  resolved_items: ResolvedItem[];
  total_input_quantity: number;
  total_output_quantity: number;
  api_credentials_configured?: boolean;
  archive_base64?: string;
  distribution_mode?: string;
  distribution_note?: string;
  draft_candidates?: DraftCandidate[];
};

type AppUser = {
  name: string;
  email: string;
  organization: string;
};

type OzonStore = {
  id: string;
  title: string;
  clientId: string;
  apiKey: string;
  status: "idle" | "success" | "error";
  statusMessage: string;
  checkedAt?: string | null;
};

type HistoryRecord = {
  id: string;
  fileName: string;
  createdAt: string;
  resolved: number;
  errors: number;
  totalQuantity: number;
  files: number;
};

type ConnectionStatus =
  | { type: "idle"; message: string }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

type AppView =
  | "supply"
  | "slotHunter"
  | "history"
  | "profile";

const DEFAULT_WAREHOUSES: WarehousePercentage[] = [
  { name: "Москва", percentage: 35 },
  { name: "Санкт-Петербург", percentage: 25 },
  { name: "Казань", percentage: 15 },
  { name: "Ростов", percentage: 10 },
  { name: "Екатеринбург", percentage: 10 },
  { name: "Воронеж", percentage: 5 },
];

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (typeof window !== "undefined" &&
  window.location.hostname === "localhost" &&
  window.location.port === "3000"
    ? "http://localhost:8000"
    : "");
const APP_NAME = "FBOly";
const APP_TAGLINE = "Закрываем боли селлеров";
const LOGO_SRC = "/fboly-logo.png";
const DEFAULT_USER: AppUser = {
  name: "Пользователь",
  email: "seller@example.ru",
  organization: "Мой магазин Ozon",
};
const AUTH_STORAGE_KEY = "ozon-fbo-service-user";
const CREDENTIALS_STORAGE_KEY = "ozon-fbo-service-credentials";
const STORES_STORAGE_KEY = "ozon-fbo-service-stores";
const ACTIVE_STORE_STORAGE_KEY = "ozon-fbo-service-active-store";
const HISTORY_STORAGE_KEY = "ozon-fbo-service-history";

const navItems: Array<{
  id: AppView;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: "supply", label: "Поставка", icon: Upload },
  { id: "slotHunter", label: "Слоты", icon: Radar },
  { id: "profile", label: "Магазин", icon: Store },
  { id: "history", label: "История", icon: History },
];

const FBOLY_AUTH_SESSION_KEY = "fboly-auth-session";

export default function Home() {
  const [user, setUser] = useState<AppUser>(DEFAULT_USER);
  const [activeView, setActiveView] = useState<AppView>("supply");
  const [authChecked, setAuthChecked] = useState(false);

  const [clientId, setClientId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [stores, setStores] = useState<OzonStore[]>([]);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [rememberCredentials, setRememberCredentials] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    type: "idle",
    message: "Кабинет Ozon ещё не проверен",
  });
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [warehouses, setWarehouses] =
    useState<WarehousePercentage[]>(DEFAULT_WAREHOUSES);
  const [result, setResult] = useState<ProcessResponse | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingWarehouses, setIsLoadingWarehouses] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [draftStatus, setDraftStatus] = useState<DraftStatus | null>(null);
  const [isCreatingDrafts, setIsCreatingDrafts] = useState(false);
  const draftJobFinalResultsRef = useRef<DraftCreationResult[]>([]);
  const [slotHunterJob, setSlotHunterJob] = useState<SlotHunterJob | null>(null);
  const [slotHunterError, setSlotHunterError] = useState<string | null>(null);
  const [isStartingSlotHunter, setIsStartingSlotHunter] = useState(false);
  const [isStoppingSlotHunter, setIsStoppingSlotHunter] = useState(false);
  const [history, setHistory] = useState<HistoryRecord[]>([]);

  useEffect(() => {
    // Проверяем сессию из новой страницы /auth
    const authSession = window.localStorage.getItem(FBOLY_AUTH_SESSION_KEY);
    if (!authSession) {
      window.location.href = "/auth";
      return;
    }
    try {
      const session = JSON.parse(authSession) as { email?: string; name?: string };
      if (session.email || session.name) {
        setUser({
          name: session.name || session.email?.split("@")[0] || "Пользователь",
          email: session.email || "",
          organization: "Мой магазин Ozon",
        });
      }
    } catch {
      window.localStorage.removeItem(FBOLY_AUTH_SESSION_KEY);
      window.location.href = "/auth";
      return;
    }
    setAuthChecked(true);

    const savedUser = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser) as AppUser);
      } catch {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
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
        const activeStore = validStores.find((store) => store.id === activeId);
        setClientId(activeStore?.clientId ?? "");
        setApiKey(activeStore?.apiKey ?? "");
        setConnectionStatus({
          type:
            activeStore?.status === "success"
              ? "success"
              : activeStore?.status === "error"
                ? "error"
                : "idle",
          message: activeStore?.statusMessage ?? "Выберите магазин в профиле",
        });
      } catch {
        window.localStorage.removeItem(STORES_STORAGE_KEY);
        window.localStorage.removeItem(ACTIVE_STORE_STORAGE_KEY);
      }
    } else {
      const savedCredentials = window.localStorage.getItem(CREDENTIALS_STORAGE_KEY);
      if (savedCredentials) {
        try {
          const parsed = JSON.parse(savedCredentials) as {
            clientId?: string;
            apiKey?: string;
          };
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
          setConnectionStatus({
            type: "idle",
            message: migratedStore.statusMessage,
          });
          window.localStorage.setItem(STORES_STORAGE_KEY, JSON.stringify([migratedStore]));
          window.localStorage.setItem(ACTIVE_STORE_STORAGE_KEY, migratedStore.id);
        } catch {
          window.localStorage.removeItem(CREDENTIALS_STORAGE_KEY);
        }
      }
    }

    const savedHistory = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory) as HistoryRecord[]);
      } catch {
        window.localStorage.removeItem(HISTORY_STORAGE_KEY);
      }
    }
  }, []);

  const totalPercentage = useMemo(
    () => warehouses.reduce((sum, warehouse) => sum + warehouse.percentage, 0),
    [warehouses],
  );
  const activeStore = useMemo(
    () => stores.find((store) => store.id === activeStoreId) ?? null,
    [stores, activeStoreId],
  );
  const hasWarehouseWeights = totalPercentage > 0;
  const hasFullCredentials = Boolean(clientId.trim() && apiKey.trim());

  useEffect(() => {
    if (!slotHunterJob || slotHunterJob.status !== "running") {
      return;
    }
    const timer = window.setInterval(() => {
      refreshSlotHunterJob(slotHunterJob.id);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [slotHunterJob?.id, slotHunterJob?.status]);

  function handleAuth(nextUser: AppUser) {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
    setActiveView("supply");
  }

  function logout() {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    window.localStorage.removeItem(FBOLY_AUTH_SESSION_KEY);
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(DEFAULT_USER));
    window.location.href = "/auth";
  }

  function persistStores(nextStores = stores, nextActiveStoreId = activeStoreId) {
    if (rememberCredentials) {
      window.localStorage.setItem(STORES_STORAGE_KEY, JSON.stringify(nextStores));
      if (nextActiveStoreId) {
        window.localStorage.setItem(ACTIVE_STORE_STORAGE_KEY, nextActiveStoreId);
      }
      return;
    }
    window.localStorage.removeItem(STORES_STORAGE_KEY);
    window.localStorage.removeItem(ACTIVE_STORE_STORAGE_KEY);
  }

  function saveStores(nextStores: OzonStore[], nextActiveStoreId = activeStoreId) {
    setStores(nextStores);
    setActiveStoreId(nextActiveStoreId);
    persistStores(nextStores, nextActiveStoreId);
  }

  function handleRememberChange(event: ChangeEvent<HTMLInputElement>) {
    const checked = event.target.checked;
    setRememberCredentials(checked);
    if (checked) {
      window.localStorage.setItem(STORES_STORAGE_KEY, JSON.stringify(stores));
      if (activeStoreId) {
        window.localStorage.setItem(ACTIVE_STORE_STORAGE_KEY, activeStoreId);
      }
      return;
    }
    window.localStorage.removeItem(STORES_STORAGE_KEY);
    window.localStorage.removeItem(ACTIVE_STORE_STORAGE_KEY);
    window.localStorage.removeItem(CREDENTIALS_STORAGE_KEY);
  }

  function updateStore(storeId: string, patch: Partial<OzonStore>) {
    const nextStores = stores.map((store) =>
      store.id === storeId ? { ...store, ...patch } : store,
    );
    saveStores(nextStores);
    if (storeId === activeStoreId) {
      const nextActive = nextStores.find((store) => store.id === storeId);
      setClientId(nextActive?.clientId ?? "");
      setApiKey(nextActive?.apiKey ?? "");
      setConnectionStatus({
        type:
          nextActive?.status === "success"
            ? "success"
            : nextActive?.status === "error"
              ? "error"
              : "idle",
        message: nextActive?.statusMessage ?? "Магазин выбран",
      });
    }
  }

  function addStore() {
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
    selectStore(nextStore.id, nextStores);
  }

  function selectStore(storeId: string, sourceStores = stores) {
    const store = sourceStores.find((item) => item.id === storeId);
    if (!store) {
      return;
    }
    setActiveStoreId(store.id);
    setClientId(store.clientId);
    setApiKey(store.apiKey);
    setConnectionStatus({
      type:
        store.status === "success"
          ? "success"
          : store.status === "error"
            ? "error"
            : "idle",
      message: store.statusMessage || `${store.title} выбран`,
    });
    persistStores(sourceStores, store.id);
  }

  function handleClientIdChange(value: string) {
    setClientId(value);
    if (activeStoreId) {
      updateStore(activeStoreId, {
        clientId: value,
        status: "idle",
        statusMessage: "Ключи изменены, проверьте подключение",
      });
    }
  }

  function handleApiKeyChange(value: string) {
    setApiKey(value);
    if (activeStoreId) {
      updateStore(activeStoreId, {
        apiKey: value,
        status: "idle",
        statusMessage: "Ключи изменены, проверьте подключение",
      });
    }
  }

  async function checkStoreConnection(storeId: string) {
    const store = stores.find((item) => item.id === storeId);
    if (!store?.clientId.trim() || !store.apiKey.trim()) {
      updateStore(storeId, {
        status: "error",
        statusMessage: "Введите Client ID и API Key",
      });
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
      updateStore(storeId, {
        status: "success",
        statusMessage: payload.message ?? "Подключение работает",
        checkedAt: new Date().toISOString(),
      });
      if (storeId === activeStoreId) {
        setConnectionStatus({
          type: "success",
          message: payload.message ?? "Подключение работает",
        });
      }
    } catch (error) {
      const message = formatRequestError(error, "Ошибка проверки подключения");
      updateStore(storeId, {
        status: "error",
        statusMessage: message,
        checkedAt: new Date().toISOString(),
      });
      if (storeId === activeStoreId) {
        setConnectionStatus({ type: "error", message });
      }
    } finally {
      if (storeId === activeStoreId) {
        setIsCheckingConnection(false);
      }
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] ?? null);
    setResult(null);
    setRequestError(null);
  }

  function updateWarehousePercentage(index: number, value: string) {
    const nextValue = Number(value);
    setWarehouses((current) =>
      current.map((warehouse, warehouseIndex) =>
        warehouseIndex === index
          ? { ...warehouse, percentage: Number.isFinite(nextValue) ? nextValue : 0 }
          : warehouse,
      ),
    );
  }

  function updateWarehouseName(index: number, value: string) {
    setWarehouses((current) =>
      current.map((warehouse, warehouseIndex) =>
        warehouseIndex === index
          ? { ...warehouse, name: value }
          : warehouse,
      ),
    );
  }

  function addWarehouse() {
    setWarehouses((current) => [
      ...current,
      { name: `Новый город ${current.length + 1}`, percentage: 0 },
    ]);
  }

  function removeWarehouse(index: number) {
    setWarehouses((current) =>
      current.length > 1
        ? current.filter((_, warehouseIndex) => warehouseIndex !== index)
        : current,
    );
  }

  function resetWarehouses() {
    setWarehouses(DEFAULT_WAREHOUSES);
  }

  async function loadOzonWarehouses() {
    if (!hasFullCredentials) {
      setRequestError("Выберите магазин с Client ID и API Key в профиле.");
      return;
    }

    setIsLoadingWarehouses(true);
    setRequestError(null);
    try {
      const response = await fetch(`${API_URL}/api/ozon/warehouses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId.trim(),
          api_key: apiKey.trim(),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail ?? "Не удалось загрузить склады Ozon");
      }
      setWarehouses(Array.isArray(payload.warehouses) ? payload.warehouses : DEFAULT_WAREHOUSES);
    } catch (error) {
      setRequestError(formatRequestError(error, "Ошибка загрузки складов"));
    } finally {
      setIsLoadingWarehouses(false);
    }
  }

  async function checkConnection() {
    if (activeStoreId) {
      await checkStoreConnection(activeStoreId);
      return;
    }
    if (!hasFullCredentials) {
      setConnectionStatus({
        type: "error",
        message: "Введите Client-Id и Api-Key",
      });
      return;
    }

    setIsCheckingConnection(true);
    setConnectionStatus({ type: "idle", message: "Проверяем доступ к Ozon" });

    try {
      const response = await fetch(`${API_URL}/api/ozon/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId.trim(),
          api_key: apiKey.trim(),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail ?? "Не удалось подключиться к Ozon API");
      }
      setConnectionStatus({
        type: "success",
        message: payload.message ?? "Подключение работает",
      });
    } catch (error) {
      setConnectionStatus({
        type: "error",
        message: formatRequestError(error, "Ошибка проверки подключения"),
      });
    } finally {
      setIsCheckingConnection(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile || !hasWarehouseWeights) {
      return;
    }
    if (!hasFullCredentials) {
      setRequestError("Выберите магазин с Client ID и API Key в профиле.");
      return;
    }

    persistStores();
    setIsLoading(true);
    setResult(null);
    setRequestError(null);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("warehouse_percentages", JSON.stringify(warehouses));
    if (clientId.trim()) {
      formData.append("ozon_client_id", clientId.trim());
    }
    if (apiKey.trim()) {
      formData.append("ozon_api_key", apiKey.trim());
    }

    try {
      const response = await fetch(`${API_URL}/api/process`, {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail ?? "Не удалось обработать файл");
      }
      const processResult = payload as ProcessResponse;
      setResult(processResult);
      setDraftStatus(null);
      addHistoryRecord(processResult, selectedFile.name);
      setActiveView("supply");
    } catch (error) {
      setRequestError(formatRequestError(error, "Ошибка обработки"));
    } finally {
      setIsLoading(false);
    }
  }

  function addHistoryRecord(processResult: ProcessResponse, fileName: string) {
    const record: HistoryRecord = {
      id: `${Date.now()}`,
      fileName,
      createdAt: new Date().toISOString(),
      resolved: processResult.resolved_items.length,
      errors: processResult.errors.length,
      totalQuantity: processResult.total_output_quantity,
      files: processResult.files.length,
    };
    const nextHistory = [record, ...history].slice(0, 20);
    setHistory(nextHistory);
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
  }

  async function downloadZip() {
    if (!result) {
      return;
    }

    setIsZipping(true);
    try {
      if (result.archive_base64) {
        downloadBlob(
          new Blob([base64ToUint8Array(result.archive_base64)], {
            type: "application/zip",
          }),
          "Ozon_FBO_warehouses.zip",
        );
        return;
      }

      const zip = new JSZip();
      result.files.forEach((file) => {
        if (file.content_base64) {
          zip.file(file.filename, base64ToUint8Array(file.content_base64));
        }
      });
      const blob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
      });
      downloadBlob(blob, "Ozon_FBO_warehouses.zip");
    } finally {
      setIsZipping(false);
    }
  }

  function downloadSingleFile(file: WarehouseFile) {
    if (!file.content_base64) {
      return;
    }
    downloadBlob(
      new Blob([base64ToUint8Array(file.content_base64)], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      file.filename,
    );
  }

  async function createOzonDrafts(candidates: DraftCandidate[]) {
    if (!candidates.length) {
      setDraftStatus({
        type: "error",
        message: "Выберите хотя бы один город для создания черновика.",
        results: [],
      });
      return;
    }
    if (!hasFullCredentials) {
      setDraftStatus({
        type: "error",
        message: "Введите Client-Id и Api-Key Ozon.",
        results: [],
      });
      return;
    }

    const totalQuantity = candidates.reduce(
      (sum, candidate) => sum + Number(candidate.total_quantity || 0),
      0,
    );
    const approved = window.confirm(
      `Создать ${candidates.length} черновик(а) FBO в Ozon на ${totalQuantity} шт.?`,
    );
    if (!approved) {
      return;
    }

    setIsCreatingDrafts(true);
    draftJobFinalResultsRef.current = [];
    setDraftStatus({
      type: "idle",
      message: `Ставим в очередь ${candidates.length} город(а). Backend будет ждать лимиты Ozon сам.`,
      results: [],
    });

    try {
      const response = await fetch(`${API_URL}/api/ozon/draft-jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId.trim(),
          api_key: apiKey.trim(),
          candidates,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail ?? "Не удалось поставить черновики в очередь");
      }

      let job = payload as DraftCreationJob;
      for (;;) {
        const isFinalJob = ["completed", "failed", "stopped"].includes(job.status);
        const visibleResults = draftJobToResults(job, isFinalJob);
        mergeDraftCreationResults(visibleResults.filter((item) => item.ok && item.draft_id));
        setDraftStatus({
          type: ["completed"].includes(job.status)
            ? "success"
            : ["failed", "stopped"].includes(job.status)
              ? "error"
              : "idle",
          message: formatDraftJobMessage(job),
          results: visibleResults,
        });

        if (isFinalJob) break;
        await delay(5000);
        const pollResponse = await fetch(`${API_URL}/api/ozon/draft-jobs/${job.id}`);
        const pollPayload = await pollResponse.json();
        if (!pollResponse.ok) {
          throw new Error(pollPayload.detail ?? "Не удалось обновить статус очереди черновиков");
        }
        job = pollPayload as DraftCreationJob;
      }
    } catch (error) {
      setDraftStatus({
        type: "error",
        message: formatRequestError(error, "Ошибка создания черновиков"),
        results: [],
      });
    } finally {
      setIsCreatingDrafts(false);
    }
  }

  async function searchCrossdockPoints(search: string): Promise<CrossdockPoint[]> {
    if (!hasFullCredentials) {
      throw new Error("Сначала подключите Ozon API в профиле.");
    }
    const response = await fetch(`${API_URL}/api/ozon/fbo-warehouses/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId.trim(),
        api_key: apiKey.trim(),
        search,
        supply_type: "CREATE_TYPE_CROSSDOCK",
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.detail ?? "Не удалось найти точки кросс-докинга");
    }
    return Array.isArray(payload.points) ? payload.points : [];
  }

  function draftJobToResults(job: DraftCreationJob, includePending = false): DraftCreationResult[] {
    const finalResults = (job.targets ?? [])
      .map((target) => target.result)
      .filter(Boolean) as DraftCreationResult[];
    if (finalResults.length) draftJobFinalResultsRef.current = finalResults;

    if (!includePending) {
      return finalResults.length ? finalResults : draftJobFinalResultsRef.current;
    }

    const fromTargets = (job.targets ?? [])
      .map((target) => {
        if (target.result) return target.result;
        if (["waiting", "creating", "cooldown"].includes(target.status)) {
          return {
            ok: false,
            warehouse: target.warehouse,
            error: target.last_message || "В очереди создания",
            attempts_count: target.attempts_count,
            retry_after_ms: target.next_attempt_at
              ? Math.max(0, new Date(target.next_attempt_at).getTime() - Date.now())
              : null,
            is_rate_limited: target.status === "cooldown",
          } satisfies DraftCreationResult;
        }
        return null;
      })
      .filter(Boolean) as DraftCreationResult[];
    return fromTargets.length ? fromTargets : (job.results ?? []);
  }

  function formatDraftJobMessage(job: DraftCreationJob) {
    const summary = job.summary;
    const prefix = summary
      ? `Создано ${summary.created} из ${summary.total}. `
      : "";
    const next = job.next_attempt_at
      ? ` Следующая попытка: ${formatDateTime(job.next_attempt_at)}.`
      : "";
    if (job.status === "completed") {
      return "API-черновики созданы. Следующий шаг — подобрать слот и создать заявку поставки.";
    }
    if (job.status === "failed") {
      return `${prefix}${job.last_message || "Часть черновиков не создалась."}`;
    }
    if (job.status === "stopped") {
      return job.last_message || "Очередь остановлена.";
    }
    return `${prefix}${job.last_message || "Очередь создания черновиков работает."}${next}`;
  }

  function mergeDraftCreationResults(draftResults: DraftCreationResult[]) {
    const successfulByWarehouse = new Map(
      draftResults
        .filter((item) => item.ok && item.draft_id)
        .map((item) => [normalizeKey(item.warehouse), item]),
    );
    if (!successfulByWarehouse.size) return;
    setResult((current) => {
      if (!current) return current;
      return {
        ...current,
        draft_candidates: (current.draft_candidates ?? []).map((candidate) => {
          const match = successfulByWarehouse.get(normalizeKey(candidate.warehouse));
          if (!match) return candidate;
          return {
            ...candidate,
            draft_id: match.draft_id ?? candidate.draft_id ?? null,
            operation_id: match.operation_id ?? candidate.operation_id ?? null,
            draft_status: match.status ?? candidate.draft_status ?? null,
            warehouse_ids: match.warehouse_ids?.map(String) ?? candidate.warehouse_ids,
            draft_flow: match.draft_flow ?? candidate.draft_flow ?? null,
            supply_mode: match.supply_mode ?? candidate.supply_mode ?? null,
            drop_off_point_warehouse_id:
              match.drop_off_point_warehouse_id ??
              candidate.drop_off_point_warehouse_id ??
              null,
            selected_cluster_warehouses:
              match.selected_cluster_warehouses ??
              candidate.selected_cluster_warehouses,
            selected_cluster_warehouses_source:
              match.selected_cluster_warehouses_source ??
              candidate.selected_cluster_warehouses_source,
            supply_type: match.supply_type ?? candidate.supply_type,
          };
        }),
      };
    });
  }

  async function startSlotHunter(settings: {
    auto_book: boolean;
    interval_seconds: number;
    max_minutes: number;
    concurrency_limit: number;
    date_from?: string;
    date_to?: string;
    time_from?: string;
    time_to?: string;
    cargo_type?: "any" | "box" | "pallet";
    smart_speed?: boolean;
    selected_warehouses?: string[];
    priority_warehouses?: string[];
    draft_ids_by_warehouse?: Record<string, string>;
  }) {
    const selectedWarehouses = new Set((settings.selected_warehouses ?? []).map(normalizeKey));
    const candidates = (result?.draft_candidates ?? []).filter(
      (candidate) => candidate.can_create !== false,
    ).filter(
      (candidate) => !selectedWarehouses.size || selectedWarehouses.has(normalizeKey(candidate.warehouse)),
    ).map((candidate) => {
      const manualDraftId = settings.draft_ids_by_warehouse?.[candidate.warehouse]?.trim();
      return manualDraftId ? { ...candidate, draft_id: manualDraftId } : candidate;
    });
    if (!result || !candidates.length) {
      setSlotHunterError(
        "Сначала рассчитайте поставку, чтобы появились города и SKU для поиска слотов.",
      );
      return;
    }
    if (!hasFullCredentials) {
      setSlotHunterError("Введите Client-Id и Api-Key Ozon.");
      return;
    }

    const totalQuantity = candidates.reduce(
      (sum, candidate) => sum + Number(candidate.total_quantity || 0),
      0,
    );
    const existingDrafts = candidates.filter((candidate) => candidate.draft_id).length;
    const priorityCount = (settings.priority_warehouses ?? []).filter((warehouse) =>
      candidates.some((candidate) => normalizeKey(candidate.warehouse) === normalizeKey(warehouse)),
    ).length;
    const approved = window.confirm(
      settings.auto_book
        ? `Запустить охотника и автоматически бронировать найденные слоты для ${candidates.length} городов на ${totalQuantity} шт.? Готовых API-черновиков: ${existingDrafts}. Приоритетных городов: ${priorityCount}.`
        : `Запустить охотника в режиме уведомления для ${candidates.length} городов на ${totalQuantity} шт.? Готовых API-черновиков: ${existingDrafts}. Приоритетных городов: ${priorityCount}.`,
    );
    if (!approved) {
      return;
    }

    setIsStartingSlotHunter(true);
    setSlotHunterError(null);
    try {
      const response = await fetch(`${API_URL}/api/slot-hunter/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId.trim(),
          api_key: apiKey.trim(),
          candidates,
          settings,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail ?? "Не удалось запустить охотника на слоты");
      }
      setSlotHunterJob(payload as SlotHunterJob);
    } catch (error) {
      setSlotHunterError(formatRequestError(error, "Ошибка запуска охотника"));
    } finally {
      setIsStartingSlotHunter(false);
    }
  }

  async function refreshSlotHunterJob(jobId = slotHunterJob?.id) {
    if (!jobId) {
      return;
    }
    try {
      const response = await fetch(`${API_URL}/api/slot-hunter/jobs/${jobId}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail ?? "Не удалось обновить статус охотника");
      }
      setSlotHunterJob(payload as SlotHunterJob);
      setSlotHunterError(null);
    } catch (error) {
      setSlotHunterError(formatRequestError(error, "Ошибка обновления охотника"));
    }
  }

  async function stopSlotHunter() {
    if (!slotHunterJob) {
      return;
    }
    setIsStoppingSlotHunter(true);
    try {
      const response = await fetch(
        `${API_URL}/api/slot-hunter/jobs/${slotHunterJob.id}/stop`,
        { method: "POST" },
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail ?? "Не удалось остановить охотника");
      }
      setSlotHunterJob(payload as SlotHunterJob);
      setSlotHunterError(null);
    } catch (error) {
      setSlotHunterError(formatRequestError(error, "Ошибка остановки охотника"));
    } finally {
      setIsStoppingSlotHunter(false);
    }
  }

  if (!authChecked) return null;

  return (
    <main className="min-h-screen overflow-hidden">
      <div className="mx-auto grid min-h-screen max-w-[1720px] lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex border-b border-white/[0.08] bg-[#080810]/80 px-4 py-4 backdrop-blur-2xl lg:min-h-screen lg:flex-col lg:border-b-0 lg:border-r lg:px-3 lg:py-5">
          <div className="flex w-full items-center justify-between gap-4 lg:block">
            <BrandMark compact />
          </div>

          <nav className="mt-0 hidden flex-1 space-y-2 lg:mt-10 lg:block">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-[15px] font-medium transition",
                    isActive
                      ? "bg-gradient-to-r from-primary/35 to-primary/15 text-white shadow-[0_0_34px_rgba(124,58,237,0.16)] ring-1 ring-primary/25"
                      : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto hidden lg:block" />
        </aside>

        <section className="min-w-0 px-4 py-5 lg:px-8 lg:py-6">
          {activeView === "supply" && (
            <SupplyView
              stores={stores}
              activeStore={activeStore}
              activeStoreId={activeStoreId}
              connectionStatus={connectionStatus}
              selectedFile={selectedFile}
              warehouses={warehouses}
              result={result}
              requestError={requestError}
              isLoading={isLoading}
              isLoadingWarehouses={isLoadingWarehouses}
              isZipping={isZipping}
              totalPercentage={totalPercentage}
              hasWarehouseWeights={hasWarehouseWeights}
              hasFullCredentials={hasFullCredentials}
              onSelectStore={selectStore}
              onOpenProfile={() => setActiveView("profile")}
              onFileChange={handleFileChange}
              onWarehouseNameChange={updateWarehouseName}
              onWarehousePercentageChange={updateWarehousePercentage}
              onAddWarehouse={addWarehouse}
              onRemoveWarehouse={removeWarehouse}
              onResetWarehouses={resetWarehouses}
              onLoadOzonWarehouses={loadOzonWarehouses}
              onSubmit={handleSubmit}
              onDownloadZip={downloadZip}
              onDownloadSingleFile={downloadSingleFile}
              onCreateOzonDrafts={createOzonDrafts}
              onSearchCrossdockPoints={searchCrossdockPoints}
              onOpenSlotHunter={() => setActiveView("slotHunter")}
              draftStatus={draftStatus}
              isCreatingDrafts={isCreatingDrafts}
            />
          )}
          {activeView === "slotHunter" && (
            <SlotHunterView
              result={result}
              job={slotHunterJob}
              error={slotHunterError}
              hasFullCredentials={hasFullCredentials}
              connectionStatus={connectionStatus}
              isStarting={isStartingSlotHunter}
              isStopping={isStoppingSlotHunter}
              onStart={startSlotHunter}
              onStop={stopSlotHunter}
              onRefresh={() => refreshSlotHunterJob()}
              onOpenSupply={() => setActiveView("supply")}
              onOpenProfile={() => setActiveView("profile")}
            />
          )}
          {activeView === "history" && <HistoryView history={history} />}
          {activeView === "profile" && (
            <ProfileView
              stores={stores}
              activeStoreId={activeStoreId}
              rememberCredentials={rememberCredentials}
              showApiKey={showApiKey}
              isCheckingConnection={isCheckingConnection}
              onRememberChange={handleRememberChange}
              onShowApiKeyChange={() => setShowApiKey((current) => !current)}
              onAddStore={addStore}
              onSelectStore={selectStore}
              onUpdateStore={updateStore}
              onCheckStore={checkStoreConnection}
            />
          )}
        </section>
      </div>
    </main>
  );
}

function LogoIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative block shrink-0 overflow-hidden rounded-xl bg-[#090814] shadow-[0_0_28px_rgba(124,58,237,0.32)]",
        className,
      )}
    >
      <img
        src={LOGO_SRC}
        alt=""
        aria-hidden="true"
        className="absolute -top-[21%] left-1/2 h-[178%] w-[178%] max-w-none -translate-x-1/2 object-cover"
      />
    </span>
  );
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <LogoIcon className={compact ? "h-11 w-11" : "h-14 w-14"} />
      <div>
        <div className={cn("font-semibold leading-none", compact ? "text-2xl" : "text-3xl")}>
          FBO<span className="text-primary">ly</span>
        </div>
        {!compact && (
          <div className="mt-1 text-sm text-muted-foreground">{APP_TAGLINE}</div>
        )}
      </div>
    </div>
  );
}

function ConnectStorePrompt({
  hasFullCredentials,
  connectionStatus,
  onOpenProfile,
}: {
  hasFullCredentials: boolean;
  connectionStatus: ConnectionStatus;
  onOpenProfile: () => void;
}) {
  // Ключи введены, но проверка не прошла (ошибка или ещё не проверяли)
  const credentialsButNotVerified = hasFullCredentials && connectionStatus.type !== "success";

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-6 px-6 py-14 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-[0_0_40px_rgba(124,58,237,0.4)]">
          <PlugZap className="h-10 w-10" />
        </div>
        <div className="max-w-md space-y-2">
          <h2 className="text-2xl font-semibold">
            {credentialsButNotVerified ? "Проверьте подключение магазина" : "Сначала подключите магазин Ozon"}
          </h2>
          <p className="text-muted-foreground">
            {credentialsButNotVerified
              ? connectionStatus.type === "error"
                ? `Ozon не принял ключи: ${connectionStatus.message}. Проверьте Client-Id и Api-Key в разделе «Магазин».`
                : "Ключи введены, но подключение ещё не подтверждено. Нажмите «Проверить подключение» в разделе «Магазин»."
              : "Чтобы загружать поставки, создавать черновики и ловить слоты, FBOly нужен доступ к вашему магазину через Ozon Seller API."}
          </p>
        </div>

        {!hasFullCredentials && (
          <div className="w-full max-w-md space-y-3 rounded-xl border border-border/60 bg-muted/30 p-5 text-left">
            <div className="flex items-center gap-2 text-sm font-medium">
              <KeyRound className="h-4 w-4 text-primary" />
              Что понадобится
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>Client-Id и Api-Key из личного кабинета Ozon Seller (Настройки → API-ключи)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>Метод доступа: Admin read-only, Product, Warehouse, Report</span>
              </li>
            </ul>
          </div>
        )}

        <Button size="lg" onClick={onOpenProfile} className="gap-2">
          <Store className="h-4 w-4" />
          {hasFullCredentials ? "Перейти в раздел «Магазин»" : "Подключить магазин"}
          <ArrowRight className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Ключи хранятся только в вашем браузере и не передаются третьим лицам
        </div>
      </CardContent>
    </Card>
  );
}

function SupplyView({
  stores,
  activeStore,
  activeStoreId,
  connectionStatus,
  selectedFile,
  warehouses,
  result,
  requestError,
  isLoading,
  isLoadingWarehouses,
  isZipping,
  draftStatus,
  isCreatingDrafts,
  totalPercentage,
  hasWarehouseWeights,
  hasFullCredentials,
  onSelectStore,
  onOpenProfile,
  onFileChange,
  onWarehouseNameChange,
  onWarehousePercentageChange,
  onAddWarehouse,
  onRemoveWarehouse,
  onResetWarehouses,
  onLoadOzonWarehouses,
  onSubmit,
  onDownloadZip,
  onDownloadSingleFile,
  onCreateOzonDrafts,
  onSearchCrossdockPoints,
  onOpenSlotHunter,
}: {
  stores: OzonStore[];
  activeStore: OzonStore | null;
  activeStoreId: string | null;
  connectionStatus: ConnectionStatus;
  selectedFile: File | null;
  warehouses: WarehousePercentage[];
  result: ProcessResponse | null;
  requestError: string | null;
  isLoading: boolean;
  isLoadingWarehouses: boolean;
  isZipping: boolean;
  draftStatus: DraftStatus | null;
  isCreatingDrafts: boolean;
  totalPercentage: number;
  hasWarehouseWeights: boolean;
  hasFullCredentials: boolean;
  onSelectStore: (storeId: string) => void;
  onOpenProfile: () => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onWarehouseNameChange: (index: number, value: string) => void;
  onWarehousePercentageChange: (index: number, value: string) => void;
  onAddWarehouse: () => void;
  onRemoveWarehouse: (index: number) => void;
  onResetWarehouses: () => void;
  onLoadOzonWarehouses: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDownloadZip: () => void;
  onDownloadSingleFile: (file: WarehouseFile) => void;
  onCreateOzonDrafts: (candidates: DraftCandidate[]) => void;
  onSearchCrossdockPoints: (search: string) => Promise<CrossdockPoint[]>;
  onOpenSlotHunter: () => void;
}) {
  const isStoreConnected = hasFullCredentials && connectionStatus.type === "success";

  // Магазин не подключён — показываем приглашение, а не формы
  if (!isStoreConnected) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-4xl font-semibold tracking-normal">Поставка</h1>
          <p className="mt-2 max-w-3xl text-lg text-muted-foreground">
            Выберите магазин, загрузите Excel, создайте черновики в Ozon и переходите к поиску слота.
          </p>
        </div>
        <ConnectStorePrompt
          hasFullCredentials={hasFullCredentials}
          connectionStatus={connectionStatus}
          onOpenProfile={onOpenProfile}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-normal">Поставка</h1>
          <p className="mt-2 max-w-3xl text-lg text-muted-foreground">
            Выберите магазин, загрузите Excel, создайте черновики в Ozon и переходите к поиску слота.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onOpenProfile} className="gap-2">
            <Store className="h-4 w-4" />
            Магазин
          </Button>
          {result && (
            <Button type="button" onClick={onOpenSlotHunter} className="gap-2">
              <Radar className="h-4 w-4" />
              К слотам
            </Button>
          )}
        </div>
      </div>

      <StoreSelectorCard
        stores={stores}
        activeStore={activeStore}
        activeStoreId={activeStoreId}
        connectionStatus={connectionStatus}
        hasFullCredentials={hasFullCredentials}
        onSelectStore={onSelectStore}
        onOpenProfile={onOpenProfile}
      />

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-white/[0.08] bg-white/[0.025]">
          <div className="flex items-center gap-3">
            <StepBadge value="1" />
            <div>
              <CardTitle>Загрузите Excel файл</CardTitle>
              <CardDescription>
                FBOly сам найдёт товары, посчитает кластеры и подготовит черновики.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          <form className="space-y-5" onSubmit={onSubmit}>
            <label className="group flex min-h-60 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-primary/45 bg-gradient-to-b from-primary/12 to-white/[0.025] px-5 py-10 text-center transition hover:border-primary/75 hover:bg-primary/15">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-white shadow-[0_0_34px_rgba(124,58,237,0.38)]">
                <Upload className="h-8 w-8" />
              </div>
              <span className="max-w-full truncate text-xl font-semibold">
                {selectedFile
                  ? selectedFile.name
                  : "Перетащите Excel сюда или выберите файл"}
              </span>
              <span className="mt-3 max-w-xl text-sm text-muted-foreground">
                Колонки: SKU Ozon, артикул, название товара, количество
              </span>
              <input
                className="sr-only"
                type="file"
                accept=".xlsx,.xls"
                onChange={onFileChange}
              />
            </label>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={downloadInputTemplate}
                className="w-fit gap-2 text-primary"
              >
                <Download className="h-4 w-4" />
                Скачать шаблон Excel
              </Button>
              <Button
                type="submit"
                disabled={
                  !selectedFile ||
                  !hasWarehouseWeights ||
                  !hasFullCredentials ||
                  isLoading
                }
                size="lg"
                className="h-12 min-w-[220px] gap-2"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" />
                )}
                Распределить товары
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="border-b border-white/[0.08] bg-white/[0.025]">
            <div className="flex items-center gap-3">
              <StepBadge value="2" />
              <div>
                <CardTitle>Результат распределения</CardTitle>
                <CardDescription>
                  Проверьте итог и выберите кластеры для черновиков.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <div className="grid gap-3 md:grid-cols-4">
              <MetricTile label="Товаров" value={String(result.resolved_items.length)} tone="green" />
              <MetricTile label="Ошибок" value={String(result.errors.length)} tone="amber" />
              <MetricTile label="Кластеров" value={String(result.files.length)} tone="blue" />
              <MetricTile label="Итого" value={`${result.total_output_quantity} шт.`} tone="green" />
            </div>
            <div className="rounded-lg border border-primary/25 bg-primary/10 p-4 text-sm leading-relaxed text-purple-100">
              {buildDistributionExplanation(result)}
            </div>
          </CardContent>
        </Card>
      )}

      <details className="rounded-lg border border-white/[0.08] bg-white/[0.035] p-4 text-sm">
        <summary className="cursor-pointer list-none font-medium">
          Дополнительно: настройки распределения
        </summary>
        <p className="mt-2 text-sm text-muted-foreground">
          Обычно менять не нужно: сервис сам распределит товары по кластерам Ozon.
        </p>
        <div className="mt-4 space-y-4">
          {warehouses.map((warehouse, index) => (
            <div
              key={`${warehouse.name}-${index}`}
              className="grid grid-cols-[minmax(0,1fr)_92px_40px] items-end gap-3"
            >
              <div className="min-w-0">
                <Label htmlFor={`warehouse-name-${index}`}>Город или кластер</Label>
                <Input
                  id={`warehouse-name-${index}`}
                  value={warehouse.name}
                  onChange={(event) =>
                    onWarehouseNameChange(index, event.target.value)
                  }
                  placeholder="Например, Воронеж"
                />
                <div className="mt-2 h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-secondary"
                    style={{
                      width: `${Math.min(Math.max(warehouse.percentage, 0), 100)}%`,
                    }}
                  />
                </div>
              </div>
              <div className="relative">
                <Label htmlFor={`warehouse-percent-${index}`}>Вес</Label>
                <Input
                  id={`warehouse-percent-${index}`}
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={warehouse.percentage}
                  onChange={(event) =>
                    onWarehousePercentageChange(index, event.target.value)
                  }
                  className="pr-8"
                />
                <span className="pointer-events-none absolute right-3 top-8 text-sm text-muted-foreground">
                  %
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemoveWarehouse(index)}
                disabled={warehouses.length <= 1}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Удалить направление"
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
            Сервис будет распределять и создавать черновики только по этому списку. Сумма весов: {Math.round(totalPercentage * 100) / 100}%
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onAddWarehouse} className="gap-2">
              <Plus className="h-4 w-4" />
              Добавить город
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onLoadOzonWarehouses}
              disabled={isLoadingWarehouses || !hasFullCredentials}
              className="gap-2"
            >
              {isLoadingWarehouses ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Building2 className="h-4 w-4" />
              )}
              Загрузить города Ozon
            </Button>
            <Button type="button" variant="ghost" onClick={onResetWarehouses} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Вернуть крупные города
            </Button>
          </div>
        </div>
      </details>

      {requestError && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Ошибка обработки</AlertTitle>
          <AlertDescription>{requestError}</AlertDescription>
        </Alert>
      )}

      {result ? (
        <ResultPanel
          result={result}
          onDownloadZip={onDownloadZip}
          onDownloadSingleFile={onDownloadSingleFile}
          isZipping={isZipping}
          onCreateOzonDrafts={onCreateOzonDrafts}
          onSearchCrossdockPoints={onSearchCrossdockPoints}
          onOpenSlotHunter={onOpenSlotHunter}
          draftStatus={draftStatus}
          isCreatingDrafts={isCreatingDrafts}
        />
      ) : (
        <Card>
          <CardContent className="p-5">
            <EmptyState
              icon={FileArchive}
              title="Результат появится здесь"
              text="После обработки FBOly покажет кластеры, Excel-файлы и кнопку создания черновиков."
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StoreSelectorCard({
  stores,
  activeStore,
  activeStoreId,
  connectionStatus,
  hasFullCredentials,
  onSelectStore,
  onOpenProfile,
}: {
  stores: OzonStore[];
  activeStore: OzonStore | null;
  activeStoreId: string | null;
  connectionStatus: ConnectionStatus;
  hasFullCredentials: boolean;
  onSelectStore: (storeId: string) => void;
  onOpenProfile: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col gap-3 border-b border-white/[0.08] bg-white/[0.025] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Магазин</CardTitle>
            <CardDescription>
              Сначала выберите кабинет Ozon, для которого готовим поставку.
            </CardDescription>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={onOpenProfile} className="gap-2">
          <Settings className="h-4 w-4" />
          Настроить
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        {stores.length ? (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="space-y-2">
              <Label htmlFor="supply-store-select">Активный магазин</Label>
              <select
                id="supply-store-select"
                value={activeStoreId ?? ""}
                onChange={(event) => onSelectStore(event.target.value)}
                className="h-11 w-full rounded-lg border border-white/[0.10] bg-[#101019] px-3 text-sm text-foreground outline-none transition focus:border-primary/70 focus:ring-2 focus:ring-primary/35"
              >
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.title || "Магазин Ozon"} {store.status === "success" ? "· подключён" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-sm">
              <div className="font-medium">{activeStore?.title || "Магазин не выбран"}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {activeStore?.clientId ? `Client ID: ${activeStore.clientId}` : "Client ID не указан"}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
            Добавьте магазин в профиле, чтобы начать работу.
          </div>
        )}

        <div
          className={cn(
            "rounded-lg border p-3 text-sm",
            connectionStatus.type === "success" &&
              "border-secondary/30 bg-secondary/10 text-purple-100",
            connectionStatus.type === "error" &&
              "border-destructive/30 bg-destructive/10 text-destructive",
            connectionStatus.type === "idle" && "bg-muted/40 text-muted-foreground",
          )}
        >
          {activeStore
            ? connectionStatus.message
            : "Активный магазин не выбран"}
        </div>

        {!hasFullCredentials && (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
            Чтобы Ozon нашёл товары и склады, у активного магазина должны быть Client ID и API Key.
          </div>
        )}

      </CardContent>
    </Card>
  );
}

function ProfileView({
  stores,
  activeStoreId,
  rememberCredentials,
  showApiKey,
  isCheckingConnection,
  onRememberChange,
  onShowApiKeyChange,
  onAddStore,
  onSelectStore,
  onUpdateStore,
  onCheckStore,
}: {
  stores: OzonStore[];
  activeStoreId: string | null;
  rememberCredentials: boolean;
  showApiKey: boolean;
  isCheckingConnection: boolean;
  onRememberChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onShowApiKeyChange: () => void;
  onAddStore: () => void;
  onSelectStore: (storeId: string) => void;
  onUpdateStore: (storeId: string, patch: Partial<OzonStore>) => void;
  onCheckStore: (storeId: string) => void;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-normal">Магазин</h1>
            <p className="mt-2 text-lg text-muted-foreground">
              Подключите один или несколько кабинетов Ozon.
            </p>
          </div>
          <Button type="button" onClick={onAddStore} className="gap-2">
            <Plus className="h-4 w-4" />
            Добавить магазин
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-6 w-6 text-primary" />
                Подключённые магазины
              </CardTitle>
              <CardDescription>
                Для каждого магазина хранится свой Client ID и API Key.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={rememberCredentials}
                onChange={onRememberChange}
                className="h-4 w-4 rounded border-input"
              />
              Сохранить магазины и ключи в этом браузере
            </label>

            {stores.length ? (
              <div className="space-y-3">
                {stores.map((store) => {
                  const isActive = store.id === activeStoreId;
                  return (
                    <div
                      key={store.id}
                      className={cn(
                        "rounded-lg border p-4",
                        isActive
                          ? "border-primary/60 bg-primary/10"
                          : "border-white/10 bg-white/[0.03]",
                      )}
                    >
                      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-semibold">
                              {store.title || "Магазин Ozon"}
                            </div>
                            {isActive && <Badge variant="secondary">активный</Badge>}
                            <Badge
                              variant={
                                store.status === "success"
                                  ? "secondary"
                                  : store.status === "error"
                                    ? "destructive"
                                    : "outline"
                              }
                            >
                              {store.status === "success"
                                ? "подключен"
                                : store.status === "error"
                                  ? "ошибка"
                                  : "не проверен"}
                            </Badge>
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            Последняя проверка:{" "}
                            {store.checkedAt ? formatDate(store.checkedAt) : "ещё не было"}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => onCheckStore(store.id)}
                            disabled={isCheckingConnection && isActive}
                            className="gap-2"
                          >
                            {isCheckingConnection && isActive ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ShieldCheck className="h-4 w-4" />
                            )}
                            Проверить подключение
                          </Button>
                          <Button
                            type="button"
                            variant={isActive ? "secondary" : "outline"}
                            onClick={() => onSelectStore(store.id)}
                            disabled={isActive}
                          >
                            {isActive ? "Выбран" : "Сделать активным"}
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-3 lg:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor={`store-title-${store.id}`}>
                            Название магазина
                          </Label>
                          <Input
                            id={`store-title-${store.id}`}
                            value={store.title}
                            onChange={(event) =>
                              onUpdateStore(store.id, { title: event.target.value })
                            }
                            placeholder="DENOMADE"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`store-client-${store.id}`}>Client ID</Label>
                          <Input
                            id={`store-client-${store.id}`}
                            value={store.clientId}
                            onChange={(event) =>
                              onUpdateStore(store.id, {
                                clientId: event.target.value,
                                status: "idle",
                                statusMessage: "Ключи изменены, проверьте подключение",
                              })
                            }
                            placeholder="1356873"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`store-key-${store.id}`}>API Key</Label>
                          <div className="flex gap-2">
                            <Input
                              id={`store-key-${store.id}`}
                              type={showApiKey ? "text" : "password"}
                              value={store.apiKey}
                              onChange={(event) =>
                                onUpdateStore(store.id, {
                                  apiKey: event.target.value,
                                  status: "idle",
                                  statusMessage:
                                    "Ключи изменены, проверьте подключение",
                                })
                              }
                              placeholder="cb1..."
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={onShowApiKeyChange}
                              aria-label={showApiKey ? "Скрыть API Key" : "Показать API Key"}
                            >
                              {showApiKey ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div
                        className={cn(
                          "mt-4 rounded-lg border p-3 text-sm",
                          store.status === "success" &&
                            "border-secondary/30 bg-secondary/10 text-purple-100",
                          store.status === "error" &&
                            "border-destructive/30 bg-destructive/10 text-destructive",
                          store.status === "idle" && "bg-muted/40 text-muted-foreground",
                        )}
                      >
                        {store.statusMessage}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={Store}
                title="Магазины ещё не добавлены"
                text="Добавьте магазин, укажите Client ID и API Key, затем проверьте подключение."
              />
            )}
          </CardContent>
        </Card>
      </section>

      <aside className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Какие роли нужны</CardTitle>
            <CardDescription>Минимум для комфортной работы</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <RoleLine name="Product read-only" value="найти товары" />
            <RoleLine name="Warehouse" value="увидеть склады" />
            <RoleLine name="Report" value="учесть продажи" />
            <RoleLine name="Supply order" value="черновики и слоты" />
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function ResultPanel({
  result,
  onDownloadZip,
  onDownloadSingleFile,
  isZipping,
  onCreateOzonDrafts,
  onSearchCrossdockPoints,
  onOpenSlotHunter,
  draftStatus,
  isCreatingDrafts,
}: {
  result: ProcessResponse;
  onDownloadZip: () => void;
  onDownloadSingleFile: (file: WarehouseFile) => void;
  isZipping: boolean;
  onCreateOzonDrafts: (candidates: DraftCandidate[]) => void;
  onSearchCrossdockPoints: (search: string) => Promise<CrossdockPoint[]>;
  onOpenSlotHunter: () => void;
  draftStatus: DraftStatus | null;
  isCreatingDrafts: boolean;
}) {
  const canDownloadZip =
    Boolean(result.archive_base64) ||
    result.files.some((file) => Boolean(file.content_base64));
  const draftCandidates = result.draft_candidates ?? [];

  return (
    <div className="space-y-5">
      {Boolean(draftCandidates.length) && (
        <DraftCreationPanel
          candidates={draftCandidates}
          status={draftStatus}
          isCreating={isCreatingDrafts}
          onCreate={onCreateOzonDrafts}
          onSearchCrossdockPoints={onSearchCrossdockPoints}
          onOpenSlotHunter={onOpenSlotHunter}
        />
      )}

      {result.errors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Ошибки поиска</CardTitle>
            <CardDescription>Позиции, которые не удалось сопоставить</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.errors.map((error) => (
              <div
                key={`${error.row_number}-${error.message}`}
                className="rounded-lg border border-destructive/25 bg-destructive/5 p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="font-medium text-destructive">
                    Строка {error.row_number}
                  </div>
                  <Badge variant="destructive">не найдено</Badge>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {error.message}
                </div>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                  <span>SKU: {error.input.sku ?? "-"}</span>
                  <span>Артикул: {error.input.offer_id ?? "-"}</span>
                  <span>Название: {error.input.name ?? "-"}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <details className="rounded-lg border border-white/[0.08] bg-white/[0.035] p-4 text-sm">
        <summary className="cursor-pointer list-none font-medium">
          Дополнительно: ручные Excel-файлы
        </summary>
        <p className="mt-2 text-sm text-muted-foreground">
          Обычно не нужны — FBOly создаёт черновики напрямую через Ozon API. Файлы пригодятся, только если хотите загрузить поставку вручную.
        </p>
        {result.distribution_note && (
          <div className="mt-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 text-sm text-muted-foreground leading-relaxed">
            {result.distribution_note}
          </div>
        )}
        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            onClick={onDownloadZip}
            disabled={!canDownloadZip || isZipping}
            variant="outline"
            className="gap-2"
          >
            {isZipping ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileArchive className="h-4 w-4" />
            )}
            Скачать все одним ZIP
          </Button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {result.files.map((file) => (
            <div key={file.filename} className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-secondary" />
                <span className="min-w-0 truncate">{file.warehouse}</span>
              </div>
              <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                <div>{file.rows_count} строк</div>
                <div>{file.total_quantity} шт.</div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onDownloadSingleFile(file)}
                disabled={!file.content_base64}
                className="mt-4 w-full gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                XLSX
              </Button>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

function DraftCreationPanel({
  candidates,
  status,
  isCreating,
  onCreate,
  onSearchCrossdockPoints,
  onOpenSlotHunter,
}: {
  candidates: DraftCandidate[];
  status: DraftStatus | null;
  isCreating: boolean;
  onCreate: (candidates: DraftCandidate[]) => void;
  onSearchCrossdockPoints: (search: string) => Promise<CrossdockPoint[]>;
  onOpenSlotHunter: () => void;
}) {
  const [selectedWarehouses, setSelectedWarehouses] = useState<string[]>([]);
  const [supplyMode, setSupplyMode] = useState<"direct" | "crossdock">("direct");
  const [dropOffPointWarehouseId, setDropOffPointWarehouseId] = useState("");
  const [dropOffPointWarehouseType, setDropOffPointWarehouseType] = useState("");
  const [dropOffSearch, setDropOffSearch] = useState("");
  const [dropOffPoints, setDropOffPoints] = useState<CrossdockPoint[]>([]);
  const [dropOffError, setDropOffError] = useState("");
  const [isSearchingDropOffs, setIsSearchingDropOffs] = useState(false);
  const [selectedDropOffName, setSelectedDropOffName] = useState("");

  const createableCandidates = useMemo(
    () => candidates.filter((candidate) => candidate.can_create !== false),
    [candidates],
  );

  useEffect(() => {
    setSelectedWarehouses(createableCandidates.map((candidate) => candidate.warehouse));
  }, [createableCandidates]);

  const selectedCandidates = createableCandidates.filter((candidate) =>
    selectedWarehouses.includes(candidate.warehouse),
  );
  const selectedQuantity = selectedCandidates.reduce(
    (sum, candidate) => sum + Number(candidate.total_quantity || 0),
    0,
  );
  const canCreateDrafts =
    Boolean(selectedCandidates.length) &&
    !isCreating &&
    (supplyMode === "direct" || Boolean(dropOffPointWarehouseId.trim()));

  const candidatesForCreate = selectedCandidates.map((candidate) => ({
    ...candidate,
    supply_mode: supplyMode,
    draft_flow: supplyMode === "crossdock" ? "modern" : candidate.draft_flow,
    drop_off_point_warehouse_id:
      supplyMode === "crossdock" ? dropOffPointWarehouseId.trim() : null,
    drop_off_point_warehouse_type:
      supplyMode === "crossdock" ? dropOffPointWarehouseType.trim() : null,
  }));

  function toggleWarehouse(warehouse: string) {
    setSelectedWarehouses((current) =>
      current.includes(warehouse)
        ? current.filter((item) => item !== warehouse)
        : [...current, warehouse],
    );
  }

  function selectAllWarehouses() {
    setSelectedWarehouses(createableCandidates.map((candidate) => candidate.warehouse));
  }

  function clearAllWarehouses() {
    setSelectedWarehouses([]);
  }

  async function searchDropOffPoints() {
    const query = dropOffSearch.trim();
    if (query.length < 4) {
      setDropOffError("Введите минимум 4 символа.");
      setDropOffPoints([]);
      return;
    }
    setIsSearchingDropOffs(true);
    setDropOffError("");
    try {
      const points = await onSearchCrossdockPoints(query);
      setDropOffPoints(points);
      if (!points.length) {
        setDropOffError("Ozon не вернул точки по этому запросу.");
      }
    } catch (error) {
      setDropOffPoints([]);
      setDropOffError(formatRequestError(error, "Не удалось найти точки"));
    } finally {
      setIsSearchingDropOffs(false);
    }
  }

  function selectDropOffPoint(point: CrossdockPoint) {
    setDropOffPointWarehouseId(point.id);
    setDropOffPointWarehouseType(String(point.warehouse_type || ""));
    setSelectedDropOffName(point.name);
    setDropOffSearch(point.name);
    setDropOffError("");
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col gap-3 border-b border-white/[0.08] bg-white/[0.025] lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-3">
          <StepBadge value="3" />
          <div>
            <CardTitle>Создание черновиков в Ozon</CardTitle>
            <CardDescription>
              Выберите кластеры, способ отгрузки и отправьте черновики в кабинет.
            </CardDescription>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={selectAllWarehouses}
            disabled={isCreating || !createableCandidates.length}
          >
            Выбрать все
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={clearAllWarehouses}
            disabled={isCreating || !selectedWarehouses.length}
          >
            Снять все
          </Button>
          <Button
            type="button"
            onClick={() => onCreate(candidatesForCreate)}
            disabled={!canCreateDrafts}
            className="gap-2"
          >
            {isCreating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Cloud className="h-4 w-4" />
            )}
            Создать черновики
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.035] p-4">
          <div className="mb-3 text-sm font-medium">Способ поставки</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setSupplyMode("direct")}
              className={cn(
                "rounded-lg border p-3 text-left text-sm transition",
                supplyMode === "direct"
                  ? "border-primary/70 bg-primary/15 text-foreground"
                  : "border-white/[0.08] hover:bg-muted/40",
              )}
            >
              <div className="font-medium">Прямая</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Везёте сразу на выбранный склад/кластер Ozon.
              </div>
            </button>
            <button
              type="button"
              onClick={() => setSupplyMode("crossdock")}
              className={cn(
                "rounded-lg border p-3 text-left text-sm transition",
                supplyMode === "crossdock"
                  ? "border-primary/70 bg-primary/15 text-foreground"
                  : "border-white/[0.08] hover:bg-muted/40",
              )}
            >
              <div className="font-medium">Кросс-докинг</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Отгружаете в точку приёма, дальше доставляет Ozon.
              </div>
            </button>
          </div>
          {supplyMode === "crossdock" && (
            <div className="mt-4 space-y-3">
              <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
                <div className="space-y-2">
                  <Label htmlFor="drop-off-search">Точка отгрузки</Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="drop-off-search"
                      value={dropOffSearch}
                      onChange={(event) => setDropOffSearch(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          searchDropOffPoints();
                        }
                      }}
                      placeholder="Название или адрес, например Колпино"
                      className="pl-9"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={searchDropOffPoints}
                  disabled={isSearchingDropOffs}
                  className="self-end gap-2"
                >
                  {isSearchingDropOffs ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  Найти
                </Button>
              </div>

              {dropOffPointWarehouseId && (
                  <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm">
                  <div className="font-medium">
                    Выбрано: {selectedDropOffName || "точка отгрузки"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    ID: {dropOffPointWarehouseId}
                    {dropOffPointWarehouseType ? ` · ${dropOffPointWarehouseType}` : ""}
                  </div>
                </div>
              )}

              {dropOffError && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {dropOffError}
                </div>
              )}

              {dropOffPoints.length > 0 && (
                <div className="grid gap-2">
                  {dropOffPoints.map((point) => (
                    <button
                      key={`${point.id}-${point.name}`}
                      type="button"
                      onClick={() => selectDropOffPoint(point)}
                      className={cn(
                        "rounded-lg border p-3 text-left text-sm transition hover:bg-muted/40",
                        dropOffPointWarehouseId === point.id && "border-primary bg-primary/10",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 font-medium">
                            <MapPin className="h-4 w-4 shrink-0 text-primary" />
                            <span className="truncate">{point.name}</span>
                          </div>
                          {point.address && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {point.address}
                            </div>
                          )}
                          {point.limits && point.limits.length > 0 && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {point.limits.join(", ")}
                            </div>
                          )}
                        </div>
                        <Badge variant="outline">ID {point.id}</Badge>
                      </div>
                      {point.warehouse_type && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          {point.warehouse_type}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {candidates.map((draft) => {
            const disabled = draft.can_create === false;
            const checked = selectedWarehouses.includes(draft.warehouse);
            return (
              <label
                key={draft.warehouse}
                className={cn(
                  "block rounded-lg border p-4 transition",
                  disabled
                    ? "cursor-not-allowed bg-muted/35 opacity-65"
                    : "cursor-pointer hover:bg-muted/35",
                  checked && !disabled && "border-primary bg-primary/10",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled || isCreating}
                      onChange={() => toggleWarehouse(draft.warehouse)}
                      className="mt-1 h-4 w-4 rounded border-input"
                    />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{draft.warehouse}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {draft.rows_count} SKU, {draft.total_quantity} шт.
                      </div>
                      {draft.draft_id && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          API-черновик: {draft.draft_id}
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge variant={disabled ? "outline" : "secondary"}>
                    {disabled ? "нет ID" : "готов"}
                  </Badge>
                </div>
                {draft.reason && (
                  <div className="mt-3 text-xs text-muted-foreground">
                    {draft.reason}
                  </div>
                )}
              </label>
            );
          })}
        </div>

          <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
            Выбрано: {selectedCandidates.length} городов, {selectedQuantity} шт.
          </div>
        <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          После создания черновиков FBOly передаст выбранные кластеры в охотник на слоты. Там можно запустить поиск окна поставки и автоматическую бронь.
        </div>

        {status && (
          <div
            className={cn(
              "rounded-lg border p-3 text-sm",
              status.type === "success" &&
                "border-secondary/30 bg-secondary/10 text-secondary",
              status.type === "error" &&
                "border-destructive/30 bg-destructive/10 text-destructive",
              status.type === "idle" && "bg-muted/40 text-muted-foreground",
            )}
          >
            <div className="font-medium">{status.message}</div>
            {status.type === "success" && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button type="button" onClick={onOpenSlotHunter} className="gap-2">
                  <Radar className="h-4 w-4" />
                  Перейти к охотнику на слоты
                </Button>
                <span className="text-xs text-muted-foreground">
                  Черновики готовы, теперь можно искать окно поставки.
                </span>
              </div>
            )}
            {status.results.length > 0 && (
              <div className="mt-3 space-y-2">
                {status.results.map((item) => (
                  <div key={item.warehouse} className="rounded border bg-card p-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{item.warehouse}</span>
                      <Badge variant={item.ok ? "secondary" : "destructive"}>
                        {item.ok
                          ? item.draft_id
                            ? "API-черновик"
                            : item.operation_id
                              ? "принято"
                              : "нет ID"
                          : "ошибка"}
                      </Badge>
                    </div>
                    {item.ok ? (
                      <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                        <div>
                          {item.draft_id ? "Черновик создан в Ozon" : item.operation_id ? "Запрос принят Ozon" : ""}
                          {item.status ? ` · статус: ${item.status}` : ""}
                        </div>
                        {item.attempts_count && (
                          <div>Попыток backend: {item.attempts_count}</div>
                        )}
                        {(item.items_count || item.total_quantity) && (
                          <div>
                            Отправлено в запросе: {item.items_count ?? "-"} SKU, {item.total_quantity ?? "-"} шт.
                          </div>
                        )}
                        {item.ozon_response && (
                          <details className="rounded bg-muted/50 p-2">
                            <summary className="cursor-pointer font-sans text-xs text-muted-foreground">
                              Технические детали
                            </summary>
                            <div className="mt-2 break-words font-mono text-[11px]">
                              Ответ Ozon: {item.ozon_response}
                            </div>
                          </details>
                        )}
                      </div>
                    ) : (
                      <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                        <div>{item.error ?? "Ozon не вернул подробности"}</div>
                        {item.operation_id && (
                          <div>operation_id: {item.operation_id}</div>
                        )}
                        {item.attempts_count && (
                          <div>Попыток backend: {item.attempts_count}</div>
                        )}
                        {(item.endpoint ||
                          item.http_status ||
                          item.ozon_response ||
                          (item.classic_cluster_ids && item.classic_cluster_ids.length > 0) ||
                          (item.cluster_ids && item.cluster_ids.length > 0) ||
                          (item.recent_ozon_requests && item.recent_ozon_requests.length > 0)) && (
                          <details className="mt-2 rounded bg-muted/50 p-2">
                            <summary className="cursor-pointer font-sans text-xs text-muted-foreground">
                              Технические детали
                            </summary>
                            <div className="mt-2 space-y-1 break-words font-mono text-[11px]">
                              {(item.endpoint || item.http_status) && (
                                <div>
                                  endpoint: {item.endpoint ?? "-"}
                                  {item.http_status ? `, статус: ${item.http_status}` : ""}
                                </div>
                              )}
                              {item.classic_cluster_ids && item.classic_cluster_ids.length > 0 && (
                                <div>classic cluster IDs: {item.classic_cluster_ids.join(", ")}</div>
                              )}
                              {item.cluster_ids && item.cluster_ids.length > 0 && (
                                <div>cluster IDs: {item.cluster_ids.join(", ")}</div>
                              )}
                              {item.ozon_response && <div>{item.ozon_response}</div>}
                              {item.recent_ozon_requests && item.recent_ozon_requests.length > 0 && (
                                <div className="space-y-1">
                                  <div className="font-sans text-xs text-foreground">
                                    Последние реальные запросы к Ozon
                                  </div>
                                  {item.recent_ozon_requests.slice(0, 8).map((request, index) => (
                                    <div key={`${request.at}-${index}`} className="break-words">
                                      {formatDateTime(request.at)} · {request.path} · HTTP {request.status}
                                      {request.payload ? ` · ${JSON.stringify(request.payload)}` : ""}
                                      {request.response_text ? ` · ${request.response_text}` : ""}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SlotHunterView({
  result,
  job,
  error,
  hasFullCredentials,
  connectionStatus,
  isStarting,
  isStopping,
  onStart,
  onStop,
  onRefresh,
  onOpenSupply,
  onOpenProfile,
}: {
  result: ProcessResponse | null;
  job: SlotHunterJob | null;
  error: string | null;
  hasFullCredentials: boolean;
  connectionStatus: ConnectionStatus;
  isStarting: boolean;
  isStopping: boolean;
  onStart: (settings: {
    auto_book: boolean;
    interval_seconds: number;
    max_minutes: number;
    concurrency_limit: number;
    date_from?: string;
    date_to?: string;
    time_from?: string;
    time_to?: string;
    cargo_type?: "any" | "box" | "pallet";
    smart_speed?: boolean;
    selected_warehouses?: string[];
    priority_warehouses?: string[];
    draft_ids_by_warehouse?: Record<string, string>;
  }) => void;
  onStop: () => void;
  onRefresh: () => void;
  onOpenSupply: () => void;
  onOpenProfile: () => void;
}) {
  const [autoBook, setAutoBook] = useState(true);
  const [intervalSeconds, setIntervalSeconds] = useState(15);
  const [maxMinutes, setMaxMinutes] = useState(240);
  const [concurrencyLimit, setConcurrencyLimit] = useState(1);
  const [dateFrom, setDateFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 14);
    return date.toISOString().slice(0, 10);
  });
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");
  const [cargoType, setCargoType] = useState<"any" | "box" | "pallet">("any");
  const [smartSpeed, setSmartSpeed] = useState(true);
  const [selectedWarehouses, setSelectedWarehouses] = useState<string[]>([]);
  const [priorityWarehouses, setPriorityWarehouses] = useState<string[]>([]);
  const [manualDraftIds, setManualDraftIds] = useState<Record<string, string>>({});

  const candidates = result?.draft_candidates ?? [];
  const availableCandidates = candidates.filter(
    (candidate) => candidate.can_create !== false,
  );
  const availableWarehouseKey = availableCandidates.map((candidate) => candidate.warehouse).join("|");
  useEffect(() => {
    const names = availableCandidates.map((candidate) => candidate.warehouse);
    setSelectedWarehouses((current) => {
      const kept = current.filter((name) => names.includes(name));
      return kept.length ? kept : names;
    });
    setPriorityWarehouses((current) => current.filter((name) => names.includes(name)));
  }, [availableWarehouseKey]);

  const selectedCandidates = availableCandidates.filter((candidate) =>
    selectedWarehouses.includes(candidate.warehouse),
  );
  const readyDraftsCount = selectedCandidates.filter(
    (candidate) => candidate.draft_id || manualDraftIds[candidate.warehouse]?.trim(),
  ).length;
  const prioritySelectedCount = priorityWarehouses.filter((warehouse) =>
    selectedWarehouses.includes(warehouse),
  ).length;
  const totalQuantity = selectedCandidates.reduce(
    (sum, candidate) => sum + Number(candidate.total_quantity || 0),
    0,
  );
  const canStart =
    Boolean(result) &&
    Boolean(selectedCandidates.length) &&
    hasFullCredentials &&
    !isStarting &&
    job?.status !== "running";

  function toggleSelectedWarehouse(warehouse: string) {
    setSelectedWarehouses((current) =>
      current.includes(warehouse)
        ? current.filter((item) => item !== warehouse)
        : [...current, warehouse],
    );
  }

  function togglePriorityWarehouse(warehouse: string) {
    setPriorityWarehouses((current) =>
      current.includes(warehouse)
        ? current.filter((item) => item !== warehouse)
        : [...current, warehouse],
    );
  }

  function updateManualDraftId(warehouse: string, value: string) {
    setManualDraftIds((current) => ({
      ...current,
      [warehouse]: value,
    }));
  }

  const isStoreConnected = hasFullCredentials && connectionStatus.type === "success";

  if (!isStoreConnected) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-4xl font-semibold tracking-normal">Охотник на слоты</h1>
          <p className="mt-2 max-w-3xl text-lg text-muted-foreground">
            FBOly проверяет доступные окна и бронирует подходящий слот по готовым черновикам.
          </p>
        </div>
        <ConnectStorePrompt
          hasFullCredentials={hasFullCredentials}
          connectionStatus={connectionStatus}
          onOpenProfile={onOpenProfile}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-normal">Охотник на слоты</h1>
          <p className="mt-2 max-w-3xl text-lg text-muted-foreground">
            FBOly проверяет доступные окна и бронирует подходящий слот по готовым черновикам.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onOpenSupply} className="gap-2">
            <Upload className="h-4 w-4" />
            Поставка
          </Button>
          <Button type="button" variant="outline" onClick={onOpenProfile} className="gap-2">
            <Store className="h-4 w-4" />
            Магазин
          </Button>
        </div>
      </div>

      {availableCandidates.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-white shadow-[0_0_34px_rgba(124,58,237,0.32)]">
              <Radar className="h-8 w-8" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Черновики готовы</div>
              <div className="mt-1 text-2xl font-semibold">
                {availableCandidates.length} кластеров, {totalQuantity} шт.
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Начнём поиск слотов по выбранным черновикам.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Охотник на слоты</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-5 xl:grid-cols-[430px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Запуск охоты</CardTitle>
              <CardDescription>
                Работает по городам, которые появились после обработки Excel.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3">
                <span>
                  <span className="block text-sm font-medium">
                    Автоматически бронировать
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Если слот найден, backend сразу попробует создать заявку.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={autoBook}
                  onChange={(event) => setAutoBook(event.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
              </label>



              <div className="space-y-3 rounded-lg border p-3">
                <div>
                  <Label>Параметры окна</Label>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Охотник берёт только подходящие даты, время и формат поставки.
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="slot-date-from">Дата от</Label>
                    <Input
                      id="slot-date-from"
                      type="date"
                      value={dateFrom}
                      onChange={(event) => setDateFrom(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slot-date-to">Дата до</Label>
                    <Input
                      id="slot-date-to"
                      type="date"
                      value={dateTo}
                      onChange={(event) => setDateTo(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slot-time-from">Время от</Label>
                    <Input
                      id="slot-time-from"
                      type="time"
                      value={timeFrom}
                      onChange={(event) => setTimeFrom(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slot-time-to">Время до</Label>
                    <Input
                      id="slot-time-to"
                      type="time"
                      value={timeTo}
                      onChange={(event) => setTimeTo(event.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["any", "Любой"],
                    ["box", "Короба"],
                    ["pallet", "Паллеты"],
                  ].map(([value, label]) => (
                    <Button
                      key={value}
                      type="button"
                      variant={cargoType === value ? "default" : "outline"}
                      onClick={() => setCargoType(value as "any" | "box" | "pallet")}
                      className="px-2"
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                Выбрано для охоты: {selectedCandidates.length} из {availableCandidates.length} городов, {totalQuantity} шт. Готовых API-черновиков: {readyDraftsCount}. Приоритетных: {prioritySelectedCount}.
              </div>

              {availableCandidates.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label>География и приоритет</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setSelectedWarehouses(
                          selectedWarehouses.length === availableCandidates.length
                            ? []
                            : availableCandidates.map((candidate) => candidate.warehouse),
                        )
                      }
                    >
                      {selectedWarehouses.length === availableCandidates.length
                        ? "Снять все"
                        : "Выбрать все"}
                    </Button>
                  </div>
                  <div className="max-h-[280px] space-y-2 overflow-auto pr-1">
                    {availableCandidates.map((candidate) => {
                      const selected = selectedWarehouses.includes(candidate.warehouse);
                      const priority = priorityWarehouses.includes(candidate.warehouse);
                      return (
                        <div
                          key={candidate.warehouse}
                          className={cn(
                            "rounded-lg border p-3 transition",
                            selected ? "bg-muted/35" : "opacity-60",
                            priority && "border-primary bg-primary/10",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <label className="flex min-w-0 cursor-pointer items-start gap-2">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => toggleSelectedWarehouse(candidate.warehouse)}
                                className="mt-1 h-4 w-4 rounded border-input"
                              />
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium">
                                  {candidate.warehouse}
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                  {candidate.rows_count} SKU, {candidate.total_quantity} шт.
                                </span>
                              </span>
                            </label>
                            <Button
                              type="button"
                              variant={priority ? "default" : "outline"}
                              size="sm"
                              disabled={!selected}
                              onClick={() => togglePriorityWarehouse(candidate.warehouse)}
                              className="shrink-0"
                            >
                              Приоритет
                            </Button>
                          </div>
                          <div className="mt-3">
                            <Input
                              value={manualDraftIds[candidate.warehouse] ?? candidate.draft_id ?? ""}
                              onChange={(event) =>
                                updateManualDraftId(candidate.warehouse, event.target.value)
                              }
                              placeholder="draft_id, если уже есть"
                              className="h-9 text-xs"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Приоритетные города проверяются первыми и повторяются чаще. Так можно сильнее давить склады, куда обычно сложно поймать загрузку, не отключая остальные города.
                  </div>
                </div>
              )}

              {!result && (
                <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                  Сначала загрузите Excel и создайте поставку.
                </div>
              )}
              {result && !availableCandidates.length && (
                <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                  В результате нет городов с SKU Ozon для создания черновиков.
                </div>
              )}
              {!hasFullCredentials && (
                <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                  Для охоты нужны Client-Id и Api-Key с ролью Supply order.
                </div>
              )}

              <Button
                type="button"
                disabled={!canStart}
                onClick={() =>
                  onStart({
                    auto_book: autoBook,
                    interval_seconds: intervalSeconds,
                    max_minutes: maxMinutes,
                    concurrency_limit: concurrencyLimit,
                    date_from: dateFrom,
                    date_to: dateTo,
                    time_from: timeFrom,
                    time_to: timeTo,
                    cargo_type: cargoType,
                    smart_speed: smartSpeed,
                    selected_warehouses: selectedWarehouses,
                    priority_warehouses: priorityWarehouses,
                    draft_ids_by_warehouse: manualDraftIds,
                  })
                }
                className="h-14 w-full gap-2 text-base"
              >
                {isStarting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Radar className="h-4 w-4" />
                )}
                Запустить охотника
              </Button>
            </CardContent>
          </Card>

          {job && (
            <Card>
              <CardHeader>
                <CardTitle>Статус задачи</CardTitle>
                <CardDescription>{job.last_message || "Ожидаем данные"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <InfoLine label="Статус" value={slotHunterStatusLabel(job.status)} />
                  <InfoLine
                    label="Режим"
                    value={job.auto_book ? "автобронь" : "уведомить"}
                  />
                  <InfoLine label="Забронировано" value={String(job.summary.booked)} />
                  <InfoLine label="Найдено" value={String(job.summary.found)} />
                  <InfoLine label="В поиске" value={String(job.summary.searching)} />
                  <InfoLine label="Ошибки" value={String(job.summary.failed)} />
                </div>
                <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                  Следующая попытка: {job.next_attempt_at ? formatDate(job.next_attempt_at) : "-"}
                  {job.rate_limited_until
                    ? ` · ждём ответ Ozon, повторим автоматически`
                    : ""}
                  {job.draft_phase_until
                    ? ` · ожидаем готовности черновика`
                    : ""}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={onRefresh} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Обновить
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onStop}
                    disabled={job.status !== "running" || isStopping}
                    className="gap-2"
                  >
                    {isStopping ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                    Остановить
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </aside>

        <section className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Города и склады</CardTitle>
              <CardDescription>
                Охотник продолжает попытки, пока не поймает слот, не истечёт время или вы не остановите задачу.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {job ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {job.targets.map((target) => (
                    <div key={target.id} className="rounded-lg border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{target.warehouse}</div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {target.rows_count} SKU, {target.total_quantity} шт.
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          {target.is_priority && <Badge>приоритет</Badge>}
                          <Badge variant={slotHunterBadgeVariant(target.status)}>
                            {slotHunterStatusLabel(target.status)}
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                        <div>Попыток: {target.attempts_count}</div>
                        <div>{target.last_message || "Ожидает попытки"}</div>
                        {target.supply_order_id && (
                          <div className="font-medium text-green-400">✓ Заявка создана: {target.supply_order_id}</div>
                        )}
                        {target.error_message && (
                          <div className="text-destructive">{target.error_message}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : availableCandidates.length ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {availableCandidates.map((candidate) => (
                    <div key={candidate.warehouse} className="rounded-lg border p-4">
                      <div className="font-medium">{candidate.warehouse}</div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        {candidate.rows_count} SKU, {candidate.total_quantity} шт.
                      </div>
                      {candidate.draft_id && (
                        <div className="mt-2 text-xs text-green-400">
                          ✓ Черновик готов
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Radar}
                  title="Нет рассчитанных городов"
                  text="Создайте поставку из Excel, потом вернитесь сюда."
                />
              )}
            </CardContent>
          </Card>

          {job && (
            <Card>
              <CardHeader>
                <CardTitle>Журнал попыток</CardTitle>
                <CardDescription>
                  Последние запросы к Ozon и ответы охотника.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {job.attempts.length ? (
                  <div className="space-y-2">
                    {job.attempts.slice(0, 20).map((attempt) => (
                      <div key={attempt.id} className="rounded-lg border p-3 text-sm">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="font-medium">
                            {attempt.warehouse || "задача"} · {attempt.attempt_type}
                          </div>
                          <Badge variant={slotHunterBadgeVariant(attempt.status)}>
                            {slotHunterStatusLabel(attempt.status)}
                          </Badge>
                        </div>
                        <div className="mt-1 text-muted-foreground">
                          {attempt.message}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatDate(attempt.attempted_at)}
                          {attempt.http_status ? ` · HTTP ${attempt.http_status}` : ""}
                        </div>
                        {Boolean(attempt.raw_response) && (
                          <div className="mt-2 break-words rounded bg-muted/60 p-2 font-mono text-[11px] text-muted-foreground">
                            {formatDebugValue(attempt.raw_response)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={Activity}
                    title="Попыток ещё нет"
                    text="После запуска здесь появятся проверки складов."
                  />
                )}
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}

function HistoryView({ history }: { history: HistoryRecord[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>История обработок</CardTitle>
        <CardDescription>
          Последние расчёты сохраняются в браузере до подключения базы данных.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {history.length ? (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-muted text-xs">
                <tr>
                  <th className="px-3 py-2">Дата</th>
                  <th className="px-3 py-2">Файл</th>
                  <th className="px-3 py-2">Найдено</th>
                  <th className="px-3 py-2">Ошибки</th>
                  <th className="px-3 py-2">Файлов</th>
                  <th className="px-3 py-2">Итого</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-3 py-2">{formatDate(item.createdAt)}</td>
                    <td className="max-w-[260px] truncate px-3 py-2 font-medium">
                      {item.fileName}
                    </td>
                    <td className="px-3 py-2">{item.resolved}</td>
                    <td className="px-3 py-2">{item.errors}</td>
                    <td className="px-3 py-2">{item.files}</td>
                    <td className="px-3 py-2">{item.totalQuantity} шт.</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={History}
            title="История пустая"
            text="После первой обработки Excel здесь появятся записи."
          />
        )}
      </CardContent>
    </Card>
  );
}

function buildDistributionExplanation(result: ProcessResponse) {
  const clustersCount = result.files.length;
  const totalQuantity = result.total_output_quantity;
  const productsCount = result.resolved_items.length;
  const errorsCount = result.errors.length;
  const clusterWord = pluralRu(clustersCount, "кластер", "кластера", "кластеров");
  const productWord = pluralRu(productsCount, "товар", "товара", "товаров");

  return `FBOly нашёл ${productsCount} ${productWord}, проверил доступные данные Ozon по остаткам, продажам и кластерам, затем распределил ${totalQuantity} шт. по ${clustersCount} ${clusterWord}. Кластеры с маленькой потребностью объединены или пропущены, чтобы не делать поставки по 1-2 штуки. ${errorsCount ? `Не найдено позиций: ${errorsCount}.` : "Ошибок сопоставления нет."}`;
}

function pluralRu(count: number, one: string, few: string, many: string) {
  const mod10 = Math.abs(count) % 10;
  const mod100 = Math.abs(count) % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function StepBadge({ value }: { value: string }) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-sm font-semibold text-white shadow-[0_0_26px_rgba(124,58,237,0.32)]">
      {value}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="mt-2 text-2xl font-semibold">{value}</div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 text-xs text-muted-foreground">{hint}</div>
      </CardContent>
    </Card>
  );
}

function MetricTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "blue" | "green" | "amber";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        tone === "blue" && "border-primary/20 bg-primary/10",
        tone === "green" && "border-secondary/20 bg-secondary/10",
        tone === "amber" && "border-accent/25 bg-accent/15",
      )}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Upload;
  title: string;
  text: string;
}) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 p-6 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-md bg-card text-muted-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-4 font-medium">{title}</div>
      <div className="mt-2 max-w-sm text-sm text-muted-foreground">{text}</div>
    </div>
  );
}

function StatusPill({
  type,
  label,
}: {
  type: "success" | "neutral";
  label: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm",
        type === "success"
          ? "border-secondary/25 bg-secondary/10 text-secondary"
          : "bg-card text-muted-foreground",
      )}
    >
      {type === "success" ? (
        <CheckCircle2 className="h-4 w-4" />
      ) : (
        <Zap className="h-4 w-4" />
      )}
      {label}
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate font-medium">{value}</span>
    </div>
  );
}

function RoleLine({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
      <span className="font-medium">{name}</span>
      <span className="text-right text-muted-foreground">{value}</span>
    </div>
  );
}

function slotHunterStatusLabel(status: string) {
  const labels: Record<string, string> = {
    running: "ищет",
    booked: "забронировано",
    partial: "частично",
    stopped: "остановлено",
    failed: "ошибка",
    expired: "время вышло",
    waiting: "ожидает",
    draft_created: "черновик",
    draft_ready: "черновик готов",
    searching: "ищет",
    slot_found: "слот найден",
    skipped: "пропущено",
    rate_limited: "лимит Ozon",
    cooldown: "пауза",
    success: "успех",
    empty: "пусто",
    retrying: "повтор",
  };
  return labels[status] ?? status;
}

function slotHunterBadgeVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (["booked", "slot_found", "success"].includes(status)) {
    return "secondary";
  }
  if (["failed", "expired"].includes(status)) {
    return "destructive";
  }
  if (["running", "searching", "draft_created", "draft_ready", "retrying"].includes(status)) {
    return "default";
  }
  if (["rate_limited", "cooldown"].includes(status)) {
    return "outline";
  }
  return "outline";
}

function base64ToUint8Array(value: string) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadInputTemplate() {
  window.open(`${API_URL}/api/templates/input`, "_blank");
}

function createBrowserId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function formatRequestError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return "Не запущен API-сервер на http://localhost:8000. Запустите из корня проекта start-web-service.bat и держите оба окна открытыми.";
  }
  return message;
}

function isOzonRateLimitMessage(message: string) {
  return /429|частот|частоту|rate limit|too many requests/i.test(message);
}

function isDraftRateLimited(result: DraftCreationResult) {
  return Boolean(
    result.is_rate_limited ||
    Number(result.http_status) === 429 ||
    isOzonRateLimitMessage(`${result.error || ""} ${result.ozon_response || ""}`),
  );
}

function getDraftRetryWaitSeconds(attempt: number, result?: DraftCreationResult | null) {
  const retryAfterSeconds = Math.ceil(Number(result?.retry_after_ms || 0) / 1000);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.min(120, Math.max(5, retryAfterSeconds));
  }
  return [10, 20, 30, 45][Math.max(0, attempt - 1)] ?? 60;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDebugValue(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 1000);
  try {
    return JSON.stringify(value).slice(0, 1000);
  } catch {
    return String(value).slice(0, 1000);
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

