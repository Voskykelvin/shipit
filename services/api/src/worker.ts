import { Worker } from 'bullmq';
import { prisma } from '@shipit/database';
import { DomainEvent } from './jobs.js';
import { connectRedis, disconnectRedis, redisConnection } from './redis.js';

const queueName = 'shipit-domain-events';

async function forwardEvent(event: DomainEvent) {
  const endpoint = process.env.SHIPIT_EVENTS_WEBHOOK_URL;
  if (!endpoint) {
    console.info('Domain event processed', {
      eventId: event.eventId,
      type: event.type,
      entityId: event.entityId,
    });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.SHIPIT_EVENTS_WEBHOOK_TOKEN
          ? { Authorization: `Bearer ${process.env.SHIPIT_EVENTS_WEBHOOK_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(event),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Event webhook returned HTTP ${response.status}`);
  } finally {
    clearTimeout(timeout);
  }
}

async function startWorker() {
  await connectRedis();
  await prisma.$connect();

  const worker = new Worker<DomainEvent>(queueName, (job) => forwardEvent(job.data), {
    connection: redisConnection,
    concurrency: 10,
  });
  worker.on('failed', (job, error) => {
    console.error('Domain event processing failed', { jobId: job?.id, error: error.message });
  });
  worker.on('error', (error) => console.error('Domain event worker error', error));
  console.info('Ship It domain event worker started');

  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    await worker.close();
    await prisma.$disconnect();
    await disconnectRedis();
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

void startWorker().catch((error: unknown) => {
  console.error('Could not start Ship It domain event worker', error);
  process.exitCode = 1;
});