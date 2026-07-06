import { useEffect, useRef } from 'react';
import PartySocket from 'partysocket';
import type { Command } from '@shared/protocol/commands';
import type { ServerMessage } from '@shared/protocol/messages';
import { useGameStore } from './gameStore';
import { getClientId } from './identity';

const HOST = import.meta.env.VITE_PARTYKIT_HOST || '127.0.0.1:1999';

/**
 * Opens (and cleans up) the WebSocket to this game's room, wires incoming
 * server messages into the store, and returns a typed `send` for dispatching
 * commands. Actions are pulled via `getState()` so this hook doesn't re-render
 * on every state change.
 */
export function useGameSocket(code: string, name: string) {
  const socketRef = useRef<PartySocket | null>(null);

  useEffect(() => {
    // Stable id => the server sees the same connection id across reconnects.
    const socket = new PartySocket({ host: HOST, room: code, id: getClientId() });
    socketRef.current = socket;

    const store = useGameStore.getState;

    const onOpen = () => {
      store().setConnected(true);
      socket.send(JSON.stringify({ t: 'join', name } satisfies Command));
    };
    const onClose = () => store().setConnected(false);
    const onMessage = (event: MessageEvent) => {
      const message = JSON.parse(event.data as string) as ServerMessage;
      switch (message.t) {
        case 'snapshot':
          store().applySnapshot(message.state, message.you);
          break;
        case 'event':
          store().pushEvent(message.event);
          break;
        case 'error':
          console.warn('[server]', message.message);
          break;
      }
    };

    socket.addEventListener('open', onOpen);
    socket.addEventListener('close', onClose);
    socket.addEventListener('message', onMessage);

    return () => {
      socket.removeEventListener('open', onOpen);
      socket.removeEventListener('close', onClose);
      socket.removeEventListener('message', onMessage);
      socket.close();
      socketRef.current = null;
      useGameStore.getState().reset();
    };
  }, [code, name]);

  const send = (command: Command) => {
    socketRef.current?.send(JSON.stringify(command));
  };

  return { send };
}
