import type {
  InventoryStockSummary,
  MerchantLedgerEntry,
  MerchantSettlement,
  Order,
} from '@shipit/shared-types';

export type Tab = 'overview' | 'orders' | 'inventory' | 'finance' | 'tracking';

export interface Product {
  id: string;
  sku: string;
  name: string;
  declaredValueKes: number;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
}

export interface InboundShipment {
  id: string;
  asnNumber: string;
  status: string;
  expectedDeliveryDate: string;
  items: Array<{
    id: string;
    productId: string;
    expectedUnits: number;
    receivedUnits: number;
  }>;
}

export interface TrackingInfo {
  trackingNumber: string;
  orderNumber: string;
  status: string;
  destination: { county: string; townOrSubCounty: string };
  timeline: Array<{ status: string; occurredAt: string; detail?: string }>;
}

export interface MerchantData {
  orders: Order[];
  stock: InventoryStockSummary[];
  products: Product[];
  warehouses: Warehouse[];
  inbound: InboundShipment[];
  ledgers: MerchantLedgerEntry[];
  settlements: MerchantSettlement[];
}

export const emptyData: MerchantData = {
  orders: [],
  stock: [],
  products: [],
  warehouses: [],
  inbound: [],
  ledgers: [],
  settlements: [],
};

export const kes = (amount: number) => `KES ${amount.toLocaleString()}`;
export const dateToday = () => new Date().toISOString().slice(0, 10);
