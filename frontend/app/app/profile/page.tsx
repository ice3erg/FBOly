"use client";

import { useEffect, useState } from "react";
import { useApp, type OzonStore } from "../AppContext";
import styles from "./profile.module.css";

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "??";
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export default function ProfilePage() {
  const {
    user,
    setUser,
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
  } = useApp();

  const [firstName, lastName] = [user.name.split(" ")[0] ?? "", user.name.split(" ").slice(1).join(" ")];
  const [fName, setFName] = useState(firstName);
  const [fLast, setFLast] = useState(lastName);
  const [fEmail, setFEmail] = useState(user.email);
  const [fPhone, setFPhone] = useState(() => (typeof window !== "undefined" ? window.localStorage.getItem("fboly-profile-phone") ?? "" : ""));
  const [storeName, setStoreName] = useState(activeStore?.title ?? "");
  const [showApiKey, setShowApiKey] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [notifs, setNotifs] = useState({ slotFound: true, draftCreated: true, apiError: true, digest: false });

  useEffect(() => {
    setStoreName(activeStore?.title ?? "");
  }, [activeStore?.title]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  function markDirty() {
    setDirty(true);
  }

  function handleCancel() {
    setFName(firstName);
    setFLast(lastName);
    setFEmail(user.email);
    setStoreName(activeStore?.title ?? "");
    setDirty(false);
  }

  function handleSave() {
    setSaving(true);
    setTimeout(() => {
      setUser({ ...user, name: `${fName} ${fLast}`.trim(), email: fEmail });
      if (activeStoreId && storeName.trim() && storeName !== activeStore?.title) {
        updateStoreTitle(activeStoreId, storeName.trim());
      }
      window.localStorage.setItem("fboly-profile-phone", fPhone);
      setSaving(false);
      setDirty(false);
      setToast("Изменения сохранены");
    }, 450);
  }

  async function handleCopy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setToast("Скопировано");
    } catch {
      setToast("Не удалось скопировать");
    }
  }

  const statusPillClass =
    connectionStatus.type === "success"
      ? `${styles.statusPill} ${styles.statusPillSuccess}`
      : connectionStatus.type === "error"
        ? `${styles.statusPill} ${styles.statusPillError}`
        : `${styles.statusPill} ${styles.statusPillIdle}`;

  const statusBarClass =
    isCheckingConnection
      ? `${styles.statusBar} ${styles.statusBarChecking}`
      : connectionStatus.type === "error"
        ? `${styles.statusBar} ${styles.statusBarError}`
        : styles.statusBar;

  return (
    <main className={styles.main}>
      <div className={styles.topbar}>
        <h1>Профиль и магазин</h1>
        <div className={styles.topbarActions}>
          <span className={`${styles.dirtyHint} ${dirty ? styles.show : ""}`}>Есть несохранённые изменения</span>
          <button className={styles.btnGhost} onClick={handleCancel} disabled={!dirty}>Отмена</button>
          <button className={styles.btnPrimary} onClick={handleSave} disabled={!dirty || saving}>
            {saving && <span className={styles.spinner} />}
            {saving ? "Сохраняем…" : "Сохранить изменения"}
          </button>
        </div>
      </div>

      <div className={styles.content}>
        {/* Profile */}
        <div className={styles.card}>
          <div className={styles.sectionTitle}>Профиль</div>
          <div className={styles.profileHead}>
            <div className={styles.avatarBig}>{initialsOf(user.name)}</div>
            <div>
              <div className={styles.profileName}>{user.name || "Без имени"}</div>
              <div className={styles.profileEmail}>{user.email}</div>
              <div className={styles.planPill}><div className="dot" style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--success)" }} /><span>Pro план активен</span></div>
            </div>
          </div>
          <div className={styles.fieldGrid}>
            <div>
              <label className={styles.fieldLabel} htmlFor="fName">Имя</label>
              <input className={styles.formInput} id="fName" value={fName} onChange={(e) => { setFName(e.target.value); markDirty(); }} autoComplete="given-name" />
            </div>
            <div>
              <label className={styles.fieldLabel} htmlFor="fLast">Фамилия</label>
              <input className={styles.formInput} id="fLast" value={fLast} onChange={(e) => { setFLast(e.target.value); markDirty(); }} autoComplete="family-name" />
            </div>
            <div>
              <label className={styles.fieldLabel} htmlFor="fEmail">Email</label>
              <input className={styles.formInput} id="fEmail" type="email" value={fEmail} onChange={(e) => { setFEmail(e.target.value); markDirty(); }} autoComplete="email" />
            </div>
            <div>
              <label className={styles.fieldLabel} htmlFor="fPhone">Телефон</label>
              <input className={styles.formInput} id="fPhone" type="tel" placeholder="+7 (999) 000-00-00" value={fPhone} onChange={(e) => { setFPhone(e.target.value); markDirty(); }} autoComplete="tel" />
            </div>
          </div>
        </div>

        {/* Store */}
        <div className={styles.card}>
          <div className={styles.storeHead}>
            <div className={styles.sectionTitle} style={{ marginBottom: 0 }}>Подключение магазина Ozon</div>
            <div className={statusPillClass}>
              <div className="dot" />
              <span>{connectionStatus.type === "success" ? "Подключён" : connectionStatus.type === "error" ? "Ошибка" : "Не проверен"}</span>
            </div>
          </div>

          {/* Селектор магазинов — мульти-магазин из прежней версии, добавлен поверх нового макета (в нём был только один магазин) */}
          <div className={styles.storeTabs} role="tablist" aria-label="Магазины Ozon">
            {stores.map((store: OzonStore) => (
              <button
                key={store.id}
                type="button"
                role="tab"
                aria-selected={store.id === activeStoreId}
                className={`${styles.storeTab} ${store.id === activeStoreId ? styles.storeTabActive : ""}`}
                onClick={() => selectStore(store.id)}
              >
                <span
                  className={styles.storeTabDot}
                  style={{ background: store.status === "success" ? "var(--success)" : store.status === "error" ? "var(--error)" : "var(--text-muted)" }}
                />
                {store.title}
                {stores.length > 1 && (
                  <span
                    className={styles.storeTabRemove}
                    role="button"
                    tabIndex={-1}
                    aria-label={`Удалить магазин ${store.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Удалить магазин «${store.title}»?`)) removeStore(store.id);
                    }}
                  >
                    ×
                  </span>
                )}
              </button>
            ))}
            <button type="button" className={styles.storeTabAdd} onClick={addStore}>+ Добавить магазин</button>
          </div>

          {!activeStore ? (
            <p style={{ fontSize: 13, color: "var(--text-sec)" }}>Добавьте магазин, чтобы подключить кабинет Ozon.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className={styles.fieldGrid}>
                <div>
                  <label className={styles.fieldLabel} htmlFor="fClientId">Client-Id</label>
                  <div className={styles.inputWithBtn}>
                    <input className={styles.formInput} id="fClientId" type="text" value={clientId} onChange={(e) => handleClientIdChange(e.target.value)} />
                    <button className={styles.inputBtn} type="button" onClick={() => handleCopy(clientId)}>Скопировать</button>
                  </div>
                  <div className={styles.fieldHint}>ID вашего магазина в Ozon Seller</div>
                </div>
                <div>
                  <label className={styles.fieldLabel} htmlFor="fApiKey">API Key</label>
                  <div className={styles.inputWithBtn}>
                    <input className={styles.formInput} id="fApiKey" type={showApiKey ? "text" : "password"} value={apiKey} onChange={(e) => handleApiKeyChange(e.target.value)} />
                    <button className={styles.inputBtn} type="button" onClick={() => setShowApiKey((s) => !s)}>{showApiKey ? "Скрыть" : "Показать"}</button>
                  </div>
                  <div className={styles.fieldHint}>API ключ из раздела «Настройки → API» в Ozon Seller</div>
                </div>
              </div>

              <div className={statusBarClass}>
                <div className={styles.statusBarIcon}>
                  {connectionStatus.type === "success" ? (
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#22C55E" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  ) : connectionStatus.type === "error" ? (
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--error)" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                  ) : (
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--text-muted)" strokeWidth={2}><circle cx="12" cy="12" r="9" /></svg>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div className={styles.statusBarTitle}>
                    {isCheckingConnection ? "Проверяем подключение…" : connectionStatus.message}
                  </div>
                  <div className={styles.statusBarSub}>
                    {activeStore.checkedAt ? `Последняя проверка: ${new Date(activeStore.checkedAt).toLocaleString("ru-RU")}` : "Ещё не проверялось"}
                  </div>
                </div>
                <button className={styles.btnGhost} style={{ height: 32, padding: "0 12px", fontSize: 12 }} onClick={() => activeStoreId && checkStoreConnection(activeStoreId)} disabled={isCheckingConnection}>
                  Проверить
                </button>
              </div>

              <div>
                <label className={styles.fieldLabel} htmlFor="fStoreName">Название магазина (отображается в поставках)</label>
                <input className={styles.formInput} id="fStoreName" type="text" value={storeName} onChange={(e) => { setStoreName(e.target.value); markDirty(); }} />
              </div>
            </div>
          )}
        </div>

        {/* Plan — визуально из макета; реальной оплаты/биллинга в бэкенде нет */}
        <div className={styles.card}>
          <div className={styles.sectionTitle}>Тариф</div>
          <div className={styles.plansGrid} role="radiogroup" aria-label="Тарифный план">
            <div className={`${styles.planCard} ${styles.planCardDim}`}>
              <div className={styles.planName}>Старт</div>
              <div className={styles.planPrice}>0 ₽</div>
              <div className={styles.planFoot}>5 поставок / мес</div>
            </div>
            <div className={`${styles.planCard} ${styles.planCardCurrent}`}>
              <div className={styles.planCurrentTag}>Текущий</div>
              <div className={styles.planName}>Pro</div>
              <div className={styles.planPrice}>1 490 ₽</div>
              <div className={styles.planFoot}>Безлимит · приоритет слотов</div>
            </div>
            <div className={styles.planCard}>
              <div className={styles.planName}>Команда</div>
              <div className={styles.planPrice}>3 990 ₽</div>
              <div className={styles.planFoot}>До 5 пользователей</div>
            </div>
          </div>
          <div className={styles.billingRow}>
            <div>
              <div className={styles.billingTitle}>Следующее списание</div>
              <div className={styles.billingDate}>15 июля 2026 · 1 490 ₽</div>
            </div>
            <div className={styles.billingActions}>
              <button className={styles.btnGhost} style={{ height: 32, padding: "0 12px", fontSize: 12 }} onClick={() => setToast("Смена тарифа скоро появится")}>Сменить тариф</button>
            </div>
          </div>
          <div className={styles.planNote}>Оплата и смена тарифа пока не подключены — раздел информационный.</div>
        </div>

        {/* Notifications — локальные предпочтения, без синхронизации с сервером */}
        <div className={styles.card}>
          <div className={styles.sectionTitle}>Уведомления</div>
          <div>
            {([
              ["slotFound", "Слот найден", "Когда система захватила нужный слот"],
              ["draftCreated", "Черновик создан", "После успешного создания через API"],
              ["apiError", "Ошибка API", "При проблемах с ключом или лимитом"],
              ["digest", "Email-дайджест", "Сводка поставок раз в неделю"],
            ] as const).map(([key, title, sub]) => (
              <label key={key} className={styles.notifRow}>
                <div><div className={styles.notifTitle}>{title}</div><div className={styles.notifSub}>{sub}</div></div>
                <span className={styles.toggle}>
                  <input type="checkbox" checked={notifs[key]} onChange={(e) => setNotifs((n) => ({ ...n, [key]: e.target.checked }))} />
                  <span className={styles.toggleTrack} />
                  <span className={styles.toggleThumb} />
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Danger zone */}
        <div className={`${styles.card} ${styles.dangerCard}`}>
          <div className={styles.sectionTitle} style={{ color: "var(--error)" }}>Опасная зона</div>
          <div className={styles.dangerRow}>
            <div>
              <div className={styles.dangerTitle}>Удалить аккаунт</div>
              <div className={styles.dangerSub}>Все данные, поставки и настройки будут удалены безвозвратно</div>
            </div>
            <button className={styles.btnDanger} onClick={() => setShowDeleteModal(true)}>Удалить аккаунт</button>
          </div>
        </div>
      </div>

      <div className={`${styles.modalBackdrop} ${showDeleteModal ? styles.open : ""}`}>
        <div className={styles.modalCard} role="alertdialog" aria-modal="true">
          <div className={styles.modalIcon}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="var(--error)" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          </div>
          <div className={styles.modalTitle}>Удалить аккаунт?</div>
          <div className={styles.modalText}>
            Удаление аккаунта на сервере пока не реализовано. Мы можем выйти из аккаунта и очистить сохранённые
            на этом устройстве данные (магазины, ключи, профиль) прямо сейчас.
          </div>
          <div className={styles.modalActions}>
            <button className={styles.btnGhost} onClick={() => setShowDeleteModal(false)}>Отмена</button>
            <button
              className={styles.btnDanger}
              onClick={() => {
                window.localStorage.removeItem("ozon-fbo-service-stores");
                window.localStorage.removeItem("ozon-fbo-service-active-store");
                window.localStorage.removeItem("ozon-fbo-service-user");
                window.localStorage.removeItem("fboly-profile-phone");
                window.localStorage.removeItem("fboly-auth-session");
                window.location.href = "/auth";
              }}
            >
              Да, выйти и очистить данные
            </button>
          </div>
        </div>
      </div>

      {toast && <div className={`${styles.toast} ${styles.show}`}>{toast}</div>}
    </main>
  );
}
