import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { prisma } from '@shipit/database';
import { auditSuccessfulMutation, authRouter, authenticate, authorizeApiRequest } from './auth.js';
import { controlTowerRouter } from './controlTower.js';
import { deliveryRouter } from './delivery.js';
import { dispatchRouter } from './dispatch.js';
import { financeRouter } from './finance.js';
import { mpesaPaymentRouter, mpesaWebhookRouter } from './mpesa.js';
import { errorHandler, notFoundMiddleware, requestIdMiddleware } from './middleware.js';
import { ordersRouter } from './orders.js';
import { pickingRouter } from './picking.js';
import { provisioningRouter } from './provisioning.js';
import { apiRateLimit } from './rateLimit.js';
import { returnsRouter } from './returns.js';
import { connectRedis, disconnectRedis } from './redis.js';
import { warehouseRouter } from './warehouse.js';
import { trackingRouter } from './tracking.js';
import { eventsStreamRouter } from './eventsStream.js';
import { notificationsRouter } from './notifications.js';
import { domainEventsQueue, enqueueDomainEvent } from './jobs.js';
import { publicInquirySchema } from '@shipit/validation';

const app = express();
const port = Number(process.env.PORT ?? 4000);
const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003')
    .split(',').map((origin) => origin.trim()).filter(Boolean),
);

app.use(requestIdMiddleware);
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
  credentials: true,
}));
app.use(express.text({ type: ['text/csv', 'application/csv'], limit: '10mb' }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'shipit-api', timestamp: new Date().toISOString() });
});

app.get('/api/health/ready', async (req, res) => {
  try {
    await Promise.all([prisma.$queryRaw`SELECT 1`, prisma.$connect(), connectRedis()]);
    return res.json({ status: 'ready', service: 'shipit-api', requestId: req.requestId });
  } catch {
    return res.status(503).json({ status: 'not_ready', service: 'shipit-api', requestId: req.requestId });
  }
});

app.use('/api', apiRateLimit);
app.use('/api/auth', authRouter);
app.use('/api', mpesaWebhookRouter);
app.use('/api', trackingRouter);
app.post('/api/inquiries', async (req, res) => {
  const parsed = publicInquirySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Please provide valid business, contact, phone, and email details.' });
  }
  const inquiry = parsed.data;
  try {
    await enqueueDomainEvent({
      type: 'merchant.inquiry_received',
      entityId: `INQ-${Date.now()}`,
      payload: inquiry,
    });
  } catch {
    // BullMQ may be offline in test/dev
  }
  return res.status(201).json({
    success: true,
    message: 'Thank you for your inquiry. A fulfillment onboarding specialist will contact you.',
  });
});
app.use('/api', authenticate);
app.use('/api', authorizeApiRequest);
app.use('/api', auditSuccessfulMutation);
app.use('/api', eventsStreamRouter);
app.use('/api', controlTowerRouter);
app.use('/api', warehouseRouter);
app.use('/api', ordersRouter);
app.use('/api', pickingRouter);
app.use('/api', dispatchRouter);
app.use('/api', deliveryRouter);
app.use('/api', mpesaPaymentRouter);
app.use('/api', financeRouter);
app.use('/api', provisioningRouter);
app.use('/api', returnsRouter);
app.use('/api', notificationsRouter);

app.use(notFoundMiddleware);
app.use(errorHandler);

export { app };

async function startServer() {
  await connectRedis();
  await prisma.$connect();
  const server = app.listen(port, () => {
    console.info(`Ship It API listening on port ${port}`);
  });

  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    await Promise.all([
      domainEventsQueue.close(),
      prisma.$disconnect(),
      disconnectRedis(),
    ]);
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

if (process.env.NODE_ENV !== 'test') {
  void startServer().catch((error: unknown) => {
    console.error('Could not start Ship It API', error);
    process.exitCode = 1;
  });
}
