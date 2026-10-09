import React from 'react';
import type { InventoryStockSummary, WarehouseLocation } from '@shipit/shared-types';
import type { InboundShipment, Merchant, Product } from '../../types';
import { today } from '../../types';
import { Empty, Panel, RecordsTable, Status } from '../../components/ui';
import { ChevronRight } from 'lucide-react';

interface WarehouseViewProps {
  stock: InventoryStockSummary[];
  products: Product[];
  locations: WarehouseLocation[];
  inbound: InboundShipment[];
  transactions: Array<Record<string, unknown>>;
  merchants: Merchant[];
  busy: boolean;
  can: (permission: string) => boolean;
  onAdjustInventory: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onSubmitInbound: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onReceiveInbound: (event: React.FormEvent<HTMLFormElement>, shipment: InboundShipment) => Promise<void>;
}

export function WarehouseView({
  stock,
  products,
  locations,
  inbound,
  transactions,
  merchants,
  busy,
  can,
  onAdjustInventory,
  onSubmitInbound,
  onReceiveInbound,
}: WarehouseViewProps) {
  const warehouses = [...new Map(locations.map((loc) => [loc.warehouseId, loc])).values()];
  const storageLocations = locations.filter((loc) => loc.zone !== 'QUARANTINE');

  return (
    <>
      <div className="staff-two-col">
        {can('inventory.view') && (
          <Panel
            title="Current stock"
            subtitle="Balances calculated from append-only inventory transactions."
          >
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product</th>
                    <th>Available</th>
                    <th>Reserved</th>
                    <th>Damaged</th>
                    <th>Quarantine</th>
                  </tr>
                </thead>
                <tbody>
                  {stock.map((item) => (
                    <tr key={item.productId}>
                      <td>
                        <code>{item.sku}</code>
                      </td>
                      <td>{item.productName}</td>
                      <td>{item.availableQty}</td>
                      <td>{item.reservedQty}</td>
                      <td>{item.damagedQty}</td>
                      <td>{item.quarantineQty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {can('inventory.adjust') && (
          <Panel
            title="Adjust stock"
            subtitle="All adjustments require a reason and are audit logged."
          >
            <form className="staff-form" onSubmit={(event) => void onAdjustInventory(event)}>
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
                Location
                <select name="locationId" required>
                  {storageLocations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.barcode} · {location.zone}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-three">
                <label>
                  Available Δ
                  <input name="deltaAvailable" type="number" defaultValue="0" required />
                </label>
                <label>
                  Damaged Δ
                  <input name="deltaDamaged" type="number" defaultValue="0" />
                </label>
                <label>
                  Quarantine Δ
                  <input name="deltaQuarantine" type="number" defaultValue="0" />
                </label>
              </div>
              <label>
                Reason
                <input name="reasonCode" minLength={3} required />
              </label>
              <button className="btn btn-primary" disabled={busy}>
                Post adjustment
              </button>
            </form>
          </Panel>
        )}
      </div>

      {can('inbound.create') && (
        <Panel title="Schedule inbound shipment (ASN)">
          <form className="staff-form form-row" onSubmit={(event) => void onSubmitInbound(event)}>
            <label>
              Merchant
              <select name="merchantId" required>
                {merchants.map((merchant) => (
                  <option key={merchant.id} value={merchant.id}>
                    {merchant.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Warehouse
              <select name="warehouseId" required>
                {warehouses.map((location) => (
                  <option key={location.warehouseId} value={location.warehouseId}>
                    {location.warehouseId}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Product
              <select name="productId" required>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Expected units
              <input name="expectedUnits" type="number" min="1" required />
            </label>
            <label>
              Expected date
              <input name="expectedDeliveryDate" type="date" min={today()} required />
            </label>
            <label>
              Notes
              <input name="notes" />
            </label>
            <button className="btn btn-primary">Create ASN</button>
          </form>
        </Panel>
      )}

      {can('inventory.view') && (
        <Panel title="Inbound receiving queue">
          {inbound.map((shipment) => (
            <details className="record-card" key={shipment.id}>
              <summary>
                <strong>{shipment.asnNumber}</strong>
                <Status value={shipment.status} />
                <span>
                  {shipment.items.length} products · expected{' '}
                  {new Date(shipment.expectedDeliveryDate).toLocaleDateString()}
                </span>
                <ChevronRight size={16} />
              </summary>
              {can('inventory.receive') && (
                <form
                  className="staff-form"
                  onSubmit={(event) => void onReceiveInbound(event, shipment)}
                >
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Expected</th>
                          <th>Received</th>
                          <th>Damaged</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shipment.items.map((item) => (
                          <tr key={item.id}>
                            <td>
                              {products.find((p) => p.id === item.productId)?.sku ?? item.productId}
                            </td>
                            <td>{item.expectedUnits - item.receivedUnits}</td>
                            <td>
                              <input
                                name={`received-${item.id}`}
                                type="number"
                                min="0"
                                max={item.expectedUnits - item.receivedUnits}
                                defaultValue={item.expectedUnits - item.receivedUnits}
                                required
                              />
                            </td>
                            <td>
                              <input
                                name={`damaged-${item.id}`}
                                type="number"
                                min="0"
                                defaultValue="0"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <label>
                    Storage location
                    <select name="locationId" required>
                      {storageLocations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.barcode} · {location.zone}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="btn btn-primary" disabled={busy}>
                    Record receipt
                  </button>
                </form>
              )}
            </details>
          ))}
          {inbound.length === 0 && <Empty>No inbound ASNs.</Empty>}
        </Panel>
      )}

      {can('inventory.locations.view') && (
        <Panel title="Warehouse locations">
          <div className="location-grid">
            {locations.map((location) => (
              <div className="location-chip" key={location.id}>
                <code>{location.barcode}</code>
                <span>{location.zone}</span>
                <Status value={location.isOccupied ? 'OCCUPIED' : 'AVAILABLE'} />
              </div>
            ))}
          </div>
        </Panel>
      )}

      {can('inventory.view') && (
        <Panel title="Recent inventory ledger">
          <RecordsTable records={transactions.slice(0, 30)} />
        </Panel>
      )}
    </>
  );
}
