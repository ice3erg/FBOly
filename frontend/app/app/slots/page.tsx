"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../AppContext";
import shell from "../shell.module.css";
import styles from "./slots.module.css";
import { API_URL, createBrowserId, formatRequestError } from "@/lib/api";
import type { DraftCandidate, SlotHunterJob } from "@/lib/types";

const CARGO_LABELS = ["Любой", "Короба", "Паллеты"] as const;
const CARGO_VALUES = ["any", "box", "pallet"] as const;

function formatCountdown(iso: string | null | undefined) {
  if (!iso) return null;
  const diff = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 1000));
  const m = Math.floor(diff / 60);
  const s = diff % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function SlotsPage() {
  const router = useRouter();
  const { clientId, apiKey, lastProcessResult } = useApp();
  const hasFullCredentials = Boolean(clientId.trim() && apiKey.trim());

  const uploadedCandidates = (lastProcessResult?.draft_candidates ?? []).filter((c) => c.can_create !== false);

  // Ozon не даёт единого API-метода «показать все черновики» — черновик
  // доступен только по конкретному ID. Поэтому если поставка не обрабатывалась
  // в этой сессии, даём охотиться по черновику, который уже существует в
  // личном кабинете Ozon (создан вручную или в прошлой сессии).
  type ManualEntry = { key: string; warehouse: string; draftId: string };
  const [manualEntries, setManualEntries] = useState<ManualEntry[]>([{ key: createBrowserId("m"), warehouse: "", draftId: "" }]);

  const manualCandidates: DraftCandidate[] = manualEntries
    .filter((e) => e.warehouse.trim() && e.draftId.trim())
    .map((e) => ({ warehouse: e.warehouse.trim(), draft_id: e.draftId.trim(), rows_count: 0, total_quantity: 0, can_create: true }));

  const usingManualEntry = !lastProcessResult;
  const candidates = usingManualEntry ? manualCandidates : uploadedCandidates;

  function addManualEntry() {
    setManualEntries((cur) => [...cur, { key: createBrowserId("m"), warehouse: "", draftId: "" }]);
  }
  function updateManualEntry(key: string, patch: Partial<ManualEntry>) {
    setManualEntries((cur) => cur.map((e) => (e.key === key ? { ...e, ...patch } : e)));
  }
  function removeManualEntry(key: string) {
    setManualEntries((cur) => (cur.length > 1 ? cur.filter((e) => e.key !== key) : cur));
  }

  const [autoBook, setAutoBook] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [timeFrom, setTimeFrom] = useState("09:00");
  const [timeTo, setTimeTo] = useState("18:00");
  const [cargoIdx, setCargoIdx] = useState(0);
  const [selectedWarehouses, setSelectedWarehouses] = useState<string[]>([]);
  const [priorityWarehouses, setPriorityWarehouses] = useState<string[]>([]);
  const [openTraceFor, setOpenTraceFor] = useState<string | null>(null);

  const [job, setJob] = useState<SlotHunterJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [checksCount, setChecksCount] = useState(0);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (selectedWarehouses.length === 0 && candidates.length > 0) {
      setSelectedWarehouses(candidates.map((c) => c.warehouse));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates.length]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  function toggleWarehouse(w: string) {
    setSelectedWarehouses((cur) => (cur.includes(w) ? cur.filter((x) => x !== w) : [...cur, w]));
  }
  function togglePriority(w: string) {
    setPriorityWarehouses((cur) => (cur.includes(w) ? cur.filter((x) => x !== w) : [...cur, w]));
  }

  async function refresh(jobId = job?.id) {
    if (!jobId) return;
    setIsRefreshing(true);
    try {
      const response = await fetch(`${API_URL}/api/slot-hunter/jobs/${jobId}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail ?? "Не удалось обновить статус охотника");
      setJob(payload as SlotHunterJob);
      setError(null);
      setChecksCount((c) => c + 1);
    } catch (err) {
      setError(formatRequestError(err, "Ошибка обновления охотника"));
    } finally {
      setIsRefreshing(false);
    }
  }

  // Автообновление, пока задача активна
  useEffect(() => {
    if (!job || ["completed", "stopped", "failed"].includes(job.status)) return;
    const id = setInterval(() => refresh(job.id), 8000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, job?.status]);

  // Тикающий обратный отсчёт до следующей попытки
  useEffect(() => {
    if (!job?.next_attempt_at) { setCountdown(null); return; }
    const update = () => setCountdown(formatCountdown(job.next_attempt_at));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [job?.next_attempt_at]);

  async function startHunt() {
    if (!candidates.length) {
      setError("Обработайте поставку на странице «Поставка» или укажите город и ID черновика вручную выше.");
      return;
    }
    const huntCandidates = candidates.filter((c) => selectedWarehouses.includes(c.warehouse));
    if (!huntCandidates.length) {
      setError("Выберите хотя бы один город для охоты.");
      return;
    }
    if (!hasFullCredentials) {
      setError("Введите Client-Id и Api-Key Ozon в профиле.");
      return;
    }
    const totalQuantity = huntCandidates.reduce((sum, c) => sum + Number(c.total_quantity || 0), 0);
    const approved = window.confirm(
      autoBook
        ? `Запустить охотника и автоматически бронировать найденные слоты для ${huntCandidates.length} городов на ${totalQuantity} шт.?`
        : `Запустить охотника в режиме уведомления для ${huntCandidates.length} городов на ${totalQuantity} шт.?`,
    );
    if (!approved) return;

    setIsStarting(true);
    setError(null);
    try {
      const settings = {
        auto_book: autoBook,
        interval_seconds: 15,
        max_minutes: 60 * 24,
        concurrency_limit: 3,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        time_from: timeFrom || undefined,
        time_to: timeTo || undefined,
        cargo_type: CARGO_VALUES[cargoIdx],
        selected_warehouses: selectedWarehouses,
        priority_warehouses: priorityWarehouses,
      };
      const response = await fetch(`${API_URL}/api/slot-hunter/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId.trim(), api_key: apiKey.trim(), candidates: huntCandidates, settings }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail ?? "Не удалось запустить охотника на слоты");
      setJob(payload as SlotHunterJob);
      setChecksCount(0);
    } catch (err) {
      setError(formatRequestError(err, "Ошибка запуска охотника"));
    } finally {
      setIsStarting(false);
    }
  }

  async function stopHunt() {
    if (!job) return;
    setIsStopping(true);
    try {
      const response = await fetch(`${API_URL}/api/slot-hunter/jobs/${job.id}/stop`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail ?? "Не удалось остановить охотника");
      setJob(payload as SlotHunterJob);
      setToast("Охота остановлена");
    } catch (err) {
      setError(formatRequestError(err, "Ошибка остановки охотника"));
    } finally {
      setIsStopping(false);
    }
  }

  const totalQty = candidates.filter((c) => selectedWarehouses.includes(c.warehouse)).reduce((s, c) => s + Number(c.total_quantity || 0), 0);
  const isActive = job && !["completed", "stopped", "failed"].includes(job.status);

  return (
    <main className={shell.main}>
      <div className={shell.pageHeader}>
        <div>
          <h1 className={shell.pageTitle}>Охотник на слоты</h1>
          <p className={shell.pageSub}>FBOly проверяет доступные окна и бронирует подходящий слот по готовым черновикам.</p>
        </div>
        <button className={shell.btnGhost} onClick={() => router.push("/app/supply")}>← К поставке</button>
      </div>

      <div className={shell.content}>
        <>
          {usingManualEntry ? (
            <div className={`${shell.card} ${styles.panel}`} style={{ gap: 12 }}>
              <div className={styles.panelLabel}>Черновик уже есть в Ozon?</div>
              <p style={{ fontSize: 12.5, color: "var(--text-sec)", margin: "-4px 0 4px" }}>
                Поставка не обрабатывалась в этой сессии — Ozon не даёт получить список черновиков автоматически.
                Укажите город и ID черновика вручную, чтобы запустить охоту без повторной загрузки Excel.
              </p>
              {manualEntries.map((e) => (
                <div key={e.key} style={{ display: "flex", gap: 8 }}>
                  <input
                    className={styles.fieldInput}
                    style={{ flex: 1, height: 38 }}
                    placeholder="Город (например, Москва — Юг)"
                    value={e.warehouse}
                    onChange={(ev) => updateManualEntry(e.key, { warehouse: ev.target.value })}
                  />
                  <input
                    className={styles.fieldInput}
                    style={{ flex: 1, height: 38, fontFamily: "var(--font-mono)" }}
                    placeholder="ID черновика"
                    value={e.draftId}
                    onChange={(ev) => updateManualEntry(e.key, { draftId: ev.target.value })}
                  />
                  {manualEntries.length > 1 && (
                    <button className={styles.btnSm} onClick={() => removeManualEntry(e.key)} aria-label="Удалить">×</button>
                  )}
                </div>
              ))}
              <button className={shell.btnText} style={{ alignSelf: "flex-start" }} onClick={addManualEntry}>+ Добавить ещё черновик</button>
            </div>
          ) : (
            <>
              {/* Mini stepper */}
              <div className={`${shell.card} ${styles.stepperCard}`}>
                <div className={styles.stepperTrack}><div className={styles.stepperFill} style={{ transform: "scaleX(1)" }} /></div>
                <div className={styles.stepperSteps}>
                  <div className={styles.step}>
                    <div className={`${styles.stepDot} ${styles.stepDotDone}`}>
                      <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-7" stroke="#22C55E" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </div>
                    <div><div className={`${styles.stepLabel} ${styles.stepLabelDone}`}>Загрузить Excel</div><div className={styles.stepSub}>Готово</div></div>
                  </div>
                  <div className={styles.step}>
                    <div className={`${styles.stepDot} ${styles.stepDotDone}`}>
                      <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-7" stroke="#22C55E" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </div>
                    <div><div className={`${styles.stepLabel} ${styles.stepLabelDone}`}>Подготовить</div><div className={styles.stepSub}>{candidates.length} черновика</div></div>
                  </div>
                  <div className={styles.step}>
                    <div className={`${styles.stepDot} ${styles.stepDotActive}`}>3</div>
                    <div><div className={`${styles.stepLabel} ${styles.stepLabelCurrent}`}>Найти слот</div><div className={styles.stepSub}>{isActive ? "Поиск идёт" : "Готово к поиску"}</div></div>
                  </div>
                </div>
              </div>

              {/* Ready banner */}
              <div className={`${shell.card} ${styles.readyCard}`}>
                <div className={styles.readyIcon}>
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#22C55E" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div className={styles.readyTitle}>Черновики готовы</div>
                  <div className={styles.readySub}>Начнём поиск слотов по выбранным черновикам</div>
                </div>
                <div className={styles.readyMeta}>
                  <div className={styles.readyMetaN}>{candidates.length} кластера · {candidates.reduce((s, c) => s + Number(c.total_quantity || 0), 0)} шт.</div>
                  <div className={styles.readyMetaL}>{candidates.map((c) => c.warehouse).join(", ")}</div>
                </div>
              </div>
            </>
          )}

            {error && (
              <div className={`${shell.card} ${styles.cityErrorBox}`} style={{ borderLeftWidth: 3 }}>
                <div className={styles.cityErrorTitle}>{error}</div>
              </div>
            )}

            <div className={styles.huntLayout}>
              {/* LEFT: settings */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div className={`${shell.card} ${styles.panel}`}>
                  <div className={styles.toggleRow}>
                    <div><div className={styles.toggleTitle}>Автоматически бронировать</div><div className={styles.toggleSub}>Захватить первый подходящий слот</div></div>
                    <button
                      type="button"
                      className={`${styles.switchEl} ${autoBook ? styles.switchOn : ""}`}
                      role="switch"
                      aria-checked={autoBook}
                      onClick={() => setAutoBook((v) => !v)}
                      disabled={Boolean(isActive)}
                    >
                      <span className={styles.switchKnob} />
                    </button>
                  </div>
                </div>

                <div className={`${shell.card} ${styles.panel}`}>
                  <div className={styles.panelLabel}>Параметры окна</div>
                  <div className={styles.fieldGrid}>
                    <div><div className={styles.fieldLabel}>Дата от</div><input className={styles.fieldInput} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} disabled={Boolean(isActive)} /></div>
                    <div><div className={styles.fieldLabel}>Дата до</div><input className={styles.fieldInput} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} disabled={Boolean(isActive)} /></div>
                  </div>
                  <div className={styles.fieldGrid}>
                    <div><div className={styles.fieldLabel}>Время от</div><input className={styles.fieldInput} type="time" value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} disabled={Boolean(isActive)} /></div>
                    <div><div className={styles.fieldLabel}>Время до</div><input className={styles.fieldInput} type="time" value={timeTo} onChange={(e) => setTimeTo(e.target.value)} disabled={Boolean(isActive)} /></div>
                  </div>
                </div>

                <div className={`${shell.card} ${styles.panel}`}>
                  <div className={styles.panelLabel}>Формат поставки</div>
                  <div className={styles.fmtRow} role="radiogroup" aria-label="Формат поставки">
                    <div className={styles.fmtIndicator} style={{ transform: `translateX(${cargoIdx * 100}%)` }} />
                    {CARGO_LABELS.map((label, idx) => (
                      <button
                        key={label}
                        type="button"
                        role="radio"
                        aria-checked={cargoIdx === idx}
                        className={`${styles.fmtBtn} ${cargoIdx === idx ? styles.fmtBtnActive : ""}`}
                        onClick={() => setCargoIdx(idx)}
                        disabled={Boolean(isActive)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={`${shell.card} ${styles.panel}`}>
                  <div className={styles.panelLabel}>География и приоритет</div>
                  {candidates.map((c) => {
                    const selected = selectedWarehouses.includes(c.warehouse);
                    const priorityIdx = priorityWarehouses.indexOf(c.warehouse);
                    return (
                      <div key={c.warehouse} className={styles.geoRow} onClick={() => !isActive && toggleWarehouse(c.warehouse)}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div className={`${styles.geoCheck} ${selected ? "" : styles.geoCheckOff}`}>
                            {selected && <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l3 3 4-5" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></svg>}
                          </div>
                          <span className={styles.geoName}>{c.warehouse}</span>
                        </div>
                        <button
                          type="button"
                          className={`${styles.geoPill} ${priorityIdx >= 0 ? "" : styles.geoPillOff}`}
                          onClick={(e) => { e.stopPropagation(); if (!isActive) togglePriority(c.warehouse); }}
                          title="Приоритетный город проверяется чаще"
                        >
                          {priorityIdx >= 0 ? `П${priorityIdx + 1}` : "—"}
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className={styles.summaryLine}>Для охоты: <b>{selectedWarehouses.length}</b> города · <b>{totalQty}</b> шт.</div>

                {isActive ? (
                  <button className={`${styles.btnHunt} ${styles.btnHuntStop}`} onClick={stopHunt} disabled={isStopping}>
                    {isStopping && <span className={styles.spinner} />}
                    {isStopping ? "Останавливаем…" : "Остановить охоту"}
                  </button>
                ) : (
                  <button className={styles.btnHunt} onClick={startHunt} disabled={isStarting || !hasFullCredentials}>
                    {isStarting && <span className={styles.spinner} />}
                    {isStarting ? "Запускаем…" : "Начать охоту →"}
                  </button>
                )}
              </div>

              {/* RIGHT: results */}
              {!job ? (
                <div className={`${shell.card} ${styles.resultsPlaceholder}`}>
                  Нажмите «Начать охоту», чтобы запустить поиск слотов по готовым черновикам.
                </div>
              ) : (
                <div className={styles.resultsCol}>
                  <div className={`${shell.card} ${styles.statusCard}`}>
                    <div className={styles.statusHead}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <div className={`${styles.statusDot} ${isActive ? styles.statusDotLive : styles.statusDotStopped}`} />
                        <span className={styles.statusTitle}>{isActive ? "Поиск слотов" : job.status === "completed" ? "Охота завершена" : "Остановлено"}</span>
                      </div>
                      <div className={styles.statusActions}>
                        <button className={styles.btnSm} onClick={() => refresh()} disabled={isRefreshing}>{isRefreshing ? "Обновляем…" : "Обновить"}</button>
                        {isActive && <button className={styles.btnSm} onClick={stopHunt} disabled={isStopping}>Остановить</button>}
                      </div>
                    </div>
                    <div className={styles.statsGrid}>
                      <div className={styles.statCell}><div className={styles.statCellLabel}>Статус</div><div className={styles.statCellValue} style={{ color: isActive ? "var(--warning)" : "var(--text)" }}>{isActive ? "Поиск" : job.status}</div></div>
                      <div className={styles.statCell}><div className={styles.statCellLabel}>Режим</div><div className={styles.statCellValue}>{job.mode === "auto_book" ? "Авто" : "Уведомление"}</div></div>
                      <div className={styles.statCell}><div className={styles.statCellLabel}>Забронировано</div><div className={styles.statCellValue} style={{ color: "var(--success)" }}>{job.summary.booked}</div></div>
                      <div className={styles.statCell}><div className={styles.statCellLabel}>Найдено</div><div className={styles.statCellValue}>{job.summary.found}</div></div>
                      <div className={styles.statCell}><div className={styles.statCellLabel}>В поиске</div><div className={styles.statCellValue} style={{ color: "var(--warning)" }}>{job.summary.searching}</div></div>
                      <div className={styles.statCell}><div className={styles.statCellLabel}>Ошибки</div><div className={styles.statCellValue} style={{ color: "var(--error)" }}>{job.summary.failed}</div></div>
                    </div>
                    <div className={styles.statusFoot}>
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="var(--text-muted)" strokeWidth={1.8}><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 6v6l4 2" /></svg>
                      {countdown && <span>Следующая попытка через: <b>{countdown}</b></span>}
                      <span style={{ marginLeft: "auto" }}>Проверок: <b>{checksCount}</b></span>
                    </div>
                  </div>

                  <div className={styles.citiesLabel}>Города и склады</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {job.targets.map((target) => {
                      const isSuccess = ["booked", "found"].includes(target.status);
                      const isError = target.status === "failed";
                      const isSearching = !isSuccess && !isError;
                      const traceOpen = openTraceFor === target.id;
                      return (
                        <div key={target.id} className={`${shell.card} ${styles.cityCard} ${isSuccess ? styles.cityCardSuccess : isError ? styles.cityCardError : ""}`}>
                          <div className={styles.cityHead}>
                            <div className={styles.cityDot} style={{ background: isSuccess ? "var(--success)" : isError ? "var(--error)" : "var(--warning)" }} />
                            <span className={styles.cityName}>{target.warehouse}</span>
                            <span className={`${styles.cityBadge} ${isSuccess ? styles.cityBadgeSuccess : isError ? styles.cityBadgeError : styles.cityBadgeSearching}`}>
                              {target.status === "booked" ? "Забронировано" : target.status === "found" ? "Слот найден" : isError ? "Ошибка" : "Поиск"}
                            </span>
                          </div>

                          {isSuccess && (
                            <div className={styles.cityBodySuccess}>
                              <div><div className={styles.fieldMiniLabel}>Черновик</div><div className={styles.fieldMiniValue} style={{ color: "var(--text-sec)", fontFamily: "var(--font-mono)", fontSize: 11 }}>{target.draft_id || "—"}</div></div>
                              <div><div className={styles.fieldMiniLabel}>Заявка</div><div className={styles.fieldMiniValue}>{target.supply_order_id || "готовим…"}</div></div>
                            </div>
                          )}
                          {isSearching && (
                            <div className={styles.cityBodySearch}>
                              <svg className={styles.spinner} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth={2.4}><circle cx="12" cy="12" r="9" strokeOpacity="0.25" /><path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" /></svg>
                              <span className={styles.citySearchText}>{target.last_message || "Проверяем доступные окна…"}</span>
                            </div>
                          )}
                          {isError && (
                            <div className={styles.cityErrorBox}>
                              <div className={styles.cityErrorTitle}>{target.last_message || "Не удалось найти слот"}</div>
                              {target.error_message && <div className={styles.cityErrorSub}>{target.error_message.slice(0, 140)}</div>}
                              <div className={styles.cityErrorActions}>
                                <button className={styles.btnTrace} onClick={() => setOpenTraceFor(traceOpen ? null : target.id)}>{traceOpen ? "Скрыть" : "Подробнее"}</button>
                                <button className={styles.btnRetry} onClick={() => refresh()}>Повторить</button>
                              </div>
                              <div className={`${styles.traceBox} ${traceOpen ? styles.open : ""}`}>
                                <div className={styles.traceInner}><pre>{target.error_message || "Нет дополнительной информации."}</pre></div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
      </div>

      {toast && <div className={`${styles.toast} ${styles.show}`}>{toast}</div>}
    </main>
  );
}
