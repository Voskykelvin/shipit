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
  const adminEmail = (process.env.SHIPIT_ADMIN_EMAIL ?? 'admin@shipit.co.ke').trim().toLowerCase();
  const demoPassword = process.env.SHIPIT_ADMIN_PASSWORD ?? 'change-this-local-password';

  console.log('Seeding permissions and roles...');
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

  console.log('Seeding warehouse and locations...');
  const warehouse = await prisma.warehouse.upsert({
    where: { code: 'NBO-01' },
    create: {
      code: 'NBO-01',
      name: 'Nairobi Industrial Area Hub',
      address: { county: 'Nairobi', area: 'Industrial Area, Commercial Street' },
    },
    update: { isActive: true },
  });

  const warehouseBins = [
    ['FAST_PICK', 'A01', 'R01', 'S1', 'B01'],
    ['FAST_PICK', 'A01', 'R01', 'S1', 'B02'],
    ['BULK', 'B02', 'R04', 'S2', 'B01'],
    ['QUARANTINE', 'Q01', 'R01', 'S1', 'B01'],
  ];
  const locations: Array<Record<string, unknown>> = [];
  for (const [zone, aisle, rack, shelf, bin] of warehouseBins) {
    const barcode = `W1-${aisle}-${rack}-${shelf}-${bin}`;
    const loc = await prisma.warehouseLocation.upsert({
      where: { barcode },
      create: { warehouseId: warehouse.id, zone, aisle, rack, shelf, bin, barcode },
      update: { warehouseId: warehouse.id, zone },
    });
    locations.push(loc);
  }

  console.log('Seeding delivery routes...');
  const routeDefinitions = [
    { routeCode: 'WESTLANDS-01', name: 'Westlands & Parklands Corridor', areas: ['Westlands', 'Rhapta Road', 'Parklands', 'Spring Valley'] },
    { routeCode: 'KILIMANI-02', name: 'Kilimani, Kileleshwa & Lavington', areas: ['Kilimani', 'Kileleshwa', 'Lavington', 'Hurlingham'] },
    { routeCode: 'THIKA-RD-01', name: 'Thika Road & Roysambu Hub', areas: ['Roysambu', 'Kasarani', 'Kahawa West', 'Ruiru', 'Thika'] },
    { routeCode: 'MOMBASA-RD-01', name: 'Mombasa Road & South B/C', areas: ['South B', 'South C', 'Imara Daima', 'Syokimau', 'Mombasa Road'] },
  ];
  const routes = new Map<string, string>();
  for (const route of routeDefinitions) {
    const r = await prisma.deliveryRoute.upsert({
      where: { routeCode: route.routeCode },
      create: { routeCode: route.routeCode, name: route.name, subCountiesServed: route.areas },
      update: { name: route.name, subCountiesServed: route.areas },
    });
    routes.set(r.routeCode, r.id);
  }

  console.log('Seeding standard contract rate card...');
  const rateCard = await prisma.rateCard.upsert({
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

  const passwordHash = await hashPassword(demoPassword);

  console.log('Seeding Super Admin user...');
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      passwordHash,
      phoneNumber: process.env.SHIPIT_ADMIN_PHONE ?? '+254700000000',
      firstName: 'Operations',
      lastName: 'Director',
      status: 'ACTIVE',
    },
    update: { passwordHash, status: 'ACTIVE' },
  });
  await prisma.userRole.deleteMany({ where: { userId: adminUser.id } });
  await prisma.userRole.create({ data: { userId: adminUser.id, roleId: roleIds.get('SUPER_ADMIN')! } });

  console.log('Seeding demo merchant (Glow Aura Beauty Kenya)...');
  const merchant = await prisma.merchant.upsert({
    where: { code: 'GLOW-AURA' },
    create: {
      code: 'GLOW-AURA',
      name: 'Glow Aura Beauty Kenya',
      contactEmail: 'merchant@glowaura.co.ke',
      contactPhone: '+254712000111',
      status: 'ACTIVE',
      rateCardId: rateCard.id,
      mpesaB2cPhone: '+254712000111',
    },
    update: { status: 'ACTIVE', rateCardId: rateCard.id },
  });

  const merchantUser = await prisma.user.upsert({
    where: { email: 'merchant@glowaura.co.ke' },
    create: {
      merchantId: merchant.id,
      email: 'merchant@glowaura.co.ke',
      passwordHash,
      phoneNumber: '+254712000111',
      firstName: 'Sarah',
      lastName: 'Achieng',
      status: 'ACTIVE',
    },
    update: { passwordHash, status: 'ACTIVE', merchantId: merchant.id },
  });
  await prisma.userRole.deleteMany({ where: { userId: merchantUser.id } });
  await prisma.userRole.create({ data: { userId: merchantUser.id, roleId: roleIds.get('MERCHANT_ADMIN')! } });

  console.log('Seeding catalog products and stock levels...');
  const productA = await prisma.product.upsert({
    where: { merchantId_sku: { merchantId: merchant.id, sku: 'GLOW-SERUM-01' } },
    create: {
      merchantId: merchant.id,
      sku: 'GLOW-SERUM-01',
      barcode: '782910481901',
      name: 'Vitamin C Radiance Serum 50ml',
      declaredValueKes: 2800,
      weightKg: 0.25,
      isFragile: true,
    },
    update: {},
  });

  const productB = await prisma.product.upsert({
    where: { merchantId_sku: { merchantId: merchant.id, sku: 'GLOW-CREAM-01' } },
    create: {
      merchantId: merchant.id,
      sku: 'GLOW-CREAM-01',
      barcode: '782910481902',
      name: 'Hydrating Ceramide Barrier Cream 100ml',
      declaredValueKes: 3400,
      weightKg: 0.35,
      isFragile: false,
    },
    update: {},
  });

  // Seed inventory levels
  const fastPickLocation = locations[0] as { id: string };
  await prisma.inventoryLevel.upsert({
    where: { productId_locationId: { productId: productA.id, locationId: fastPickLocation.id } },
    create: { productId: productA.id, locationId: fastPickLocation.id, availableQty: 150 },
    update: { availableQty: 150 },
  });
  await prisma.inventoryLevel.upsert({
    where: { productId_locationId: { productId: productB.id, locationId: fastPickLocation.id } },
    create: { productId: productB.id, locationId: fastPickLocation.id, availableQty: 120 },
    update: { availableQty: 120 },
  });

  console.log('Seeding demo fleet rider (James Mwangi)...');
  const riderUser = await prisma.user.upsert({
    where: { email: 'rider@shipit.co.ke' },
    create: {
      email: 'rider@shipit.co.ke',
      passwordHash,
      phoneNumber: '+254712345678',
      firstName: 'James',
      lastName: 'Mwangi',
      status: 'ACTIVE',
    },
    update: { passwordHash, status: 'ACTIVE' },
  });
  await prisma.userRole.deleteMany({ where: { userId: riderUser.id } });
  await prisma.userRole.create({ data: { userId: riderUser.id, roleId: roleIds.get('RIDER')! } });

  const rider = await prisma.rider.upsert({
    where: { userId: riderUser.id },
    create: {
      userId: riderUser.id,
      phoneNumber: '+254712345678',
      vehicleRegPlate: 'KME 482B',
      nationalIdNumber: '32456789',
      activeStatus: 'ON_DUTY',
    },
    update: { activeStatus: 'ON_DUTY' },
  });

  console.log('Seeding demo orders, manifest and waybill...');
  const manifest = await prisma.dispatchManifest.upsert({
    where: { manifestNumber: 'MNF-WESTLANDS-01' },
    create: {
      manifestNumber: 'MNF-WESTLANDS-01',
      routeId: routes.get('WESTLANDS-01')!,
      riderId: rider.id,
      status: 'IN_TRANSIT',
      totalParcels: 1,
      expectedCodTotalKes: 3400,
      dispatchedAt: new Date(),
    },
    update: { status: 'IN_TRANSIT', riderId: rider.id },
  });

  // Out for delivery order
  const orderA = await prisma.order.upsert({
    where: { orderNumber: 'ORD-84920' },
    create: {
      merchantId: merchant.id,
      orderNumber: 'ORD-84920',
      externalReference: 'EXT-84920',
      customerName: 'Grace Wanjiru',
      customerPhone: '+254722123456',
      county: 'Nairobi',
      townOrSubCounty: 'Westlands',
      estateOrArea: 'Rhapta Road',
      buildingOrCourt: 'Parkview Heights, 4th Floor Apt 4B',
      landmark: 'Opposite Shell Petrol Station',
      orderValueKes: 3400,
      deliveryFeeKes: 250,
      codAmountExpectedKes: 3400,
      paymentMethod: 'COD_MPESA',
      status: 'OUT_FOR_DELIVERY',
      waybillNumber: 'WB-84920-KE',
      manifestId: manifest.id,
      items: {
        create: [{ productId: productB.id, quantity: 1, unitPriceKes: 3400 }],
      },
      waybill: {
        create: {
          trackingNumber: 'WB-84920-KE',
          barcodeCode128: 'WB-84920-KE',
          qrCodePayload: 'https://shipit.co.ke/track?waybill=WB-84920-KE',
        },
      },
    },
    update: { status: 'OUT_FOR_DELIVERY', manifestId: manifest.id },
  });

  // Pending verification order
  await prisma.order.upsert({
    where: { orderNumber: 'ORD-91024' },
    create: {
      merchantId: merchant.id,
      orderNumber: 'ORD-91024',
      externalReference: 'EXT-91024',
      customerName: 'Brian Otieno',
      customerPhone: '+254733987654',
      county: 'Nairobi',
      townOrSubCounty: 'Kilimani',
      estateOrArea: 'Dennis Pritt Road',
      buildingOrCourt: 'Silver Springs Court, Unit 12',
      landmark: 'Next to French School',
      orderValueKes: 2800,
      deliveryFeeKes: 250,
      codAmountExpectedKes: 2800,
      paymentMethod: 'COD_CASH',
      status: 'PENDING_VERIFICATION',
      items: {
        create: [{ productId: productA.id, quantity: 1, unitPriceKes: 2800 }],
      },
    },
    update: {},
  });

  console.log('\n======================================================');
  console.log('✅ Ship It Master Demo Database Seeded Successfully!');
  console.log('======================================================');
  console.log('Credentials:');
  console.log(`1. STAFF OPERATIONS PORTAL:`);
  console.log(`   URL:      http://localhost:3000`);
  console.log(`   Email:    ${adminEmail}`);
  console.log(`   Password: ${demoPassword}`);
  console.log(`\n2. MERCHANT PORTAL:`);
  console.log(`   URL:      http://localhost:3001`);
  console.log(`   Email:    merchant@glowaura.co.ke`);
  console.log(`   Password: ${demoPassword}`);
  console.log(`\n3. RIDER PWA:`);
  console.log(`   URL:      http://localhost:3002`);
  console.log(`   Email:    rider@shipit.co.ke`);
  console.log(`   Password: ${demoPassword}`);
  console.log(`\n4. PUBLIC MARKETING & TRACKING WEBSITE:`);
  console.log(`   URL:      http://localhost:3003`);
  console.log(`   Waybill:  WB-84920-KE`);
  console.log('======================================================\n');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
