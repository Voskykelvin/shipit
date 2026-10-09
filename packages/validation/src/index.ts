import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(12, 'Password must be at least 12 characters'),
});

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

export const createMerchantSchema = z.object({
  code: z.string().trim().min(2).max(32).regex(/^[A-Za-z0-9_-]+$/).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(120),
  contactEmail: z.string().trim().email().transform((value) => value.toLowerCase()),
  contactPhone: kenyaPhoneSchema,
  rateCardId: z.string().optional(),
});

export const createMerchantUserSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(12),
  phoneNumber: kenyaPhoneSchema,
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  role: z.enum(['MERCHANT_ADMIN', 'MERCHANT_STAFF']),
});

export const createProductSchema = z.object({
  merchantId: z.string().min(1),
  sku: z.string().trim().min(1).max(80),
  barcode: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(160),
  description: z.string().max(2000).optional(),
  declaredValueKes: z.number().int().nonnegative(),
  weightKg: z.number().nonnegative(),
  reorderThreshold: z.number().int().nonnegative().default(0),
  isFragile: z.boolean().default(false),
  requiresColdStorage: z.boolean().default(false),
});

export const createRiderSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(12),
  phoneNumber: kenyaPhoneSchema,
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  nationalIdNumber: z.string().trim().min(5).max(32),
  vehicleRegPlate: z.string().trim().min(3).max(24),
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
  unitPriceKes: z.number().int().nonnegative('Unit price must be a whole KES amount'),
});

export const createOrderSchema = z.object({
  merchantId: z.string().min(1, 'Merchant ID is required'),
  customerName: z.string().min(2, 'Customer name is required'),
  customerPhone: kenyaPhoneSchema,
  customerAltPhone: kenyaPhoneSchema.optional().or(z.literal('')),
  address: kenyaAddressSchema,
  items: z.array(createOrderItemSchema).min(1, 'At least one order item is required'),
  deliveryFeeKes: z.number().int().nonnegative().default(250),
  paymentMethod: z.enum(['COD_MPESA', 'COD_CASH', 'PREPAID']),
  codAmountExpectedKes: z.number().nonnegative().default(0),
  preferredDeliveryDate: z.string().date().optional(),
  externalReference: z.string().optional(),
  verificationNotes: z.string().optional(),
});

const csvOptionalNumber = (min: number, max: number) => z.string().trim().default('')
  .transform((value) => value === '' ? undefined : Number(value))
  .pipe(z.number().min(min).max(max).optional());

export const orderCsvRowSchema = z.object({
  merchant_id: z.string().trim().min(1),
  external_reference: z.string().trim().min(1).max(120),
  customer_name: z.string().trim().min(2).max(160),
  customer_phone: kenyaPhoneSchema,
  customer_alt_phone: z.union([kenyaPhoneSchema, z.literal('')]).optional().transform((value) => value || undefined),
  county: z.string().trim().min(2),
  town_or_sub_county: z.string().trim().min(2),
  estate_or_area: z.string().trim().min(2),
  building_or_court: z.string().trim().max(160).default('').transform((value) => value || undefined),
  landmark: z.string().trim().min(3).max(500),
  gps_latitude: csvOptionalNumber(-90, 90),
  gps_longitude: csvOptionalNumber(-180, 180),
  google_maps_url: z.string().trim().default('').transform((value) => value || undefined).pipe(z.string().url().optional()),
  whatsapp_location_text: z.string().trim().max(500).default('').transform((value) => value || undefined),
  delivery_fee_kes: z.string().trim().default('250').transform((value) => value || '250').pipe(z.coerce.number().int().nonnegative()),
  payment_method: z.string().trim().transform((value) => value.toUpperCase()).pipe(z.enum(['COD_MPESA', 'COD_CASH', 'PREPAID'])),
  preferred_delivery_date: z.string().trim().default('').transform((value) => value || undefined).pipe(z.string().date().optional()),
  verification_notes: z.string().trim().max(1000).default('').transform((value) => value || undefined),
  product_sku: z.string().trim().min(1).max(80),
  quantity: z.string().trim().pipe(z.coerce.number().int().positive()),
  unit_price_kes: z.string().trim().pipe(z.coerce.number().int().nonnegative()),
});

export const verifyOrderSchema = z.object({
  isConfirmed: z.boolean(),
  notes: z.string().max(1000).optional(),
});

export const pickAllocationSchema = z.object({
  orderId: z.string().min(1),
  allocationId: z.string().min(1),
  pickTaskId: z.string().min(1).optional(),
  scannedBarcode: z.string().min(1),
  quantity: z.number().int().positive(),
});

export const createPickWaveSchema = z.object({
  orderIds: z.array(z.string().min(1)).min(1).max(100),
  assignedToUserId: z.string().min(1).optional(),
}).superRefine((wave, context) => {
  if (new Set(wave.orderIds).size !== wave.orderIds.length) {
    context.addIssue({ code: 'custom', path: ['orderIds'], message: 'An order may only appear once in a pick wave' });
  }
});

export const packOrderSchema = z.object({
  orderId: z.string().min(1),
  scannedProductBarcodes: z.array(z.string().min(1)).min(1),
});

export const createManifestSchema = z.object({
  routeId: z.string().min(1),
  riderId: z.string().min(1),
});

export const scanWaybillSchema = z.object({
  barcode: z.string().trim().min(1),
  targetRouteCode: z.string().optional(),
  manifestId: z.string().optional(),
});

export const handoverManifestSchema = z.object({
  acceptedParcelCount: z.number().int().positive(),
  acceptedCodTotalKes: z.number().int().nonnegative(),
});

export const failDeliverySchema = z.object({
  orderId: z.string().min(1),
  riderId: z.string().min(1),
  failureReason: z.enum([
    'CUSTOMER_UNREACHABLE',
    'WRONG_LOCATION',
    'RESCHEDULE_REQUESTED',
    'REFUSED_DELIVERY',
    'CASH_SHORTAGE',
  ]),
  notes: z.string().max(1000).optional(),
  rescheduleDate: z.string().date().optional(),
  gpsLat: z.number().min(-90).max(90).optional(),
  gpsLng: z.number().min(-180).max(180).optional(),
});

export const resolveNdrSchema = z.object({
  resolution: z.enum(['RETRY', 'RTO']),
  notes: z.string().min(3).max(1000),
});

export const createReturnSchema = z.object({
  orderId: z.string().min(1),
  returnType: z.enum(['IMMEDIATE_RTO', 'CUSTOMER_POST_DELIVERY_RETURN']),
  reason: z.string().trim().min(3).max(1000),
  notes: z.string().max(1000).optional(),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().positive(),
  })).min(1),
}).superRefine((record, context) => {
  if (new Set(record.items.map((item) => item.productId)).size !== record.items.length) {
    context.addIssue({ code: 'custom', path: ['items'], message: 'Each product may appear only once per return request' });
  }
});

export const receiveReturnSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1),
    receivedUnits: z.number().int().nonnegative(),
    locationId: z.string().min(1).optional(),
  })).min(1),
}).superRefine((record, context) => {
  if (new Set(record.items.map((item) => item.productId)).size !== record.items.length) {
    context.addIssue({ code: 'custom', path: ['items'], message: 'Each return product must have one receiving location' });
  }
  record.items.forEach((item, index) => {
    if (item.receivedUnits > 0 && !item.locationId) {
      context.addIssue({ code: 'custom', path: ['items', index, 'locationId'], message: 'A quarantine location is required for received units' });
    }
  });
});

export const inspectReturnSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().positive(),
    conditionGrade: z.enum(['GRADE_A_RESTOCKABLE', 'GRADE_B_DAMAGED_PACKAGING', 'GRADE_C_DAMAGED_PRODUCT', 'WRONG_ITEM_RETURNED']),
    action: z.enum(['RESTOCKED_TO_AVAILABLE', 'QUARANTINED', 'RETURNED_TO_MERCHANT']),
    photos: z.array(z.string().url()).max(10).default([]),
  })),
});

export const createSettlementSchema = z.object({
  merchantId: z.string().min(1),
  periodStart: z.string().date(),
  periodEnd: z.string().date(),
}).refine((period) => periodStartBeforeOrEqual(period.periodStart, period.periodEnd), {
  path: ['periodEnd'],
  message: 'Period end must be on or after period start',
});

function periodStartBeforeOrEqual(start: string, end: string) {
  return start <= end;
}

export const approveSettlementSchema = z.object({
  settlementId: z.string().min(1),
});

export const markSettlementPaidSchema = z.object({
  payoutReference: z.string().min(3).max(100),
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
  expectedDeliveryDate: z.string().date(),
  items: z.array(createInboundItemSchema).min(1),
  notes: z.string().optional(),
}).superRefine((shipment, context) => {
  const productIds = shipment.items.map((item) => item.productId);
  if (new Set(productIds).size !== productIds.length) {
    context.addIssue({ code: 'custom', path: ['items'], message: 'Each product may appear only once per ASN' });
  }
});

export const receiveInboundItemVerificationSchema = z.object({
  inboundItemId: z.string().min(1),
  receivedUnits: z.number().int().positive(),
  damagedUnits: z.number().int().nonnegative().default(0),
  locationId: z.string().min(1, 'Target storage location is required'),
}).refine((item) => item.damagedUnits <= item.receivedUnits, {
  path: ['damagedUnits'],
  message: 'Damaged units cannot exceed received units',
});

export const receiveInboundShipmentSchema = z.object({
  items: z.array(receiveInboundItemVerificationSchema).min(1),
}).superRefine((receipt, context) => {
  const itemIds = receipt.items.map((item) => item.inboundItemId);
  if (new Set(itemIds).size !== itemIds.length) {
    context.addIssue({ code: 'custom', path: ['items'], message: 'Each ASN item may be received only once per submission' });
  }
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
  shiftDate: z.string().date(),
  cashHandedInKes: z.number().int().nonnegative(),
  supervisorApprovedBy: z.string().optional(),
  varianceNotes: z.string().optional(),
});

export const approveRiderShiftVarianceSchema = z.object({
  approvalNotes: z.string().trim().min(3).max(1000),
});

// ==========================================
// PROOF OF DELIVERY (POD) SUBMISSION
// ==========================================
export const submitPodSchema = z.object({
  orderId: z.string().min(1),
  riderId: z.string().min(1),
  submissionId: z.string().uuid().optional(),
  recipientName: z.string().min(2),
  paymentChannel: z.enum(['MPESA_STK', 'MPESA_C2B', 'CASH', 'PREPAID']),
  mpesaReceiptNumber: z.string().optional(),
  amountCollectedKes: z.number().int().nonnegative(),
  signatureUrl: z.string().max(300_000).optional(),
  photoUrl: z.string().max(600_000).optional(),
  gpsLat: z.number().min(-90).max(90).optional(),
  gpsLng: z.number().min(-180).max(180).optional(),
}).superRefine((submission, context) => {
  if ((submission.signatureUrl?.length ?? 0) + (submission.photoUrl?.length ?? 0) > 850_000) {
    context.addIssue({
      code: 'custom',
      path: ['photoUrl'],
      message: 'Combined POD images are too large; reduce the image size and try again',
    });
  }
});

export const mpesaStkPushSchema = z.object({
  orderId: z.string().min(1),
  riderId: z.string().min(1),
});

const mpesaCallbackItemSchema = z.object({
  Name: z.string(),
  Value: z.union([z.string(), z.number()]).optional(),
});

export const mpesaStkCallbackSchema = z.object({
  Body: z.object({
    stkCallback: z.object({
      MerchantRequestID: z.string(),
      CheckoutRequestID: z.string(),
      ResultCode: z.number().int(),
      ResultDesc: z.string(),
      CallbackMetadata: z.object({ Item: z.array(mpesaCallbackItemSchema) }).optional(),
    }),
  }),
});

export const mpesaC2bCallbackSchema = z.object({
  TransID: z.string().trim().min(1).max(64),
  TransAmount: z.coerce.number().int().positive(),
  BillRefNumber: z.string().trim().min(1).max(100),
  MSISDN: z.union([z.string(), z.number()]).transform(String),
  BusinessShortCode: z.union([z.string(), z.number()]).optional(),
});

export const mpesaB2cResultSchema = z.object({
  Result: z.object({
    ConversationID: z.string(),
    OriginatorConversationID: z.string(),
    ResultCode: z.number().int(),
    ResultDesc: z.string(),
    ResultParameters: z.object({
      ResultParameter: z.array(z.object({ Key: z.string(), Value: z.union([z.string(), z.number()]) })),
    }).optional(),
  }),
});
