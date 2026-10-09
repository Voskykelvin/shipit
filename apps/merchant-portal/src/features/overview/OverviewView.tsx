import React from 'react';
import { Banknote, Box, Package, ShoppingBag } from 'lucide-react';
import type { MerchantData } from '../../types';
import { kes } from '../../types';
import { Metric, Panel, OrderTable } from '../../components/ui';

interface OverviewViewProps {
  data: MerchantData;
  firstName: string;
  busy: boolean;
  onNavigateToOrders: () => void;
  onDownloadLabel: (trackingNumber: string) => Promise<void>;
}

export function OverviewView({
  data,
  firstName,
  busy,
  onNavigateToOrders,
  onDownloadLabel,
}: OverviewViewProps) {
  const stockUnits = data.stock.reduce((sum, item) => sum + item.availableQty, 0);
  const openOrders = data.orders.filter(
    (order) => !['DELIVERED', 'CANCELLED', 'RETURNED_TO_WAREHOUSE'].includes(order.status),
  ).length;
  const balance = data.ledgers.reduce((sum, entry) => sum + entry.amountKes, 0);

  return (
    <>
      <div className="welcome-row">
        <div>
          <p className="eyebrow">YOUR FULFILLMENT SNAPSHOT</p>
          <h2>Welcome, {firstName}</h2>
          <p>Live figures from your orders, inventory and merchant ledger.</p>
        </div>
        <span className="live-chip">{busy ? 'SYNCING' : 'LIVE DATA'}</span>
      </div>

      <div className="grid-4">
        <Metric
          icon={<Box />}
          label="Available stock"
          value={`${stockUnits.toLocaleString()} units`}
          detail={`${data.stock.length} product SKUs`}
        />
        <Metric
          icon={<ShoppingBag />}
          label="Open orders"
          value={openOrders.toLocaleString()}
          detail={`${data.orders.length} total orders`}
        />
        <Metric
          icon={<Banknote />}
          label="Ledger balance"
          value={kes(balance)}
          detail="Net posted transactions"
        />
        <Metric
          icon={<Package />}
          label="Inbound shipments"
          value={data.inbound
            .filter((item) => !['COMPLETED', 'CANCELLED'].includes(item.status))
            .length.toString()}
          detail={`${data.inbound.length} total ASNs`}
        />
      </div>

      <Panel
        title="Latest orders"
        action={
          <button className="text-button" onClick={onNavigateToOrders}>
            View all
          </button>
        }
      >
        <OrderTable orders={data.orders.slice(0, 6)} onLabel={onDownloadLabel} />
      </Panel>
    </>
  );
}
