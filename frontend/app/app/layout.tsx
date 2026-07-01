"use client";

import type { ReactNode } from "react";
import { AppProvider, useApp } from "./AppContext";
import { Sidebar } from "./Sidebar";
import styles from "./shell.module.css";

function Gate({ children }: { children: ReactNode }) {
  const { ready } = useApp();
  // До проверки сессии ничего не рендерим — как и в исходном page.tsx,
  // чтобы не мигать защищённым контентом до редиректа на /auth.
  if (!ready) return null;
  return (
    <div className={styles.app}>
      <Sidebar />
      {children}
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppProvider>
      <Gate>{children}</Gate>
    </AppProvider>
  );
}
