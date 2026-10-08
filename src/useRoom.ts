import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_BOARD_THEME,
  type BoardTheme,
  type CommandEnvelope,
  type GameCommand,
  type GameView,
  type Settings,
} from './shared/types';
const BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');
type Session = { code: string; token: string; seatId: string };
const KEY = 'royal-turf-seats-v1';
export async function api(path: string, options: RequestInit = {}) {
  let response: Response;
  try {
    response = await fetch(BASE + '/api' + path, options);
  } catch {
    throw new Error('NETWORK');
  }
  let body: any;
  try {
    body = await response.json();
  } catch {
    throw new Error('NETWORK');
  }
  if (!response.ok) throw new Error(body.error ?? 'NETWORK');
  return body;
}
function stored(): Record<string, Session> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}
function save(session: Session) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...stored(), [session.code]: session }));
  } catch {
    /* The active session still works when browser storage is disabled. */
  }
}
export function useRoom() {
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<GameView | null>(null);
  const [connection, setConnection] = useState<'idle' | 'connecting' | 'live' | 'reconnecting'>(
    'idle',
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const socket = useRef<WebSocket | null>(null),
    latest = useRef<GameView | null>(null);
  const pendingCommand = useRef<CommandEnvelope | null>(null);
  const settle = useRef<((ok: boolean) => void) | null>(null);
  const setSnapshot = useCallback((snapshot: GameView) => {
    if (
      latest.current &&
      snapshot.code === latest.current.code &&
      snapshot.revision < latest.current.revision
    )
      return;
    latest.current = snapshot;
    setView(snapshot);
  }, []);
  const enter = useCallback(
    async (
      code: string | null,
      name: string,
      bots: number,
      settings: Settings,
      boardTheme: BoardTheme = DEFAULT_BOARD_THEME,
    ) => {
      setError(null);
      const prior = code ? stored()[code] : null;
      if (prior) {
        setSession(prior);
        return;
      }
      const data = await api(code ? `/rooms/${code}/join` : '/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(code ? { name } : { name, bots, settings, boardTheme }),
      });
      const session = { code: data.code, seatId: data.seatId, token: data.token };
      save(session);
      setSnapshot(data.view);
      setSession(session);
      const url = new URL(location.href);
      url.searchParams.set('room', session.code);
      history.replaceState(null, '', url);
    },
    [setSnapshot],
  );
  useEffect(() => {
    const code = new URLSearchParams(location.search).get('room');
    if (code && stored()[code]) setSession(stored()[code]);
  }, []);
  useEffect(() => {
    if (!session) return;
    let disposed = false,
      attempt = 0,
      reconnect: ReturnType<typeof setTimeout> | undefined;
    let resend: ReturnType<typeof setInterval> | undefined,
      keepalive: ReturnType<typeof setInterval> | undefined;
    const auth = { Authorization: `Bearer ${session.token}` };
    const connect = async () => {
      if (disposed) return;
      setConnection(attempt ? 'reconnecting' : 'connecting');
      try {
        const { view } = await api(`/rooms/${session.code}/state`, { headers: auth });
        if (disposed) return;
        setSnapshot(view);
        const { ticket } = await api(`/rooms/${session.code}/ticket`, {
          method: 'POST',
          headers: auth,
        });
        if (disposed) return;
        const url = new URL(BASE + `/api/rooms/${session.code}/ws`, location.origin);
        url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        url.searchParams.set('ticket', ticket);
        const ws = new WebSocket(url);
        socket.current = ws;
        ws.onopen = () => {
          if (disposed) {
            ws.close();
            return;
          }
          setConnection('live');
          setError(null);
          attempt = 0;
          if (pendingCommand.current) ws.send(JSON.stringify(pendingCommand.current));
          resend = setInterval(() => {
            if (pendingCommand.current && ws.readyState === WebSocket.OPEN)
              ws.send(JSON.stringify(pendingCommand.current));
          }, 4000);
          keepalive = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.send('ping');
          }, 25000);
        };
        ws.onmessage = (event) => {
          if (disposed || event.data === 'pong') return;
          const message = JSON.parse(event.data);
          if (message.type === 'state') setSnapshot(message.view);
          if (message.type === 'ack' && message.commandId === pendingCommand.current?.commandId) {
            pendingCommand.current = null;
            setPending(false);
            settle.current?.(true);
            settle.current = null;
          }
          if (message.type === 'error') {
            setError(message.error);
            if (!message.commandId || message.commandId === pendingCommand.current?.commandId) {
              pendingCommand.current = null;
              setPending(false);
              settle.current?.(false);
              settle.current = null;
            }
          }
        };
        ws.onclose = () => {
          clearInterval(resend);
          clearInterval(keepalive);
          if (!disposed) {
            setConnection('reconnecting');
            attempt++;
            reconnect = setTimeout(connect, Math.min(15000, 1000 * 2 ** Math.min(attempt, 4)));
          }
        };
        ws.onerror = () => ws.close();
      } catch (error) {
        if (disposed) return;
        const code = error instanceof Error ? error.message : 'NETWORK';
        setError(code);
        if (code === 'UNAUTHORIZED' || code === 'ROOM_NOT_FOUND') {
          const sessions = stored();
          delete sessions[session.code];
          try {
            localStorage.setItem(KEY, JSON.stringify(sessions));
          } catch {
            /* Storage can become unavailable; still release the expired session. */
          }
          // Never carry an unacknowledged action into a different room's socket.
          pendingCommand.current = null;
          setPending(false);
          settle.current?.(false);
          settle.current = null;
          setSession(null);
          setView(null);
          latest.current = null;
          setConnection('idle');
          return;
        }
        attempt++;
        reconnect = setTimeout(connect, Math.min(15000, attempt * 2000));
      }
    };
    connect();
    return () => {
      disposed = true;
      clearTimeout(reconnect);
      clearInterval(resend);
      clearInterval(keepalive);
      socket.current?.close();
      socket.current = null;
    };
  }, [session, setSnapshot]);
  const command = useCallback(
    (action: GameCommand): Promise<boolean> => {
      const ws = socket.current;
      if (
        !latest.current ||
        !session ||
        ws?.readyState !== WebSocket.OPEN ||
        pendingCommand.current
      )
        return Promise.resolve(false);
      const envelope: CommandEnvelope = {
        commandId: crypto.randomUUID(),
        expectedRevision: latest.current.revision,
        command: action,
      };
      setError(null);
      setPending(true);
      pendingCommand.current = envelope;
      return new Promise((resolve) => {
        settle.current = resolve;
        ws.send(JSON.stringify(envelope));
      });
    },
    [session],
  );
  const leave = () => {
    settle.current?.(false);
    settle.current = null;
    pendingCommand.current = null;
    setPending(false);
    setSession(null);
    setView(null);
    latest.current = null;
    setConnection('idle');
    setError(null);
    const url = new URL(location.href);
    url.searchParams.delete('room');
    history.replaceState(null, '', url);
  };
  const getReplay = async () => {
    if (!session) return;
    return api(`/rooms/${session.code}/export`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
  };
  const exportResults = async () => {
    if (!session) return;
    const result = await getReplay();
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `royal-turf-${session.code}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return {
    session,
    view,
    connection,
    error,
    setError,
    pending,
    enter,
    command,
    leave,
    exportResults,
    getReplay,
  };
}
