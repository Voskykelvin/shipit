import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/password.js';

const prisma = new PrismaClient();

const rolePermissions: Record<string, string[]> = {
  SUPER_ADMIN: [
    'control_tower.view', 'exception.manage', 'order.view', 'order.create', 'order.verify', 'order.cancel',
    'order.manage', 'inventory.view', 'inventory.locations.view', 'inventory.receive', 'inventory.pick', 'inventory.pack', 'inventory.adjust', 'product.manage',
    'dispatch.view', 'dispatch.manifest', 'dispatch.scan', 'dispatch.handover', 'rider.view', 'rider.manage', 'delivery.execute',
    'ndr.view', 'ndr.resolve', 'return.view', 'return.manage', 'return.inspect', 'finance.view', 'finance.reconcile', 'finance.variance.approve', 'settlement.create', 'settlement.approve', 'settlement.disburse', 'merchant.manage', 'audit.view',
  ],
  OPERATIONS_MANAGER: [
    'control_tower.view', 'exception.manage', 'order.view', 'order.manage', 'inventory.view', 'inventory.receive',
    'inventory.adjust', 'inventory.locations.view', 'inbound.create', 'dispatch.view', 'dispatch.manifest', 'dispatch.scan', 'dispatch.handover', 'rider.view', 'rider.manage',
    'delivery.execute', 'ndr.view', 'ndr.resolve', 'return.view', 'return.manage', 'return.inspect', 'finance.view', 'finance.variance.approve', 'audit.view',
  ],
  WAREHOUSE_SUPERVISOR: ['order.view', 'inventory.view', 'inventory.locations.view', 'inventory.receive', 'inventory.pick', 'inventory.pack', 'inventory.adjust', 'product.manage', 'dispatch.view', 'dispatch.scan', 'return.view', 'return.inspect', 'audit.view'],
  WAREHOUSE_PICKER: ['order.view', 'inventory.view', 'inventory.locations.view', 'inventory.pick', 'inventory.pack'],
  CUSTOMER_CARE_AGENT: ['order.view', 'order.verify', 'order.cancel', 'ndr.view', 'ndr.resolve', 'return.view', 'return.manage'],
  DISPATCHER: ['order.view', 'dispatch.view', 'dispatch.manifest', 'dispatch.scan', 'dispatch.handover', 'rider.view'],
  RIDER: ['delivery.tasks', 'delivery.execute'],
  FINANCE_OFFICER: ['control_tower.view', 'finance.view', 'finance.reconcile', 'settlement.approve', 'settlement.disburse', 'rider.view', 'audit.view'],
  MERCHANT_ADMIN: ['order.view', 'order.create', 'inventory.view', 'inbound.create', 'product.manage', 'finance.view', 'settlement.create', 'return.view', 'return.manage'],
  MERCHANT_STAFF: ['order.view', 'order.create', 'inventory.view', 'inbound.create', 'finance.view', 'settlement.create', 'return.view', 'return.manage'],
};

async function main() {
  const email = process.env.SHIPIT_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SHIPIT_ADMIN_PASSWORD;
  if (!email || !password || password.length < 16) {
    throw new Error('Set SHIPIT_ADMIN_EMAIL and a SHIPIT_ADMIN_PASSWORD of at least 16 characters before seeding.');
  }

  const slugs = [...new Set(Object.values(rolePermissions).flat())];
  const permissionIds = new Map<string, string>();
  for (const slug of slugs) {
    const permission = await prisma.permission.upsert({
      where: { slug },
      create: { slug },
      update: {},
    });
    permissionIds.set(slug, permission.id);
  }

  const roleIds = new Map<string, string>();
  for (const [name, permissions] of Object.entries(rolePermissions)) {
    const role = await prisma.role.upsert({
      where: { name },
      create: { name },
      update: {},
    });
    roleIds.set(name, role.id);
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permissions.map((slug) => ({ roleId: role.id, permissionId: permissionIds.get(slug)! })),
    });
  }

  const warehouse = await prisma.warehouse.upsert({
    where: { code: 'NBO-01' },
    create: {
      code: 'NBO-01',
      name: 'Nairobi Industrial Area',
      address: { county: 'Nairobi', area: 'Industrial Area' },
    },
    update: { isActive: true },
  });
  const warehouseBins = [
    ['FAST_PICK', 'A01', 'R01', 'S1', 'B01'],
    ['FAST_PICK', 'A01', 'R01', 'S1', 'B02'],
    ['BULK', 'B02', 'R04', 'S2', 'B01'],
    ['QUARANTINE', 'Q01', 'R01', 'S1', 'B01'],
  ];
  for (const [zone, aisle, rack, shelf, bin] of warehouseBins) {
    const barcode = `W1-${aisle}-${rack}-${shelf}-${bin}`;
    await prisma.warehouseLocation.upsert({
      where: { barcode },
      create: { warehouseId: warehouse.id, zone, aisle, rack, shelf, bin, barcode },
      update: { warehouseId: warehouse.id, zone },
    });
  }

  const routeDefinitions = [
    { routeCode: 'WESTLANDS-01', name: 'Westlands & Parklands Corridor', areas: ['Westlands', 'Rhapta Road', 'Parklands', 'Spring Valley'] },
    { routeCode: 'KILIMANI-02', name: 'Kilimani, Kileleshwa & Lavington', areas: ['Kilimani', 'Kileleshwa', 'Lavington', 'Hurlingham'] },
    { routeCode: 'THIKA-RD-01', name: 'Thika Road & Roysambu Hub', areas: ['Roysambu', 'Kasarani', 'Kahawa West', 'Ruiru', 'Thika'] },
    { routeCode: 'MOMBASA-RD-01', name: 'Mombasa Road & South B/C', areas: ['South B', 'South C', 'Imara Daima', 'Syokimau', 'Mombasa Road'] },
  ];
  for (const route of routeDefinitions) {
    await prisma.deliveryRoute.upsert({
      where: { routeCode: route.routeCode },
      create: { routeCode: route.routeCode, name: route.name, subCountiesServed: route.areas },
      update: { name: route.name, subCountiesServed: route.areas },
    });
  }

  await prisma.rateCard.upsert({
    where: { name: 'Standard Kenya' },
    create: {
      name: 'Standard Kenya',
      storagePerBinDayKes: 15,
      pickPackBaseFeeKes: 120,
      deliveryIntraNairobiKes: 250,
      deliveryUpcountryKes: 450,
      codCommissionBasisPoints: 150,
      codCommissionMinKes: 30,
      rtoReturnFeeKes: 100,
    },
    update: {},
  });

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash: await hashPassword(password),
      phoneNumber: process.env.SHIPIT_ADMIN_PHONE ?? '+254700000000',
      firstName: process.env.SHIPIT_ADMIN_FIRST_NAME ?? 'Ship It',
      lastName: process.env.SHIPIT_ADMIN_LAST_NAME ?? 'Administrator',
      status: 'ACTIVE',
    },
    update: {
      passwordHash: await hashPassword(password),
      status: 'ACTIVE',
    },
  });

  await prisma.userRole.deleteMany({ where: { userId: user.id } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: roleIds.get('SUPER_ADMIN')! } });
  console.log(`Seeded roles and administrator ${email}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
