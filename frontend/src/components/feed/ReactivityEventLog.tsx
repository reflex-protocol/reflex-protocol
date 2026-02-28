"use client";

import styles from "./ReactivityEventLog.module.css";

// ── Types ────────────────────────────────────────────────

export type EventType =
  | "PRICE_UPDATE"
  | "PROTECTION_TRIGGERED"
  | "EMERGENCY_EXIT"
  | "INSURANCE_PAID";

export interface ReactivityEvent {
  id: string;
  type: EventType;
  timestamp: number;
  txHash: string | null;
  details: string;
}

interface ReactivityEventLogProps {
  events: ReactivityEvent[];
}

// ── Helpers ──────────────────────────────────────────────

const TYPE_CONFIG: Record<
  EventType,
  { icon: string; color: string; label: string }
> = {
  PRICE_UPDATE: {
    icon: "◈",
    color: "var(--color-accent)",
    label: "Price Update",
  },
  PROTECTION_TRIGGERED: {
    icon: "⚡",
    color: "var(--color-warn)",
    label: "Protection",
  },
  EMERGENCY_EXIT: {
    icon: "⬡",
    color: "var(--color-danger)",
    label: "Emergency",
  },
  INSURANCE_PAID: {
    icon: "◉",
    color: "var(--color-success)",
    label: "Insurance",
  },
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

// ── Component ────────────────────────────────────────────

export default function ReactivityEventLog({
  events,
}: ReactivityEventLogProps) {
  if (events.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyPulse} />
        <span>Listening for events...</span>
      </div>
    );
  }

  return (
    <div className={styles.log}>
      {events.slice(0, 50).map((evt, i) => {
        const config = TYPE_CONFIG[evt.type];
        return (
          <div
            key={evt.id}
            className={styles.event}
            style={{
              animationDelay: `${i * 30}ms`,
              borderLeftColor: config.color,
            }}
          >
            <div className={styles.eventHeader}>
              <span
                className={styles.eventIcon}
                style={{ color: config.color }}
              >
                {config.icon}
              </span>
              <span className={styles.eventLabel}>{config.label}</span>
              <span className={styles.eventTime}>
                {formatTime(evt.timestamp)}
              </span>
            </div>
            <div className={styles.eventDetails}>{evt.details}</div>
          </div>
        );
      })}
    </div>
  );
}
