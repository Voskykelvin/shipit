import { useEffect, useRef, useState } from 'react';

export interface LiveDomainEvent {
  eventId: string;
  type: string;
  occurredAt: string;
  actorUserId?: string;
  merchantId?: string;
  entityId: string;
  payload: Record<string, unknown>;
}

export function useLiveEvents(
  token: string | null | undefined,
  onEvent: (event: LiveDomainEvent) => void,
) {
  const [status, setStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!token) {
      setStatus('disconnected');
      return;
    }

    let controller: AbortController | null = new AbortController();
    let timeoutId: number | undefined;

    async function connect() {
      if (!token || !controller) return;
      setStatus('connecting');

      try {
        const response = await fetch('/api/events/stream', {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'text/event-stream',
          },
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`HTTP ${response.status}`);
        }

        setStatus('connected');

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() ?? '';

          for (const block of lines) {
            const dataLines = block
              .split('\n')
              .filter((line) => line.startsWith('data: '))
              .map((line) => line.slice(6).trim());

            for (const dataStr of dataLines) {
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed && typeof parsed === 'object' && 'type' in parsed) {
                  onEventRef.current(parsed as LiveDomainEvent);
                }
              } catch {
                // Ignore parse errors on ping/malformed frames
              }
            }
          }
        }
      } catch (err: unknown) {
        if (controller?.signal.aborted) return;
        setStatus('disconnected');
        // Auto-reconnect after 4 seconds
        timeoutId = window.setTimeout(() => {
          void connect();
        }, 4000);
      }
    }

    void connect();

    return () => {
      controller?.abort();
      controller = null;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      setStatus('disconnected');
    };
  }, [token]);

  return { status };
}
