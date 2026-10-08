import { z } from 'zod';

// ==========================================
// KENYA PHONE NUMBER REGEX & NORMALIZER
// Matches +2547XXXXXXXX, 07XXXXXXXX, 01XXXXXXXX, 2547XXXXXXXX
// ==========================================
export const kenyaPhoneSchema = z
  .string()
  .trim()
  .regex(
    /^(?:(?:\+?254)|0)?([17]\d{8})$/,
    'Must be a valid Kenyan mobile number (e.g. 0712345678 or +254712345678)'
  )
  .transform((val) => {
    const cleaned = val.replace(/\D/g, '');
    if (cleaned.startsWith('254')) return `+${cleaned}`;
    if (cleaned.startsWith('0')) return `+254${cleaned.slice(1)}`;
    return `+254${cleaned}`;
  });

// ==========================================
// KENYA ADDRESS SCHEMA
// ==========================================
export const kenyaAddressSchema = z.object({
  county: z.string().min(2, 'County is required (e.g. Nairobi, Kiambu, Machakos)'),
  townOrSubCounty: z.string().min(2, 'Town or Sub-County is required (e.g. Westlands, Ruiru)'),
  estateOrArea: z.string().min(2, 'Estate or Area is required (e.g. Kilimani, Rhapta Road)'),
  buildingOrCourt: z.string().optional(),
  landmark: z.string().min(3, 'Clear landmark is required for dispatch riders'),
  gpsLatitude: z.number().optional(),
  gpsLongitude: z.number().optional(),
  googleMapsUrl: z.string().url().optional().or(z.literal('')),
  whatsappLocationText: z.string().optional(),
});

// ==========================================
// ORDER ITEM & ORDER CREATION SCHEMA
// ==========================================
export const createOrderItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().positive('Quantity must be greater than 0'),
  unitPriceKes: z.number().nonnegative('Unit price cannot be negative'),
});

export const createOrderSchema = z.object({
  merchantId: z.string().min(1, 'Merchant ID is required'),
  customerName: z.string().min(2, 'Customer name is required'),
  customerPhone: kenyaPhoneSchema,
  customerAltPhone: kenyaPhoneSchema.optional().or(z.literal('')),
  address: kenyaAddressSchema,
  items: z.array(createOrderItemSchema).min(1, 'At least one order item is required'),
  deliveryFeeKes: z.number().nonnegative().default(250),
  paymentMethod: z.enum(['COD_MPESA', 'COD_CASH', 'PREPAID']),
  codAmountExpectedKes: z.number().nonnegative().default(0),
  preferredDeliveryDate: z.string().optional(),
  externalReference: z.string().optional(),
  verificationNotes: z.string().optional(),
});

// ==========================================
// ASN / INBOUND RECEIVING SCHEMA
// ==========================================
export const createInboundItemSchema = z.object({
  productId: z.string().min(1),
  expectedUnits: z.number().int().positive('Expected units must be at least 1'),
});

export const createInboundShipmentSchema = z.object({
  merchantId: z.string().min(1),
  warehouseId: z.string().min(1),
  expectedDeliveryDate: z.string().min(1),
  items: z.array(createInboundItemSchema).min(1),
  notes: z.string().optional(),
});

export const receiveInboundItemVerificationSchema = z.object({
  inboundItemId: z.string().min(1),
  receivedUnits: z.number().int().nonnegative(),
  damagedUnits: z.number().int().nonnegative().default(0),
  locationId: z.string().min(1, 'Target storage location is required'),
});

// ==========================================
// INVENTORY ADJUSTMENT SCHEMA
// ==========================================
export const inventoryAdjustmentSchema = z.object({
  productId: z.string().min(1),
  locationId: z.string().min(1),
  deltaAvailable: z.number().int(),
  deltaDamaged: z.number().int().default(0),
  deltaQuarantine: z.number().int().default(0),
  reasonCode: z.string().min(3, 'Detailed adjustment reason required for audit'),
  supervisorApprovedBy: z.string().min(1, 'Supervisor approval required'),
});

// ==========================================
// RIDER RECONCILIATION SCHEMA
// ==========================================
export const riderShiftCloseoutSchema = z.object({
  riderId: z.string().min(1),
  shiftDate: z.string().min(1),
  cashHandedInKes: z.number().nonnegative(),
  supervisorApprovedBy: z.string().optional(),
  varianceNotes: z.string().optional(),
});

// ==========================================
// PROOF OF DELIVERY (POD) SUBMISSION
// ==========================================
export const submitPodSchema = z.object({
  orderId: z.string().min(1),
  riderId: z.string().min(1),
  recipientName: z.string().min(2),
  paymentChannel: z.enum(['MPESA_STK', 'MPESA_C2B', 'CASH', 'PREPAID']),
  mpesaReceiptNumber: z.string().optional(),
  amountCollectedKes: z.number().nonnegative(),
  signatureUrl: z.string().optional(),
  photoUrl: z.string().optional(),
  gpsLat: z.number().optional(),
  gpsLng: z.number().optional(),
});
