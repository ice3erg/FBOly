"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../AppContext";
import shell from "../shell.module.css";
import styles from "./supply.module.css";
import { API_URL, delay, formatRequestError, normalizeKey } from "@/lib/api";
import type {
  CrossdockPoint,
  DraftCandidate,
  DraftCreationJob,
  DraftCreationResult,
  DraftStatus,
  ProcessResponse,
} from "@/lib/types";

// Дефолтное распределение по складам — фолбэк-алгоритм бэкенда на случай,
// если по товару нет данных Ozon по остаткам/продажам. В новом дизайне
// нет отдельного экрана для редактирования этих процентов (в отличие от
// прежней версии) — используем сохранённые значения по умолчанию.
const DEFAULT_WAREHOUSES = [
  { name: "Москва", percentage: 35 },
  { name: "Санкт-Петербург", percentage: 25 },
  { name: "Казань", percentage: 15 },
  { name: "Ростов", percentage: 10 },
  { name: "Екатеринбург", percentage: 10 },
  { name: "Воронеж", percentage: 5 },
];

function draftJobToResults(job: DraftCreationJob, finalRef: { current: DraftCreationResult[] }, includePending = false): DraftCreationResult[] {
  const finalResults = (job.targets ?? []).map((t) => t.result).filter(Boolean) as DraftCreationResult[];
  if (finalResults.length) finalRef.current = finalResults;
  if (!includePending) return finalResults.length ? finalResults : finalRef.current;

  const fromTargets = (job.targets ?? [])
    .map((target) => {
      if (target.result) return target.result;
      if (["waiting", "creating", "cooldown"].includes(target.status)) {
        return {
          ok: false,
          warehouse: target.warehouse,
          error: target.last_message || "В очереди создания",
          attempts_count: target.attempts_count,
          retry_after_ms: target.next_attempt_at ? Math.max(0, new Date(target.next_attempt_at).getTime() - Date.now()) : null,
          is_rate_limited: target.status === "cooldown",
        } as DraftCreationResult;
      }
      return null;
    })
    .filter(Boolean) as DraftCreationResult[];
  return fromTargets.length ? fromTargets : job.results ?? [];
}

function formatDraftJobMessage(job: DraftCreationJob) {
  const summary = job.summary;
  const prefix = summary ? `Создано ${summary.created} из ${summary.total}. ` : "";
  const next = job.next_attempt_at ? ` Следующая попытка: ${new Date(job.next_attempt_at).toLocaleString("ru-RU")}.` : "";
  if (job.status === "completed") return "Черновики созданы. Следующий шаг — найти слот.";
  if (job.status === "failed") return `${prefix}${job.last_message || "Часть черновиков не создалась."}`;
  if (job.status === "stopped") return job.last_message || "Очередь остановлена.";
  return `${prefix}${job.last_message || "Очередь создания черновиков работает."}${next}`;
}

export default function SupplyPage() {
  const router = useRouter();
  const { clientId, apiKey, lastProcessResult, setLastProcessResult } = useApp();
  const hasFullCredentials = Boolean(clientId.trim() && apiKey.trim());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const [selectedWarehouses, setSelectedWarehouses] = useState<string[]>([]);
  const [localCandidates, setLocalCandidates] = useState<DraftCandidate[]>([]);
  const [isRedistributing, setIsRedistributing] = useState(false);
  const [supplyMode, setSupplyMode] = useState<"direct" | "crossdock">("direct");

  const [dropOffPointId, setDropOffPointId] = useState("");
  const [dropOffPointType, setDropOffPointType] = useState("");
  const [dropOffSearch, setDropOffSearch] = useState("");
  const [dropOffPoints, setDropOffPoints] = useState<CrossdockPoint[]>([]);
  const [isSearchingDropOffs, setIsSearchingDropOffs] = useState(false);
  const [selectedDropOffName, setSelectedDropOffName] = useState("");

  const [draftStatus, setDraftStatus] = useState<DraftStatus | null>(null);
  const [isCreatingDrafts, setIsCreatingDrafts] = useState(false);
  const draftJobFinalResultsRef = useRef<DraftCreationResult[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (lastProcessResult?.draft_candidates) setLocalCandidates(lastProcessResult.draft_candidates);
  }, [lastProcessResult?.draft_candidates]);

  const createableCandidates = useMemo(() => localCandidates.filter((c) => c.can_create !== false), [localCandidates]);
  const disabledCandidates = useMemo(() => localCandidates.filter((c) => c.can_create === false), [localCandidates]);

  useEffect(() => {
    if (selectedWarehouses.length === 0 && createableCandidates.length > 0) {
      setSelectedWarehouses(createableCandidates.map((c) => c.warehouse));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createableCandidates.length]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] ?? null);
    setLastProcessResult(null);
    setRequestError(null);
    setSelectedWarehouses([]);
  }

  async function handleUpload() {
    if (!selectedFile) return;
    if (!hasFullCredentials) {
      setRequestError("Выберите магазин с Client ID и API Key в профиле.");
      return;
    }
    setIsLoading(true);
    setLastProcessResult(null);
    setRequestError(null);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("warehouse_percentages", JSON.stringify(DEFAULT_WAREHOUSES));
    formData.append("ozon_client_id", clientId.trim());
    formData.append("ozon_api_key", apiKey.trim());
    formData.append("ozon_include_international", "false");
    formData.append("ozon_include_remote", "false");
    formData.append("ozon_max_clusters", "10");

    try {
      const response = await fetch(`${API_URL}/api/process`, { method: "POST", body: formData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail ?? "Не удалось обработать файл");
      setLastProcessResult(payload as ProcessResponse);
      setDraftStatus(null);
    } catch (error) {
      setRequestError(formatRequestError(error, "Ошибка обработки"));
    } finally {
      setIsLoading(false);
    }
  }

  const toggleWarehouse = useCallback(
    async (warehouse: string) => {
      const isRemoving = selectedWarehouses.includes(warehouse);
      const nextSelected = isRemoving ? selectedWarehouses.filter((w) => w !== warehouse) : [...selectedWarehouses, warehouse];
      setSelectedWarehouses(nextSelected);

      if (isRemoving && nextSelected.length > 0) {
        setIsRedistributing(true);
        try {
          const excluded = createableCandidates.map((c) => c.warehouse).filter((w) => !nextSelected.includes(w));
          const res = await fetch(`${API_URL}/api/ozon/redistribute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ candidates: createableCandidates, excluded_warehouses: excluded }),
          });
          const data = await res.json();
          if (data.candidates?.length) {
            const byWarehouse = new Map(data.candidates.map((c: DraftCandidate) => [c.warehouse, c]));
            setLocalCandidates((prev) => prev.map((c) => (byWarehouse.get(c.warehouse) ? { ...c, ...(byWarehouse.get(c.warehouse) as DraftCandidate) } : c)));
          }
        } catch {
          // тихо — перераспределение best-effort, не блокируем пользователя
        } finally {
          setIsRedistributing(false);
        }
      }
    },
    [selectedWarehouses, createableCandidates],
  );

  function selectAll() {
    setSelectedWarehouses(createableCandidates.map((c) => c.warehouse));
  }
  function deselectAll() {
    setSelectedWarehouses([]);
  }

  // Поиск точек кросс-докинга с дебаунсом
  useEffect(() => {
    if (supplyMode !== "crossdock") return;
    const query = dropOffSearch.trim();
    if (query.length < 2 || query === selectedDropOffName) return;
    if (!hasFullCredentials) return;
    const timer = setTimeout(async () => {
      setIsSearchingDropOffs(true);
      try {
        const res = await fetch(`${API_URL}/api/ozon/fbo-warehouses/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ client_id: clientId.trim(), api_key: apiKey.trim(), search: query, supply_type: "CREATE_TYPE_CROSSDOCK" }),
        });
        const payload = await res.json();
        setDropOffPoints(Array.isArray(payload.points) ? payload.points : []);
      } catch {
        setDropOffPoints([]);
      } finally {
        setIsSearchingDropOffs(false);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [dropOffSearch, supplyMode, selectedDropOffName, hasFullCredentials, clientId, apiKey]);

  function selectDropOffPoint(point: CrossdockPoint) {
    setDropOffPointId(point.id);
    setDropOffPointType(String(point.warehouse_type || ""));
    setSelectedDropOffName(point.name);
    setDropOffSearch(point.name);
  }

  const selectedCandidates = createableCandidates.filter((c) => selectedWarehouses.includes(c.warehouse));
  const selectedQuantity = selectedCandidates.reduce((sum, c) => sum + Number(c.total_quantity || 0), 0);
  const canCreateDrafts =
    Boolean(selectedCandidates.length) && !isCreatingDrafts && !isRedistributing && (supplyMode === "direct" || Boolean(dropOffPointId.trim()));

  function mergeDraftCreationResults(draftResults: DraftCreationResult[]) {
    const successfulByWarehouse = new Map(draftResults.filter((i) => i.ok && i.draft_id).map((i) => [normalizeKey(i.warehouse), i]));
    if (!successfulByWarehouse.size) return;
    setLocalCandidates((current) =>
      current.map((candidate) => {
        const match = successfulByWarehouse.get(normalizeKey(candidate.warehouse));
        if (!match) return candidate;
        return { ...candidate, draft_id: match.draft_id ?? candidate.draft_id, operation_id: match.operation_id ?? candidate.operation_id, draft_status: match.status ?? candidate.draft_status };
      }),
    );
  }

  async function createDrafts() {
    if (!selectedCandidates.length) {
      setDraftStatus({ type: "error", message: "Выберите хотя бы один город для создания черновика.", results: [] });
      return;
    }
    if (!hasFullCredentials) {
      setDraftStatus({ type: "error", message: "Введите Client-Id и Api-Key Ozon в профиле.", results: [] });
      return;
    }
    const approved = window.confirm(
      `Подготовить ${selectedCandidates.length} поставку(и) на ${selectedQuantity} шт.? Это создаст черновики в Ozon.`,
    );
    if (!approved) return;

    const candidatesForCreate = selectedCandidates.map((c) => ({
      ...c,
      supply_mode: supplyMode,
      draft_flow: supplyMode === "crossdock" ? "modern" : c.draft_flow,
      drop_off_point_warehouse_id: supplyMode === "crossdock" ? dropOffPointId.trim() : null,
      drop_off_point_warehouse_type: supplyMode === "crossdock" ? dropOffPointType.trim() : null,
    }));

    setIsCreatingDrafts(true);
    draftJobFinalResultsRef.current = [];
    setDraftStatus({ type: "idle", message: `Ставим в очередь ${candidatesForCreate.length} город(а)…`, results: [] });

    try {
      const response = await fetch(`${API_URL}/api/ozon/draft-jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId.trim(), api_key: apiKey.trim(), candidates: candidatesForCreate }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail ?? "Не удалось поставить черновики в очередь");

      let job = payload as DraftCreationJob;
      for (;;) {
        const isFinal = ["completed", "failed", "stopped"].includes(job.status);
        const visibleResults = draftJobToResults(job, draftJobFinalResultsRef, isFinal);
        mergeDraftCreationResults(visibleResults.filter((r) => r.ok && r.draft_id));
        setDraftStatus({
          type: job.status === "completed" ? "success" : ["failed", "stopped"].includes(job.status) ? "error" : "idle",
          message: formatDraftJobMessage(job),
          results: visibleResults,
        });
        if (isFinal) {
          if (job.status === "completed") {
            setToast("Черновики созданы — переходим к поиску слота");
            setTimeout(() => router.push("/app/slots"), 1200);
          }
          break;
        }
        await delay(5000);
        const pollResponse = await fetch(`${API_URL}/api/ozon/draft-jobs/${job.id}`);
        const pollPayload = await pollResponse.json();
        if (!pollResponse.ok) throw new Error(pollPayload.detail ?? "Не удалось обновить статус очереди черновиков");
        job = pollPayload as DraftCreationJob;
      }
    } catch (error) {
      setDraftStatus({ type: "error", message: formatRequestError(error, "Ошибка создания черновиков"), results: [] });
    } finally {
      setIsCreatingDrafts(false);
    }
  }

  // ── Stepper ──
  const step1Done = Boolean(lastProcessResult);
  const step2Done = draftStatus?.type === "success";
  const stepFill = step2Done ? 1 : step1Done ? 0.5 : 0;

  return (
    <main className={shell.main}>
      <div className={shell.pageHeader}>
        <div>
          <h1 className={shell.pageTitle}>Поставка</h1>
          <p className={shell.pageSub}>Загрузите Excel, создайте черновики в Ozon и переходите к поиску слота.</p>
        </div>
        <button className={shell.btnGhost} onClick={() => router.push("/app/slots")}>К слотам →</button>
      </div>

      <div className={shell.content}>
        {!hasFullCredentials && (
          <div className={`${shell.card} ${styles.banner} ${styles.bannerError}`} style={{ padding: "12px 16px" }}>
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="var(--error)" strokeWidth={2}><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4m0 4h.01" /></svg>
            <p>Магазин Ozon не подключён. <a href="/app/profile" style={{ color: "var(--accent-light)" }}>Добавьте Client-Id и API Key в профиле</a>, чтобы загружать поставки.</p>
          </div>
        )}

        {/* Stepper */}
        <div className={`${shell.card} ${styles.stepperCard}`}>
          <div className={styles.stepperTrack}>
            <div className={styles.stepperFill} style={{ transform: `scaleX(${stepFill})` }} />
          </div>
          <div className={styles.stepperSteps}>
            <div className={styles.step}>
              <div className={`${styles.stepDot} ${step1Done ? styles.stepDotDone : styles.stepDotActive}`}>
                {step1Done ? (
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-7" stroke="#22C55E" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
                ) : "1"}
              </div>
              <div className={styles.stepText}>
                <div className={`${styles.stepLabel} ${step1Done ? styles.stepLabelDone : styles.stepLabelCurrent}`}>Загрузить Excel</div>
                <div className={styles.stepSub}>{lastProcessResult ? `${lastProcessResult.resolved_items.length} SKU · ${lastProcessResult.total_output_quantity} шт` : "Выберите файл"}</div>
              </div>
            </div>
            <div className={`${styles.step} ${step1Done ? styles.stepActive : ""}`}>
              <div className={`${styles.stepDot} ${step2Done ? styles.stepDotDone : step1Done ? styles.stepDotActive : styles.stepDotTodo}`}>
                {step2Done ? (
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-7" stroke="#22C55E" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
                ) : "2"}
              </div>
              <div className={styles.stepText}>
                <div className={`${styles.stepLabel} ${step2Done ? styles.stepLabelDone : step1Done ? styles.stepLabelCurrent : styles.stepLabelTodo}`}>Подготовить</div>
                <div className={styles.stepSub}>Выбор кластеров</div>
              </div>
            </div>
            <div className={styles.step}>
              <div className={`${styles.stepDot} ${styles.stepDotTodo}`}>3</div>
              <div className={styles.stepText}>
                <div className={`${styles.stepLabel} ${styles.stepLabelTodo}`}>Найти слот</div>
                <div className={styles.stepSub}>После черновиков</div>
              </div>
            </div>
          </div>
        </div>

        {/* Upload */}
        {!selectedFile && !lastProcessResult ? (
          <div className={`${shell.card} ${styles.dropZone}`} onClick={() => fileInputRef.current?.click()}>
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="var(--accent)" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div className={styles.dropZoneTitle}>Загрузите Excel с товарами</div>
            <div className={styles.dropZoneSub}>.xlsx или .xls — офер, количество, склад назначения</div>
          </div>
        ) : (
          <div className={`${shell.card} ${styles.uploadCard}`}>
            <div className={styles.uploadIcon}>
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="var(--accent)" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <div className={styles.uploadInfo}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                <span className={styles.uploadName}>{selectedFile?.name ?? "Файл"}</span>
                {lastProcessResult && <span className={styles.uploadBadge}>Обработан</span>}
                {isLoading && <span className={styles.uploadBadge} style={{ background: "var(--accent-dim)", color: "var(--accent-light)", borderColor: "var(--accent-border)" }}>Обрабатываем…</span>}
              </div>
              <div className={styles.uploadStats}>
                {lastProcessResult ? <>Обработано: <b>{lastProcessResult.resolved_items.length} SKU</b>, <b>{lastProcessResult.total_output_quantity} шт</b></> : "Нажмите «Загрузить», чтобы обработать файл"}
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className={styles.srOnly} onChange={handleFileChange} />
            {!lastProcessResult && (
              <button className={shell.btnPrimary} onClick={handleUpload} disabled={isLoading}>
                {isLoading && <span className={styles.spinner} />}
                {isLoading ? "Обрабатываем…" : "Загрузить и обработать"}
              </button>
            )}
            <button className={styles.btnOutlineSm} onClick={() => fileInputRef.current?.click()}>Загрузить другой</button>
          </div>
        )}

        {requestError && (
          <div className={`${shell.card} ${styles.banner} ${styles.bannerError}`} style={{ padding: "12px 16px" }}>
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="var(--error)" strokeWidth={2}><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4m0 4h.01" /></svg>
            <p>{requestError}</p>
          </div>
        )}

        {lastProcessResult && (
          <>
            {/* Metrics */}
            <div className={styles.metrics}>
              <div className={`${shell.card} ${styles.metric}`}>
                <div className={styles.metricLabel}>Товаров</div>
                <div className={styles.metricValue}>{lastProcessResult.resolved_items.length}</div>
                <div className={styles.metricFoot}>из Excel</div>
              </div>
              <div className={`${shell.card} ${styles.metric} ${lastProcessResult.errors.length ? styles.metricError : styles.metricSuccess}`}>
                <div className={styles.metricLabel}>Ошибок</div>
                <div className={`${styles.metricValue} ${lastProcessResult.errors.length ? styles.metricValueError : styles.metricValueSuccess}`}>{lastProcessResult.errors.length}</div>
                <div className={`${styles.metricFoot} ${lastProcessResult.errors.length ? "" : styles.metricFootSuccess}`}>{lastProcessResult.errors.length ? "проверьте строки" : "всё корректно"}</div>
              </div>
              <div className={`${shell.card} ${styles.metric}`}>
                <div className={styles.metricLabel}>Кластеров</div>
                <div className={styles.metricValue}>{createableCandidates.length}</div>
                <div className={styles.metricFoot}>складов Ozon</div>
              </div>
              <div className={`${shell.card} ${styles.metric} ${styles.metricSuccess}`}>
                <div className={styles.metricLabel}>Итого</div>
                <div className={`${styles.metricValue} ${styles.metricValueSuccess}`}>{lastProcessResult.total_output_quantity}</div>
                <div className={`${styles.metricFoot} ${styles.metricFootSuccess}`}>SKU готово к отправке</div>
              </div>
            </div>

            <div className={styles.banner}>
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="var(--accent)" strokeWidth={2}><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4m0 4h.01" /></svg>
              <p>Файл обработан. Выберите кластеры и нажмите «Создать черновики» — система отправит запросы в Ozon Seller API.</p>
            </div>

            {/* Supply type */}
            <div className={styles.typeToggleWrap}>
              <div className={styles.typeToggleLabel}>Тип поставки</div>
              <div className={styles.typeToggle} role="radiogroup" aria-label="Тип поставки">
                <div className={styles.typeIndicator} style={{ transform: supplyMode === "crossdock" ? "translateX(100%)" : "translateX(0)" }} />
                <button type="button" role="radio" aria-checked={supplyMode === "direct"} className={`${styles.typeBtn} ${supplyMode === "direct" ? styles.typeBtnActive : ""}`} onClick={() => setSupplyMode("direct")}>
                  <span className="tTitle" style={{ fontSize: 13, fontWeight: 600 }}>Прямая поставка</span>
                  <span className="tSub" style={{ fontSize: 10.5 }}>по кластерам Ozon</span>
                </button>
                <button type="button" role="radio" aria-checked={supplyMode === "crossdock"} className={`${styles.typeBtn} ${supplyMode === "crossdock" ? styles.typeBtnActive : ""}`} onClick={() => setSupplyMode("crossdock")}>
                  <span className="tTitle" style={{ fontSize: 13, fontWeight: 600 }}>Кроссдокинг</span>
                  <span className="tSub" style={{ fontSize: 10.5 }}>через одну точку</span>
                </button>
              </div>
            </div>

            {supplyMode === "direct" ? (
              <div>
                <div className={styles.clustersHead}>
                  <div>
                    <div className={styles.clustersTitle}>Кластеры для поставки</div>
                    <div className={styles.clustersSub}>Для каждого кластера будет создан отдельный черновик</div>
                  </div>
                  <div className={styles.clustersActions}>
                    <span className={styles.clustersCount}>{selectedWarehouses.length} из {createableCandidates.length} выбрано</span>
                    <button className={shell.btnText} onClick={selectAll}>Выбрать все</button>
                    <button className={shell.btnText} onClick={deselectAll}>Снять все</button>
                  </div>
                </div>

                <div className={styles.clusterList} role="group" aria-label="Список кластеров">
                  {createableCandidates.map((c) => {
                    const selected = selectedWarehouses.includes(c.warehouse);
                    return (
                      <div
                        key={c.warehouse}
                        role="checkbox"
                        aria-checked={selected}
                        tabIndex={0}
                        className={`${styles.clusterRow} ${selected ? styles.clusterRowSelected : ""}`}
                        onClick={() => toggleWarehouse(c.warehouse)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleWarehouse(c.warehouse); } }}
                      >
                        <div className={styles.clusterCheck}>
                          <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-7" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </div>
                        <div className={styles.clusterInfo}>
                          <div className={styles.clusterName}>{c.warehouse}</div>
                          <div className={styles.clusterMeta}>{c.rows_count} SKU</div>
                        </div>
                        <div className={styles.clusterStats}>
                          <div className={styles.clusterStat}>
                            <div className={styles.clusterStatLabel}>Кол-во</div>
                            <div className={styles.clusterStatValue}>{c.total_quantity}</div>
                          </div>
                        </div>
                        <span className={`${styles.clusterTag} ${selected ? styles.clusterTagSelected : styles.clusterTagUnselected}`}>{selected ? "Выбран" : "Idle"}</span>
                        {c.draft_id && <span className={styles.clusterTag} style={{ background: "var(--success-dim)", color: "var(--success)", border: "1px solid rgba(34,197,94,0.25)" }}>Черновик создан</span>}
                      </div>
                    );
                  })}
                  {disabledCandidates.map((c) => (
                    <div key={c.warehouse} className={`${styles.clusterRow} ${styles.clusterRowDisabled}`}>
                      <div className={styles.clusterCheck} />
                      <div className={styles.clusterInfo}>
                        <div className={styles.clusterName}>{c.warehouse}</div>
                        <div className={`${styles.clusterMeta}`} style={{ color: "var(--error)" }}>{c.reason || "Нельзя создать черновик"}</div>
                      </div>
                      <span className={`${styles.clusterTag} ${styles.clusterTagError}`}>Ошибка</span>
                    </div>
                  ))}
                  {isRedistributing && <div className={styles.crossdockEmpty}>Пересчитываем распределение…</div>}
                </div>
              </div>
            ) : (
              <div>
                <div className={styles.clustersHead}>
                  <div>
                    <div className={styles.clustersTitle}>Точка кросс-докинга</div>
                    <div className={styles.clustersSub}>Вся поставка одной партией уедет на выбранный кросс-докинг центр</div>
                  </div>
                  {selectedDropOffName && <span className={styles.clustersCount}>Выбрано: {selectedDropOffName}</span>}
                </div>
                <div className={`${shell.card}`} style={{ padding: 16 }}>
                  <div className={styles.crossdockSearch}>
                    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="M21 21l-4.3-4.3" /></svg>
                    <input
                      type="text"
                      placeholder="Найти город…"
                      value={dropOffSearch}
                      onChange={(e) => { setDropOffSearch(e.target.value); setSelectedDropOffName(""); }}
                      autoComplete="off"
                    />
                  </div>
                  <div className={styles.crossdockList}>
                    {isSearchingDropOffs && <div className={styles.crossdockEmpty}>Ищем точки…</div>}
                    {!isSearchingDropOffs && !dropOffPoints.length && dropOffSearch.trim().length >= 2 && (
                      <div className={styles.crossdockEmpty}>Ничего не найдено</div>
                    )}
                    {dropOffPoints.map((p) => (
                      <div
                        key={p.id}
                        className={`${styles.crossdockRow} ${dropOffPointId === p.id ? styles.crossdockRowSelected : ""}`}
                        onClick={() => selectDropOffPoint(p)}
                      >
                        <div className={styles.crossdockRadio} />
                        <div className={styles.crossdockInfo}>
                          <div className={styles.crossdockName}>{p.name}</div>
                          {p.address && <div className={styles.crossdockMeta}>{p.address}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Action bar */}
            <div className={`${shell.card} ${styles.actionBar}`}>
              <div className={styles.actionTotals}>
                <div><div className={styles.totalLabel}>Кластеров</div><div className={styles.totalValue}>{selectedCandidates.length}</div></div>
                <div className={styles.totalDivider} />
                <div><div className={styles.totalLabel}>Итого SKU</div><div className={styles.totalValue}>{selectedQuantity}</div></div>
              </div>
              <button className={styles.btnPrimary} onClick={createDrafts} disabled={!canCreateDrafts}>
                {isCreatingDrafts && <span className={styles.spinner} />}
                {isCreatingDrafts ? "Создаём черновики…" : "Создать черновики через API →"}
              </button>
            </div>

            {draftStatus && (
              <div className={`${shell.card} ${styles.banner} ${draftStatus.type === "error" ? styles.bannerError : ""}`} style={{ padding: "12px 16px" }}>
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke={draftStatus.type === "error" ? "var(--error)" : "var(--accent)"} strokeWidth={2}><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4m0 4h.01" /></svg>
                <p>{draftStatus.message}</p>
              </div>
            )}
          </>
        )}
      </div>

      {toast && <div className={`${styles.toast} ${styles.show}`}>{toast}</div>}
    </main>
  );
}
