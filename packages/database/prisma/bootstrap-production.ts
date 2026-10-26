import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/password.js';
import { rolePermissions } from './role-permissions.js';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SHIPIT_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SHIPIT_ADMIN_PASSWORD;
  const phoneNumber = process.env.SHIPIT_ADMIN_PHONE?.trim();

  if (!email || !email.includes('@') || !password || password.length < 16 || !phoneNumber) {
    throw new Error('Set a valid SHIPIT_ADMIN_EMAIL, a SHIPIT_ADMIN_PASSWORD of at least 16 characters, and SHIPIT_ADMIN_PHONE.');
  }

  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    const permissionIds = new Map<string, string>();
    for (const slug of [...new Set(Object.values(rolePermissions).flat())]) {
      const permission = await tx.permission.upsert({
        where: { slug },
        create: { slug },
        update: {},
      });
      permissionIds.set(slug, permission.id);
    }

    const roleIds = new Map<string, string>();
    for (const [name, permissions] of Object.entries(rolePermissions)) {
      const role = await tx.role.upsert({
        where: { name },
        create: { name },
        update: {},
      });
      roleIds.set(name, role.id);
      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
      await tx.rolePermission.createMany({
        data: permissions.map((slug) => ({ roleId: role.id, permissionId: permissionIds.get(slug)! })),
      });
    }

    const warehouse = await tx.warehouse.upsert({
      where: { code: 'NBO-01' },
      create: {
        code: 'NBO-01',
        name: 'Nairobi Industrial Area Hub',
        address: { county: 'Nairobi', area: 'Industrial Area, Commercial Street' },
      },
      update: { isActive: true },
    });
    for (const [zone, aisle, rack, shelf, bin] of [
      ['FAST_PICK', 'A01', 'R01', 'S1', 'B01'],
      ['FAST_PICK', 'A01', 'R01', 'S1', 'B02'],
      ['BULK', 'B02', 'R04', 'S2', 'B01'],
      ['QUARANTINE', 'Q01', 'R01', 'S1', 'B01'],
    ]) {
      const barcode = `W1-${aisle}-${rack}-${shelf}-${bin}`;
      await tx.warehouseLocation.upsert({
        where: { barcode },
        create: { warehouseId: warehouse.id, zone, aisle, rack, shelf, bin, barcode },
        update: { warehouseId: warehouse.id, zone },
      });
    }

    for (const route of [
      { routeCode: 'WESTLANDS-01', name: 'Westlands & Parklands Corridor', areas: ['Westlands', 'Rhapta Road', 'Parklands', 'Spring Valley'] },
      { routeCode: 'KILIMANI-02', name: 'Kilimani, Kileleshwa & Lavington', areas: ['Kilimani', 'Kileleshwa', 'Lavington', 'Hurlingham'] },
      { routeCode: 'THIKA-RD-01', name: 'Thika Road & Roysambu Hub', areas: ['Roysambu', 'Kasarani', 'Kahawa West', 'Ruiru', 'Thika'] },
      { routeCode: 'MOMBASA-RD-01', name: 'Mombasa Road & South B/C', areas: ['South B', 'South C', 'Imara Daima', 'Syokimau', 'Mombasa Road'] },
    ]) {
      await tx.deliveryRoute.upsert({
        where: { routeCode: route.routeCode },
        create: { routeCode: route.routeCode, name: route.name, subCountiesServed: route.areas },
        update: { name: route.name, subCountiesServed: route.areas },
      });
    }

    await tx.rateCard.upsert({
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

    const superAdminRoleId = roleIds.get('SUPER_ADMIN');
    if (!superAdminRoleId) throw new Error('The SUPER_ADMIN role is missing.');
    const existingAdmin = await tx.user.findUnique({ where: { email } });
    if (existingAdmin) {
      const existingSuperAdmin = await tx.userRole.findFirst({
        where: { userId: existingAdmin.id, roleId: superAdminRoleId },
      });
      if (!existingSuperAdmin) {
        throw new Error(`Refusing to elevate existing non-admin account ${email}.`);
      }
    }

    const admin = await tx.user.upsert({
      where: { email },
      create: {
        email,
        passwordHash,
        phoneNumber,
        firstName: 'Operations',
        lastName: 'Administrator',
        status: 'ACTIVE',
      },
      update: { status: 'ACTIVE' },
    });
    await tx.userRole.deleteMany({ where: { userId: admin.id } });
    await tx.userRole.create({ data: { userId: admin.id, roleId: superAdminRoleId } });
  }, { maxWait: 10000, timeout: 30000 });

  console.info(`Production administrator and operational baseline are ready for ${email}.`);
}

main()
  .catch((error: unknown) => {
    console.error('Could not bootstrap production data', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
