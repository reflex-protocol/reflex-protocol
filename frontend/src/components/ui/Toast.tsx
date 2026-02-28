"use client";

import { useCallback, useState } from "react";
import styles from "./Toast.module.css";

export type ToastVariant = "error" | "success" | "info";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

let nextId = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  return { toasts, show };
}

const VARIANT_ICON: Record<ToastVariant, string> = {
  error: "✕",
  success: "✓",
  info: "ℹ",
};

export function ToastContainer({ toasts }: { toasts: ToastItem[] }) {
  if (toasts.length === 0) return null;

  return (
    <div className={styles.container}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`${styles.toast} ${styles[t.variant]}`}
        >
          <span className={styles.icon}>{VARIANT_ICON[t.variant]}</span>
          <span className={styles.message}>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
