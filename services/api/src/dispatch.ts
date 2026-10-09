import { randomBytes } from 'node:crypto';
import { Request, Response, Router } from 'express';
import { createManifestSchema, handoverManifestSchema, scanWaybillSchema } from '@shipit/validation';
import { prisma } from '@shipit/database';

const dispatchRouter = Router();

class DispatchRequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function sendDispatchError(error: unknown, res: Response) {
  if (error instanceof DispatchRequestError) return res.status(error.status).json({ error: error.message });
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034') {
    return res.status(409).json({ error: 'Dispatch records changed concurrently; retry the operation' });
  }
  console.error('Dispatch database operation failed', error);
  return res.status(503).json({ error: 'Dispatch service unavailable' });
}

function mapManifest(manifest: any) {
  return {
    id: manifest.id,
    manifestNumber: manifest.manifestNumber,
    routeId: manifest.routeId,
    routeCode: manifest.route.routeCode,
    riderId: manifest.riderId,
    riderName: `${manifest.rider.user.firstName} ${manifest.rider.user.lastName}`,
    status: manifest.status,
    parcels: manifest.orders.map((order: any) => order.waybillNumber ?? order.orderNumber),
    totalParcels: manifest.totalParcels,
    expectedCodTotalKes: manifest.expectedCodTotalKes,
    dispatchedAt: manifest.dispatchedAt?.toISOString(),
    closedAt: manifest.closedAt?.toISOString(),
    createdAt: manifest.createdAt.toISOString(),
  };
}

const manifestInclude = {
  route: true,
  rider: { include: { user: true } },
  orders: { select: { orderNumber: true, waybillNumber: true } },
};

function findRouteForTown(routes: Array<{ id: string; routeCode: string; subCountiesServed: string[] }>, town: string) {
  const normalizedTown = town.trim().toLocaleLowerCase();
  return routes.find((route) => route.subCountiesServed.some((area) => area.toLocaleLowerCase() === normalizedTown));
}

dispatchRouter.get('/dispatch/routes', async (_req: Request, res: Response) => {
  try {
    const routes = await prisma.deliveryRoute.findMany({ orderBy: { routeCode: 'asc' } });
    return res.json(routes.map((route) => ({
      id: route.id,
      routeCode: route.routeCode,
      name: route.name,
      areasCovered: route.subCountiesServed,
      isActive: true,
    })));
  } catch (error) {
    return sendDispatchError(error, res);
  }
});

dispatchRouter.get('/dispatch/manifests', async (_req: Request, res: Response) => {
  try {
    const manifests = await prisma.dispatchManifest.findMany({
      include: manifestInclude,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return res.json(manifests.map(mapManifest));
  } catch (error) {
    return sendDispatchError(error, res);
  }
});

dispatchRouter.post('/dispatch/manifests', async (req: Request, res: Response) => {
  const parsed = createManifestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });

  try {
    const route = await prisma.deliveryRoute.findUnique({ where: { id: parsed.data.routeId } });
    if (!route) return res.status(404).json({ error: 'Route not found' });

    const manifest = await prisma.$transaction(async (transaction) => {
      const rider = await transaction.rider.findUnique({ where: { id: parsed.data.riderId } });
      if (!rider) throw new DispatchRequestError(404, 'Rider not found');
      if (rider.activeStatus === 'IN_TRANSIT') throw new DispatchRequestError(409, 'Rider is already in transit');
      const existingManifest = await transaction.dispatchManifest.findFirst({
        where: { riderId: rider.id, status: { in: ['STAGED', 'ACCEPTED_BY_RIDER', 'IN_TRANSIT'] } },
      });
      if (existingManifest) throw new DispatchRequestError(409, 'Rider already has an active manifest');

      await transaction.rider.update({ where: { id: rider.id }, data: { activeStatus: 'ON_DUTY' } });
      return transaction.dispatchManifest.create({
        data: {
          manifestNumber: `MNF-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`,
          routeId: route.id,
          riderId: rider.id,
        },
        include: manifestInclude,
      });
    }, { isolationLevel: 'Serializable' });
    return res.status(201).json(mapManifest(manifest));
  } catch (error) {
    return sendDispatchError(error, res);
  }
});

dispatchRouter.post('/dispatch/scan-waybill', async (req: Request, res: Response) => {
  const parsed = scanWaybillSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });
  const barcode = parsed.data.barcode.trim();

  try {
    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { waybillNumber: { equals: barcode, mode: 'insensitive' } },
          { orderNumber: { equals: barcode, mode: 'insensitive' } },
        ],
      },
      include: { merchant: true, items: { include: { product: true } }, waybill: true },
    });
    if (!order) {
      return res.status(404).json({ valid: false, errorType: 'PARCEL_NOT_FOUND', message: `No parcel found matching barcode: ${barcode}` });
    }

    const routes = await prisma.deliveryRoute.findMany();
    const correctRoute = findRouteForTown(routes, order.townOrSubCounty);
    if (!correctRoute) {
      return res.status(409).json({ valid: false, errorType: 'ROUTE_UNMAPPED', message: 'No delivery route covers this destination' });
    }
    if (parsed.data.targetRouteCode && parsed.data.targetRouteCode !== correctRoute.routeCode) {
      return res.status(409).json({
        valid: false,
        errorType: 'ROUTE_MISMATCH',
        message: `Parcel belongs to [${correctRoute.routeCode}], not [${parsed.data.targetRouteCode}].`,
        correctRouteCode: correctRoute.routeCode,
        targetRouteCode: parsed.data.targetRouteCode,
      });
    }

    if (!parsed.data.manifestId) {
      return res.json({ valid: true, addedToManifest: false, message: 'Route verified; select a staged manifest to assign this parcel.', correctRouteCode: correctRoute.routeCode });
    }

    const manifest = await prisma.$transaction(async (transaction) => {
      const current = await transaction.dispatchManifest.findUnique({ where: { id: parsed.data.manifestId } });
      if (!current || current.status !== 'STAGED') throw new DispatchRequestError(409, 'Manifest is not available for parcel scans');
      if (current.routeId !== correctRoute.id) throw new DispatchRequestError(409, `Manifest route must be ${correctRoute.routeCode}`);
      if (order.status !== 'PACKED' || !order.waybillNumber) throw new DispatchRequestError(409, 'Only packed parcels with a waybill can be manifested');
      if (order.manifestId) throw new DispatchRequestError(409, 'Parcel already belongs to a manifest');

      const updatedManifest = await transaction.dispatchManifest.update({
        where: { id: current.id },
        data: {
          totalParcels: { increment: 1 },
          expectedCodTotalKes: { increment: order.codAmountExpectedKes },
        },
      });
      await transaction.order.update({
        where: { id: order.id },
        data: { status: 'MANIFESTED', manifestId: current.id },
      });
      return updatedManifest;
    }, { isolationLevel: 'Serializable' });

    return res.json({
      valid: true,
      addedToManifest: true,
      message: `Valid parcel added to manifest ${manifest.manifestNumber}`,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        waybillNumber: order.waybillNumber,
        customerName: order.customerName,
        merchantId: order.merchantId,
        codAmountExpectedKes: order.codAmountExpectedKes,
      },
      correctRouteCode: correctRoute.routeCode,
    });
  } catch (error) {
    return sendDispatchError(error, res);
  }
});

dispatchRouter.post('/dispatch/manifests/:id/handover', async (req: Request, res: Response) => {
  const parsed = handoverManifestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const manifest = await transaction.dispatchManifest.findUnique({
        where: { id: req.params.id },
        include: { orders: true },
      });
      if (!manifest) throw new DispatchRequestError(404, 'Manifest not found');
      if (manifest.status !== 'STAGED' || manifest.orders.length === 0) throw new DispatchRequestError(409, 'Only non-empty staged manifests can be handed over');

      const actualCodTotal = manifest.orders.reduce((total, order) => total + order.codAmountExpectedKes, 0);
      if (parsed.data.acceptedParcelCount !== manifest.orders.length || parsed.data.acceptedCodTotalKes !== actualCodTotal) {
        throw new DispatchRequestError(409, 'Rider-accepted parcel count and COD total must match the manifest');
      }

      const updated = await transaction.dispatchManifest.update({
        where: { id: manifest.id },
        data: { status: 'IN_TRANSIT', dispatchedAt: new Date() },
        include: manifestInclude,
      });
      await transaction.order.updateMany({
        where: { manifestId: manifest.id, status: 'MANIFESTED' },
        data: { status: 'OUT_FOR_DELIVERY' },
      });
      await transaction.rider.update({ where: { id: manifest.riderId }, data: { activeStatus: 'IN_TRANSIT' } });
      return updated;
    }, { isolationLevel: 'Serializable' });
    return res.json({ success: true, manifest: mapManifest(result) });
  } catch (error) {
    return sendDispatchError(error, res);
  }
});

export { dispatchRouter };
