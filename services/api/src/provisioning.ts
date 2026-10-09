import { Request, Response, Router } from 'express';
import { createMerchantSchema, createMerchantUserSchema, createProductSchema, createRiderSchema } from '@shipit/validation';
import { hashPassword, prisma } from '@shipit/database';
import { canAccessMerchant } from './auth.js';

const provisioningRouter = Router();

function sendProvisioningError(error: unknown, res: Response) {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'A record with that email, code, SKU, barcode, or ID already exists' });
    if (error.code === 'P2025') return res.status(404).json({ error: 'Related record not found' });
  }
  console.error('Provisioning operation failed', error);
  return res.status(503).json({ error: 'Provisioning service unavailable' });
}

provisioningRouter.get('/merchants', async (_req: Request, res: Response) => {
  try {
    const merchants = await prisma.merchant.findMany({ orderBy: { name: 'asc' } });
    return res.json(merchants);
  } catch (error) {
    return sendProvisioningError(error, res);
  }
});

provisioningRouter.post('/merchants', async (req: Request, res: Response) => {
  const parsed = createMerchantSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });

  try {
    const rateCard = parsed.data.rateCardId
      ? await prisma.rateCard.findUnique({ where: { id: parsed.data.rateCardId } })
      : await prisma.rateCard.findUnique({ where: { name: 'Standard Kenya' } });
    if (!rateCard) return res.status(409).json({ error: 'Configure a rate card before creating a merchant' });

    const merchant = await prisma.merchant.create({
      data: {
        code: parsed.data.code,
        name: parsed.data.name,
        contactEmail: parsed.data.contactEmail,
        contactPhone: parsed.data.contactPhone,
        rateCardId: rateCard.id,
        status: 'ONBOARDING',
      },
    });
    return res.status(201).json(merchant);
  } catch (error) {
    return sendProvisioningError(error, res);
  }
});

provisioningRouter.post('/merchants/:id/users', async (req: Request, res: Response) => {
  const parsed = createMerchantUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });

  try {
    const merchant = await prisma.merchant.findUnique({ where: { id: req.params.id } });
    if (!merchant || !canAccessMerchant(req, merchant.id)) return res.status(404).json({ error: 'Merchant not found' });
    const role = await prisma.role.findUnique({ where: { name: parsed.data.role } });
    if (!role) return res.status(503).json({ error: 'Role catalog is not seeded' });

    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        passwordHash: await hashPassword(parsed.data.password),
        phoneNumber: parsed.data.phoneNumber,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        status: merchant.status === 'ACTIVE' ? 'ACTIVE' : 'ONBOARDING',
        merchant: { connect: { id: merchant.id } },
        roleLinks: { create: { role: { connect: { id: role.id } } } },
      },
      select: { id: true, email: true, phoneNumber: true, firstName: true, lastName: true, status: true, merchantId: true },
    });
    return res.status(201).json(user);
  } catch (error) {
    return sendProvisioningError(error, res);
  }
});

provisioningRouter.post('/merchants/:id/activate', async (req: Request, res: Response) => {
  try {
    const merchant = await prisma.merchant.update({
      where: { id: req.params.id },
      data: { status: 'ACTIVE' },
    });
    await prisma.user.updateMany({ where: { merchantId: merchant.id, status: 'ONBOARDING' }, data: { status: 'ACTIVE' } });
    return res.json({ success: true, merchant });
  } catch (error) {
    return sendProvisioningError(error, res);
  }
});

provisioningRouter.get('/products', async (req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      where: req.auth?.merchantId ? { merchantId: req.auth.merchantId } : undefined,
      orderBy: [{ merchantId: 'asc' }, { sku: 'asc' }],
      take: 1000,
    });
    return res.json(products);
  } catch (error) {
    return sendProvisioningError(error, res);
  }
});

provisioningRouter.post('/products', async (req: Request, res: Response) => {
  const parsed = createProductSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });
  const merchantId = req.auth?.merchantId ?? parsed.data.merchantId;
  if (!canAccessMerchant(req, merchantId)) return res.status(403).json({ error: 'Cannot create a product for another merchant' });

  try {
    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant || merchant.status !== 'ACTIVE') return res.status(404).json({ error: 'Active merchant not found' });
    const product = await prisma.product.create({
      data: {
        merchantId,
        sku: parsed.data.sku,
        barcode: parsed.data.barcode,
        name: parsed.data.name,
        description: parsed.data.description,
        declaredValueKes: parsed.data.declaredValueKes,
        weightKg: parsed.data.weightKg,
        reorderThreshold: parsed.data.reorderThreshold,
        isFragile: parsed.data.isFragile,
        requiresColdStorage: parsed.data.requiresColdStorage,
      },
    });
    return res.status(201).json(product);
  } catch (error) {
    return sendProvisioningError(error, res);
  }
});

provisioningRouter.post('/riders', async (req: Request, res: Response) => {
  const parsed = createRiderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });

  try {
    const role = await prisma.role.findUnique({ where: { name: 'RIDER' } });
    if (!role) return res.status(503).json({ error: 'Role catalog is not seeded' });
    const rider = await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {
          email: parsed.data.email,
          passwordHash: await hashPassword(parsed.data.password),
          phoneNumber: parsed.data.phoneNumber,
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          status: 'ACTIVE',
          roleLinks: { create: { role: { connect: { id: role.id } } } },
        },
      });
      return transaction.rider.create({
        data: {
          userId: user.id,
          phoneNumber: parsed.data.phoneNumber,
          nationalIdNumber: parsed.data.nationalIdNumber,
          vehicleRegPlate: parsed.data.vehicleRegPlate,
        },
        include: { user: true },
      });
    }, { isolationLevel: 'Serializable' });
    return res.status(201).json({
      id: rider.id,
      userId: rider.userId,
      name: `${rider.user.firstName} ${rider.user.lastName}`,
      phoneNumber: rider.phoneNumber,
      vehiclePlate: rider.vehicleRegPlate,
      isOnDuty: false,
    });
  } catch (error) {
    return sendProvisioningError(error, res);
  }
});

export { provisioningRouter };
