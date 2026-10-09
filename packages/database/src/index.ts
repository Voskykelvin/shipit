import { PrismaClient } from '@prisma/client';
export { hashPassword, verifyPassword } from './password.js';

export { PrismaClient };

const prismaGlobal = globalThis as typeof globalThis & {
  shipitPrisma?: import('@prisma/client').PrismaClient;
};

export const prisma =
  prismaGlobal.shipitPrisma ??
  new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  prismaGlobal.shipitPrisma = prisma;
}
