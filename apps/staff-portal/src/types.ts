import type {
  DispatchManifest,
  InventoryStockSummary,
  MerchantLedgerEntry,
  MerchantSettlement,
  NDRCase,
  Order,
  Rider,
  RiderShiftReconciliation,
  SystemException,
  WarehouseLocation,
} from '@shipit/shared-types';

export type Tab =
  | 'overview'
  | 'orders'
  | 'warehouse'
  | 'picking'
  | 'dispatch'
  | 'exceptions'
  | 'returns'
  | 'finance'
  | 'setup';

export interface Summary {
  kpis: {
    totalOrdersToday: number;
    pendingVerification: number;
    readyToPick: number;
    packed: number;
    outForDelivery: number;
    delivered: number;
    ndrExceptions: number;
    totalCodCollectedKes: number;
    totalCodPendingKes: number;
    deliverySuccessRatePct: number;
    rtoRatePct: number;
  };
  activeExceptions: SystemException[];
}

export interface RouteInfo {
  id: string;
  routeCode: string;
  name: string;
  areasCovered: string[];
  isActive: boolean;
}

export interface PickTask {
  id: string;
  allocationId: string;
  orderId: string;
  orderNumber: string;
  productId: string;
  sku: string;
  productName: string;
  barcode: string;
  quantity: number;
  pickedQuantity: number;
  location: { id: string; barcode: string; zone: string };
  isConfirmed: boolean;
}

export interface PickWave {
  id: string;
  waveNumber: string;
  status: string;
  taskCount: number;
  confirmedTaskCount: number;
  tasks: PickTask[];
}

export interface InboundShipment {
  id: string;
  asnNumber: string;
  warehouseId: string;
  status: string;
  expectedDeliveryDate: string;
  items: Array<{
    id: string;
    productId: string;
    expectedUnits: number;
    receivedUnits: number;
    damagedUnits: number;
  }>;
}

export interface Product {
  id: string;
  merchantId: string;
  sku: string;
  barcode: string;
  name: string;
  declaredValueKes: number;
  weightKg: number;
}

export interface Merchant {
  id: string;
  code: string;
  name: string;
  contactEmail: string;
  contactPhone: string;
  status: string;
}

export interface ReturnRecord {
  id: string;
  returnNumber: string;
  orderId: string;
  merchantId: string;
  returnType: string;
  status: string;
  reason: string;
  items: Array<{
    id: string;
    productId: string;
    expectedUnits: number;
    receivedUnits: number;
    inspectedUnits: number;
    product: { sku: string; name: string };
  }>;
  order: { id: string; orderNumber: string; status: string };
}

export interface ApiRider extends Rider {
  vehiclePlate: string;
}

export const currency = (amount: number) => `KES ${amount.toLocaleString()}`;
export const today = () => new Date().toISOString().slice(0, 10);
