import { createHash, randomBytes } from 'node:crypto';
import { NextFunction, Request, Response, Router } from 'express';
import { loginSchema } from '@shipit/validation';
import { prisma, verifyPassword } from '@shipit/database';
import { loginRateLimit } from './rateLimit.js';

export interface AuthContext {
  userId: string;
  merchantId: string | null;
  sessionId: string;
  permissions: Set<string>;
  roles: Set<string>;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export const authRouter = Router();

authRouter.post('/login', loginRateLimit, async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      include: {
        merchant: true,
        roleLinks: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      },
    });

    if (
      !user ||
      user.status !== 'ACTIVE' ||
      (user.merchantId && user.merchant?.status !== 'ACTIVE') ||
      !(await verifyPassword(parsed.data.password, user.passwordHash))
    ) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
    const createdAt = new Date();
    const session = await prisma.$transaction(async (transaction) => {
      const createdSession = await transaction.authSession.create({
        data: { userId: user.id, tokenHash: hashToken(token), expiresAt },
      });
      await transaction.user.update({ where: { id: user.id }, data: { lastLoginAt: createdAt } });
      await transaction.auditLog.create({
        data: {
          userId: user.id,
          merchantId: user.merchantId,
          entityType: 'AUTH_SESSION',
          entityId: createdSession.id,
          action: 'LOGIN',
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        },
      });
      return createdSession;
    });

    const permissions = [...new Set(user.roleLinks.flatMap((link) =>
      link.role.permissions.map((rolePermission) => rolePermission.permission.slug)
    ))];
    return res.json({
      token,
      expiresAt: session.expiresAt.toISOString(),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        merchantId: user.merchantId,
        roles: user.roleLinks.map((link) => link.role.name),
        permissions,
      },
    });
  } catch (error) {
    console.error('Authentication service unavailable', error);
    return res.status(503).json({ error: 'Authentication service unavailable' });
  }
});

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const authorization = req.get('authorization');
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return res.status(401).json({ error: 'Bearer token required' });

  try {
    const session = await prisma.authSession.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        user: {
          include: {
            merchant: true,
            roleLinks: {
              include: {
                role: {
                  include: {
                    permissions: { include: { permission: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      return res.status(401).json({ error: 'Session is invalid or expired' });
    }

    const { user } = session;
    if (
      user.status !== 'ACTIVE' ||
      (user.merchantId && user.merchant?.status !== 'ACTIVE')
    ) {
      return res.status(403).json({ error: 'Account is not active' });
    }

    req.auth = {
      userId: user.id,
      merchantId: user.merchantId,
      sessionId: session.id,
      permissions: new Set(user.roleLinks.flatMap((link) =>
        link.role.permissions.map((rolePermission) => rolePermission.permission.slug)
      )),
      roles: new Set(user.roleLinks.map((link) => link.role.name)),
    };
    return next();
  } catch (error) {
    console.error('Authentication service unavailable', error);
    return res.status(503).json({ error: 'Authentication service unavailable' });
  }
}

const permissionRules: Array<{ method: string; path: RegExp; permission: string | string[] }> = [
  { method: 'GET', path: /^\/control-tower\/summary$/, permission: 'control_tower.view' },
  { method: 'GET', path: /^\/exceptions$/, permission: 'audit.view' },
  { method: 'GET', path: /^\/orders(?:\/[^/]+)?$/, permission: 'order.view' },
  { method: 'GET', path: /^\/waybills\/[^/]+\/label\.pdf$/, permission: 'order.view' },
  { method: 'POST', path: /^\/orders$/, permission: 'order.create' },
  { method: 'POST', path: /^\/orders\/import$/, permission: 'order.create' },
  { method: 'POST', path: /^\/orders\/[^/]+\/verify$/, permission: 'order.verify' },
  { method: 'POST', path: /^\/orders\/[^/]+\/cancel$/, permission: 'order.cancel' },
  { method: 'POST', path: /^\/fulfillment\/pick$/, permission: 'inventory.pick' },
  { method: 'POST', path: /^\/fulfillment\/pack$/, permission: 'inventory.pack' },
  { method: 'GET', path: /^\/fulfillment\/waves(?:\/[^/]+)?$/, permission: 'inventory.pick' },
  { method: 'POST', path: /^\/fulfillment\/waves$/, permission: 'inventory.pick' },
  { method: 'POST', path: /^\/fulfillment\/waves\/[^/]+\/(?:start|complete)$/, permission: 'inventory.pick' },
  { method: 'GET', path: /^\/inventory\/(?:stock|transactions)$/, permission: 'inventory.view' },
  { method: 'GET', path: /^\/inventory\/locations$/, permission: 'inventory.locations.view' },
  { method: 'POST', path: /^\/inventory\/adjust$/, permission: 'inventory.adjust' },
  { method: 'GET', path: /^\/inbound$/, permission: 'inventory.view' },
  { method: 'GET', path: /^\/inbound\/warehouses$/, permission: 'inbound.create' },
  { method: 'POST', path: /^\/inbound$/, permission: 'inbound.create' },
  { method: 'POST', path: /^\/inbound\/[^/]+\/receive$/, permission: 'inventory.receive' },
  { method: 'GET', path: /^\/products$/, permission: 'inventory.view' },
  { method: 'POST', path: /^\/products$/, permission: 'product.manage' },
  { method: 'GET', path: /^\/dispatch\/(?:routes|manifests)$/, permission: 'dispatch.view' },
  { method: 'POST', path: /^\/dispatch\/scan-waybill$/, permission: 'dispatch.scan' },
  { method: 'POST', path: /^\/dispatch\/manifests$/, permission: 'dispatch.manifest' },
  { method: 'POST', path: /^\/dispatch\/manifests\/[^/]+\/handover$/, permission: 'dispatch.handover' },
  { method: 'GET', path: /^\/riders$/, permission: 'rider.view' },
  { method: 'GET', path: /^\/riders\/[^/]+\/tasks$/, permission: 'delivery.tasks' },
  { method: 'POST', path: /^\/delivery\/(?:complete|fail)$/, permission: 'delivery.execute' },
  { method: 'POST', path: /^\/delivery\/mpesa\/stk-push$/, permission: 'delivery.execute' },
  { method: 'GET', path: /^\/delivery\/mpesa\/stk-push\/[^/]+$/, permission: 'delivery.execute' },
  { method: 'GET', path: /^\/ndr$/, permission: 'ndr.view' },
  { method: 'POST', path: /^\/ndr\/[^/]+\/resolve$/, permission: 'ndr.resolve' },
  { method: 'GET', path: /^\/returns(?:\/[^/]+)?$/, permission: 'return.view' },
  { method: 'POST', path: /^\/returns$/, permission: 'return.manage' },
  { method: 'POST', path: /^\/returns\/[^/]+\/(?:receive|inspect)$/, permission: 'return.inspect' },
  { method: 'GET', path: /^\/finance\/rider-shifts$/, permission: ['finance.reconcile', 'finance.variance.approve'] },
  { method: 'POST', path: /^\/finance\/rider-shifts\/closeout$/, permission: 'finance.reconcile' },
  { method: 'POST', path: /^\/finance\/rider-shifts\/[^/]+\/approve-variance$/, permission: 'finance.variance.approve' },
  { method: 'GET', path: /^\/finance\/(?:ledgers|settlements)$/, permission: 'finance.view' },
  { method: 'POST', path: /^\/finance\/settlements$/, permission: 'settlement.create' },
  { method: 'POST', path: /^\/finance\/settlements\/approve$/, permission: 'settlement.approve' },
  { method: 'POST', path: /^\/finance\/settlements\/[^/]+\/paid$/, permission: 'settlement.disburse' },
  { method: 'POST', path: /^\/finance\/settlements\/[^/]+\/disburse$/, permission: 'settlement.disburse' },
  { method: 'GET', path: /^\/merchants$/, permission: 'merchant.manage' },
  { method: 'POST', path: /^\/merchants$/, permission: 'merchant.manage' },
  { method: 'POST', path: /^\/merchants\/[^/]+\/(?:users|activate)$/, permission: 'merchant.manage' },
  { method: 'POST', path: /^\/riders$/, permission: 'rider.manage' },
];

export function authorizeApiRequest(req: Request, res: Response, next: NextFunction) {
  const rule = permissionRules.find((candidate) => candidate.method === req.method && candidate.path.test(req.path));
  if (!rule) return res.status(403).json({ error: 'No permission policy is defined for this endpoint' });
  const requiredPermissions = Array.isArray(rule.permission) ? rule.permission : [rule.permission];
  if (!requiredPermissions.some((permission) => req.auth?.permissions.has(permission))) {
    return res.status(403).json({
      error: 'Insufficient permission',
      requiredPermission: Array.isArray(rule.permission) ? requiredPermissions : rule.permission,
    });
  }
  return next();
}

export function canAccessMerchant(req: Request, merchantId: string) {
  return !!req.auth && (req.auth.merchantId === null || req.auth.merchantId === merchantId);
}

export function revokeSession(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) return res.status(401).json({ error: 'Authentication required' });
  prisma.$transaction([
    prisma.authSession.update({ where: { id: req.auth.sessionId }, data: { revokedAt: new Date() } }),
    prisma.auditLog.create({
      data: {
        userId: req.auth.userId,
        merchantId: req.auth.merchantId,
        entityType: 'AUTH_SESSION',
        entityId: req.auth.sessionId,
        action: 'LOGOUT',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
    }),
  ]).then(() => res.json({ success: true })).catch(next);
}

authRouter.post('/logout', authenticate, revokeSession);

export function auditSuccessfulMutation(req: Request, res: Response, next: NextFunction) {
  res.once('finish', () => {
    if (res.statusCode >= 400 || !req.auth || ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;

    const segments = req.path.split('/').filter(Boolean);
    const entityId = req.params.id || req.body?.orderId || req.body?.productId || 'collection';
    void prisma.auditLog.create({
      data: {
        userId: req.auth.userId,
        merchantId: req.auth.merchantId,
        entityType: (segments[0] ?? 'API').toUpperCase(),
        entityId,
        action: req.method === 'POST' ? 'CREATE' : 'UPDATE',
        afterPayload: { changedFields: Object.keys(req.body ?? {}) },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
    }).catch((error: unknown) => console.error('Failed to persist audit event', error));
  });
  next();
}
