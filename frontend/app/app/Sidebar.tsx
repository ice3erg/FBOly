"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./shell.module.css";
import { useApp } from "./AppContext";
import { BrandMark } from "../BrandMark";

const NAV_ITEMS = [
  {
    href: "/app/supply",
    label: "Поставка",
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
      </svg>
    ),
  },
  {
    href: "/app/slots",
    label: "Охота на слоты",
    badge: "LIVE",
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <circle cx="12" cy="12" r="3" />
        <path strokeLinecap="round" d="M12 5v2m0 10v2M5 12H3m18 0h-2M7.05 7.05 5.636 5.636m12.728 12.728L16.95 16.95M7.05 16.95 5.636 18.364M18.364 5.636 16.95 7.05" />
      </svg>
    ),
  },
  {
    href: "/app/profile",
    label: "Магазин",
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
];

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "??";
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, activeStore, connectionStatus } = useApp();

  const dotClass =
    connectionStatus.type === "success"
      ? styles.userDot
      : connectionStatus.type === "error"
        ? `${styles.userDot} ${styles.error}`
        : `${styles.userDot} ${styles.offline}`;

  return (
    <>
      <div className={styles.sidebarRailSpace} aria-hidden="true" />
      <aside className={styles.sidebar}>
        <Link className={styles.sidebarLogo} href="/" aria-label="FBOly — на главную">
          <BrandMark size={24} />
        </Link>

        <nav className={styles.sidebarNav}>
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
                aria-current={active ? "page" : undefined}
                title={item.label}
              >
                {item.icon}
                <span className={styles.sidebarExpandText}>{item.label}</span>
                {item.badge && <span className={`${styles.navBadge} ${styles.sidebarExpandText}`}>{item.badge}</span>}
              </Link>
            );
          })}
        </nav>

        <Link href="/app/profile" className={styles.sidebarUser} title="Профиль и магазин">
          <div className={styles.userAvatar}>{initialsOf(user.name)}</div>
          <div className={`${styles.userMeta} ${styles.sidebarExpandText}`}>
            <div className={styles.userName}>{user.name}</div>
            <div className={styles.userSub}>
              {activeStore ? `${activeStore.title} · ${connectionStatus.type === "success" ? "подключён" : connectionStatus.type === "error" ? "ошибка" : "не проверен"}` : "Магазин не выбран"}
            </div>
          </div>
          <div className={dotClass} aria-hidden="true" title="Статус подключения магазина" />
        </Link>
      </aside>
    </>
  );
}
