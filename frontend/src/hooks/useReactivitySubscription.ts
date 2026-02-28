"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ── Types ────────────────────────────────────────────────

export interface ReactivityEvent {
  id: string;
  emitter: string;
  topics: string[];
  data: string; // raw hex
  timestamp: number;
}

interface UseReactivitySubscriptionParams {
  emitterFilter?: string; // contract address to watch
  topicFilter?: string;   // event topic hash
  enabled: boolean;       // pause subscription when false
}

interface UseReactivitySubscriptionReturn {
  events: ReactivityEvent[];
  isConnected: boolean;
  error: string | null;
  clearEvents: () => void;
}

// ── Constants ────────────────────────────────────────────

const WS_URL = "wss://dream-rpc.somnia.network";
const MAX_EVENTS = 100;
const RECONNECT_DELAY = 3000;

// ── Hook ─────────────────────────────────────────────────

export function useReactivitySubscription(
  params: UseReactivitySubscriptionParams
): UseReactivitySubscriptionReturn {
  const [events, setEvents] = useState<ReactivityEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subscriptionIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  // Cleanup helper
  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      if (
        wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING
      ) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
    subscriptionIdRef.current = null;
    setIsConnected(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    if (!params.enabled) {
      cleanup();
      return;
    }

    function connect() {
      // Guard against double-connect
      if (wsRef.current) return;

      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!mountedRef.current) return;
          setIsConnected(true);
          setError(null);

          // Send JSON-RPC subscription request
          const subscribeMsg = {
            jsonrpc: "2.0",
            id: 1,
            method: "somnia_subscribe",
            params: [
              "events",
              {
                emitter: params.emitterFilter ?? null,
                topic: params.topicFilter ?? null,
              },
            ],
          };
          ws.send(JSON.stringify(subscribeMsg));
        };

        ws.onmessage = (messageEvent: MessageEvent) => {
          if (!mountedRef.current) return;

          try {
            const parsed: unknown = JSON.parse(
              messageEvent.data as string
            );

            if (
              typeof parsed !== "object" ||
              parsed === null
            ) {
              return;
            }

            const msg = parsed as Record<string, unknown>;

            // Handle subscription confirmation
            if (msg["id"] === 1 && typeof msg["result"] === "string") {
              subscriptionIdRef.current = msg["result"];
              return;
            }

            // Handle subscription event
            if (
              msg["method"] === "somnia_subscription" &&
              typeof msg["params"] === "object" &&
              msg["params"] !== null
            ) {
              const msgParams = msg["params"] as Record<string, unknown>;
              const result = msgParams["result"] as
                | Record<string, unknown>
                | undefined;

              if (!result) return;

              const event: ReactivityEvent = {
                id: crypto.randomUUID(),
                emitter: (result["emitter"] as string) ?? "",
                topics: Array.isArray(result["topics"])
                  ? (result["topics"] as string[])
                  : [],
                data: (result["data"] as string) ?? "0x",
                timestamp: Math.floor(Date.now() / 1000),
              };

              setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));
            }
          } catch {
            // Silently ignore unparseable messages
          }
        };

        ws.onclose = () => {
          if (!mountedRef.current) return;
          wsRef.current = null;
          subscriptionIdRef.current = null;
          setIsConnected(false);

          // Schedule reconnect
          reconnectTimerRef.current = setTimeout(() => {
            if (mountedRef.current && params.enabled) {
              connect();
            }
          }, RECONNECT_DELAY);
        };

        ws.onerror = () => {
          if (!mountedRef.current) return;
          setError("WebSocket connection error");
        };
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create WebSocket"
        );
      }
    }

    connect();

    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [params.enabled, params.emitterFilter, params.topicFilter, cleanup]);

  return { events, isConnected, error, clearEvents };
}
