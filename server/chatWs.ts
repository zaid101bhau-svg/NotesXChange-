import type { Server as HttpServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { adminAuth } from './firebaseAdmin.ts';

const userSockets = new Map<string, Set<WebSocket>>();

export function attachChatWebSocketServer(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: '/ws/chat' });

  wss.on('connection', async (ws, req) => {
    try {
      const url = new URL(req.url || '/ws/chat', 'http://localhost');
      const token = url.searchParams.get('token') || '';
      if (!token) {
        ws.close(4001, 'Authentication token required');
        return;
      }

      const decoded = await adminAuth.verifyIdToken(token);
      const uid = decoded.uid;

      let sockets = userSockets.get(uid);
      if (!sockets) {
        sockets = new Set();
        userSockets.set(uid, sockets);
      }
      sockets.add(ws);

      ws.send(JSON.stringify({ type: 'chat:connected', uid }));

      const heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      }, 25000);

      ws.on('close', () => {
        clearInterval(heartbeat);
        const set = userSockets.get(uid);
        if (set) {
          set.delete(ws);
          if (set.size === 0) userSockets.delete(uid);
        }
      });

      ws.on('error', () => {
        clearInterval(heartbeat);
      });
    } catch {
      ws.close(4001, 'Invalid or expired authentication token');
    }
  });

  return wss;
}

export function broadcastChatEvent(uids: string[], payload: Record<string, unknown>) {
  const serialized = JSON.stringify(payload);
  for (const uid of new Set(uids)) {
    const sockets = userSockets.get(uid);
    if (!sockets) continue;
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(serialized);
      }
    }
  }
}
