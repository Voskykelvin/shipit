import { parse as parseCsv } from 'csv-parse/sync';
import { orderCsvRowSchema } from '@shipit/validation';

export interface CsvOrderGroup {
  merchantId: string;
  externalReference: string;
  customerName: string;
  customerPhone: string;
  customerAltPhone?: string;
  address: {
    county: string;
    townOrSubCounty: string;
    estateOrArea: string;
    buildingOrCourt?: string;
    landmark: string;
    gpsLatitude?: number;
    gpsLongitude?: number;
    googleMapsUrl?: string;
    whatsappLocationText?: string;
  };
  deliveryFeeKes: number;
  paymentMethod: 'COD_MPESA' | 'COD_CASH' | 'PREPAID';
  preferredDeliveryDate?: string;
  verificationNotes?: string;
  items: Array<{ sku: string; quantity: number; unitPriceKes: number }>;
}

export class OrderCsvError extends Error {}

export function parseOrderCsv(csv: string): CsvOrderGroup[] {
  let rows: unknown[];
  try {
    rows = parseCsv(csv, { columns: true, skip_empty_lines: true, bom: true, trim: true, max_record_size: 100_000 });
  } catch {
    throw new OrderCsvError('CSV could not be parsed; check quoting and row delimiters');
  }
  if (rows.length === 0) throw new OrderCsvError('CSV contains no order rows');

  const grouped = new Map<string, { header: Omit<CsvOrderGroup, 'items'>; items: CsvOrderGroup['items'] }>();
  for (const [index, row] of rows.entries()) {
    const parsed = orderCsvRowSchema.safeParse(row);
    if (!parsed.success) {
      throw new OrderCsvError(`CSV row ${index + 2} is invalid: ${parsed.error.issues[0]?.message ?? 'invalid values'}`);
    }

    const value = parsed.data;
    const key = `${value.merchant_id}\u0000${value.external_reference}`;
    const header = {
      merchantId: value.merchant_id,
      externalReference: value.external_reference,
      customerName: value.customer_name,
      customerPhone: value.customer_phone,
      customerAltPhone: value.customer_alt_phone,
      address: {
        county: value.county,
        townOrSubCounty: value.town_or_sub_county,
        estateOrArea: value.estate_or_area,
        buildingOrCourt: value.building_or_court,
        landmark: value.landmark,
        gpsLatitude: value.gps_latitude,
        gpsLongitude: value.gps_longitude,
        googleMapsUrl: value.google_maps_url,
        whatsappLocationText: value.whatsapp_location_text,
      },
      deliveryFeeKes: value.delivery_fee_kes,
      paymentMethod: value.payment_method,
      preferredDeliveryDate: value.preferred_delivery_date,
      verificationNotes: value.verification_notes,
    };
    const existing = grouped.get(key);
    if (existing && JSON.stringify(existing.header) !== JSON.stringify(header)) {
      throw new OrderCsvError(`CSV rows for external reference ${value.external_reference} contain conflicting order details`);
    }
    const group = existing ?? { header, items: [] };
    group.items.push({ sku: value.product_sku, quantity: value.quantity, unitPriceKes: value.unit_price_kes });
    grouped.set(key, group);
  }
  return [...grouped.values()].map(({ header, items }) => ({ ...header, items }));
}
