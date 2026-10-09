import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { redisConnection } from './redis.js';

export interface DomainEvent {
  eventId: string;
  type: string;
  occurredAt: string;
  actorUserId?: string;
  merchantId?: string;
  entityId: string;
  payload: Record<string, unknown>;
}

export const domainEventEmitter = new EventEmitter();

export const domainEventsQueue = new Queue<DomainEvent, void, string>('shipit-domain-events', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 8,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { age: 86400, count: 10000 },
    removeOnFail: { age: 604800 },
  },
});

export async function enqueueDomainEvent(event: Omit<DomainEvent, 'eventId' | 'occurredAt'>) {
  const payload: DomainEvent = {
    ...event,
    eventId: randomUUID(),
    occurredAt: new Date().toISOString(),
  };

  // Broadcast to in-process subscribers (SSE stream)
  domainEventEmitter.emit('event', payload);

  try {
    await domainEventsQueue.add(payload.type, payload, { jobId: payload.eventId });
  } catch {
    // If Redis is not connected during development, in-memory event broadcast still succeeds
  }
  return payload.eventId;
}