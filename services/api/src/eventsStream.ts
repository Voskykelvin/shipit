import { Request, Response, Router } from 'express';
import { DomainEvent, domainEventEmitter } from './jobs.js';

export const eventsStreamRouter = Router();

/**
 * Server-Sent Events endpoint for real-time Control Tower updates.
 * Streams domain events (NDR cases, route dispatch, pick waves, shifts) to authenticated clients.
 */
eventsStreamRouter.get('/events/stream', (req: Request, res: Response) => {
  // Set headers for standard Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Initial connection acknowledgement
  res.write(
    `data: ${JSON.stringify({
      type: 'system.connected',
      timestamp: new Date().toISOString(),
      userId: req.auth?.userId,
    })}\n\n`,
  );

  const onDomainEvent = (event: DomainEvent) => {
    // If the authenticated user is a merchant user, only send their own events
    if (req.auth?.merchantId && event.merchantId && event.merchantId !== req.auth.merchantId) {
      return;
    }

    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  domainEventEmitter.on('event', onDomainEvent);

  // Keep-alive heartbeat every 20 seconds to prevent proxy timeouts
  const heartbeat = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    domainEventEmitter.off('event', onDomainEvent);
  });
});
