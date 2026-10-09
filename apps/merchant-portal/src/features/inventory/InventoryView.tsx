import React from 'react';
import type { MerchantData, Product } from '../../types';
import { dateToday } from '../../types';
import { EmptyState, Panel, Status } from '../../components/ui';

interface InventoryViewProps {
  data: MerchantData;
  products: Product[];
  selectedWarehouseId: string;
  setSelectedWarehouseId: (id: string) => void;
  busy: boolean;
  onCreateInbound: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
}

export function InventoryView({
  data,
  products,
  selectedWarehouseId,
  setSelectedWarehouseId,
  busy,
  onCreateInbound,
}: InventoryViewProps) {
  return (
    <>
      <div className="split-grid">
        <Panel
          title="Schedule inbound stock"
          subtitle="Create an ASN for stock expected at the warehouse."
        >
          {products.length === 0 ? (
            <EmptyState>Add a product before creating an inbound shipment.</EmptyState>
          ) : (
            <form className="portal-form" onSubmit={(event) => void onCreateInbound(event)}>
              <label>
                Product
                <select name="productId" required>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.sku} · {product.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Expected units
                <input name="expectedUnits" type="number" min="1" required />
              </label>
              <label>
                Expected delivery date
                <input name="expectedDeliveryDate" type="date" min={dateToday()} required />
              </label>
              <label>
                Notes
                <input name="notes" />
              </label>
              <label>
                Warehouse
                <select
                  name="warehouseId"
                  value={selectedWarehouseId}
                  onChange={(event) => setSelectedWarehouseId(event.target.value)}
                  required
                >
                  {data.warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name} · {warehouse.code}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn-emerald" disabled={busy}>
                Create ASN
              </button>
            </form>
          )}
        </Panel>
        <Panel
          title="Scheduled ASNs"
          subtitle="Warehouse staff will confirm received quantities and any damage."
        >
          {data.inbound.length === 0 ? (
            <EmptyState>No inbound shipments have been scheduled.</EmptyState>
          ) : (
            data.inbound.map((asn) => (
              <div className="asn-row" key={asn.id}>
                <div>
                  <strong>{asn.asnNumber}</strong>
                  <span>
                    {new Date(asn.expectedDeliveryDate).toLocaleDateString()} · {asn.items.length}{' '}
                    items
                  </span>
                </div>
                <Status value={asn.status} />
              </div>
            ))
          )}
        </Panel>
      </div>
      <Panel title="Current stock" subtitle="Stock quantities are read from the inventory ledger.">
        <div className="table-scroll">
          <table className="m-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product</th>
                <th>Available</th>
                <th>Reserved</th>
                <th>Damaged</th>
                <th>Quarantine</th>
                <th>Total physical</th>
              </tr>
            </thead>
            <tbody>
              {data.stock.map((item) => (
                <tr key={item.productId}>
                  <td>
                    <code className="code-pill">{item.sku}</code>
                  </td>
                  <td>{item.productName}</td>
                  <td>{item.availableQty}</td>
                  <td>{item.reservedQty}</td>
                  <td>{item.damagedQty}</td>
                  <td>{item.quarantineQty}</td>
                  <td>{item.totalPhysicalQty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
