import { useEffect, useRef, useState } from 'react';
import { auth } from './firebase';
import type { NoteChatMessage, NoteChatThread } from '../types/marketplace';

export type ChatWsEvent =
  | { type: 'chat:connected'; uid: string }
  | { type: 'chat:message'; thread: NoteChatThread; message: NoteChatMessage }
  | { type: 'chat:read'; threadId: string; readerId: string };

export function useChatWebSocket(
  enabled: boolean,
  onEvent: (event: ChatWsEvent) => void
) {
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return;
    }

    let closedByCleanup = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const connect = async () => {
      if (closedByCleanup) return;
      const user = auth.currentUser;
      if (!user) return;

      try {
        const token = await user.getIdToken();
        if (closedByCleanup) return;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${protocol}//${window.location.host}/ws/chat?token=${encodeURIComponent(token)}`;
        ws = new WebSocket(url);

        ws.onopen = () => {
          attempt = 0;
          setConnected(true);
        };

        ws.onmessage = (evt) => {
          try {
            const parsed = JSON.parse(String(evt.data)) as ChatWsEvent;
            onEventRef.current(parsed);
          } catch {
            // ignore malformed frame
          }
        };

        ws.onclose = () => {
          setConnected(false);
          if (!closedByCleanup) {
            const delay = Math.min(15000, 1000 * Math.pow(2, attempt));
            attempt += 1;
            reconnectTimer = setTimeout(connect, delay);
          }
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch {
        setConnected(false);
      }
    };

    connect();

    return () => {
      closedByCleanup = true;
      setConnected(false);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [enabled]);

  return { connected };
}
