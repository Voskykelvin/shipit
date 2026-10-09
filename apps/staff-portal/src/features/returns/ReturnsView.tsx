import React from 'react';
import type { Order, WarehouseLocation } from '@shipit/shared-types';
import type { ReturnRecord } from '../../types';
import { Empty, Panel, Status } from '../../components/ui';
import { Plus } from 'lucide-react';

interface ReturnsViewProps {
  orders: Order[];
  returns: ReturnRecord[];
  locations: WarehouseLocation[];
  selectedReturnOrderId: string;
  setSelectedReturnOrderId: (id: string) => void;
  selectedReturnProductId: string;
  setSelectedReturnProductId: (id: string) => void;
  busy: boolean;
  can: (permission: string) => boolean;
  onCreateReturn: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onReceiveReturn: (event: React.FormEvent<HTMLFormElement>, record: ReturnRecord) => Promise<void>;
  onInspectReturn: (event: React.FormEvent<HTMLFormElement>, record: ReturnRecord) => Promise<void>;
}

export function ReturnsView({
  orders,
  returns,
  locations,
  selectedReturnOrderId,
  setSelectedReturnOrderId,
  selectedReturnProductId,
  setSelectedReturnProductId,
  busy,
  can,
  onCreateReturn,
  onReceiveReturn,
  onInspectReturn,
}: ReturnsViewProps) {
  const returnableOrders = orders.filter((order) =>
    ['DELIVERED', 'RETURN_IN_TRANSIT'].includes(order.status),
  );
  const selectedReturnOrder =
    returnableOrders.find((order) => order.id === selectedReturnOrderId) ??
    returnableOrders[0];
  const selectedReturnProduct =
    selectedReturnOrder?.items.find((item) => item.productId === selectedReturnProductId) ??
    selectedReturnOrder?.items[0];
  const quarantineLocations = locations.filter((location) => location.zone === 'QUARANTINE');

  return (
    <>
      {can('return.manage') && (
        <Panel
          title="Initiate a return"
          subtitle="Customer returns require a delivered order; immediate RTO requires prior NDR resolution."
        >
          <form className="staff-form form-row" onSubmit={(event) => void onCreateReturn(event)}>
            <label>
              Order
              <select
                name="orderId"
                value={selectedReturnOrder?.id ?? ''}
                onChange={(event) => {
                  const order = returnableOrders.find((item) => item.id === event.target.value);
                  setSelectedReturnOrderId(event.target.value);
                  setSelectedReturnProductId(order?.items[0]?.productId ?? '');
                }}
                required
              >
                {returnableOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.orderNumber} · {order.status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Product
              <select
                name="productId"
                value={selectedReturnProduct?.productId ?? ''}
                onChange={(event) => setSelectedReturnProductId(event.target.value)}
                required
              >
                {selectedReturnOrder?.items.map((item) => (
                  <option key={item.productId} value={item.productId}>
                    {item.sku} · {item.productName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Quantity
              <input
                key={selectedReturnProduct?.productId}
                name="quantity"
                type="number"
                min="1"
                max={selectedReturnProduct?.quantity ?? 1}
                defaultValue="1"
                required
              />
            </label>
            <label>
              Type
              <select name="returnType">
                <option value="CUSTOMER_RETURN">Customer return</option>
                <option value="IMMEDIATE_RTO">Immediate RTO</option>
              </select>
            </label>
            <label>
              Reason
              <input name="reason" required minLength={3} />
            </label>
            <button className="btn btn-primary">
              <Plus size={15} /> Open return
            </button>
          </form>
        </Panel>
      )}

      <Panel title="Return handling queue">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Return</th>
                <th>Order</th>
                <th>Type / reason</th>
                <th>Items</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((record) => (
                <tr key={record.id}>
                  <td>
                    <code>{record.returnNumber}</code>
                  </td>
                  <td>{record.order.orderNumber}</td>
                  <td>
                    {record.returnType}
                    <small>{record.reason}</small>
                  </td>
                  <td>
                    {record.items
                      .map((item) => `${item.product.sku} ${item.receivedUnits}/${item.expectedUnits}`)
                      .join(', ')}
                  </td>
                  <td>
                    <Status value={record.status} />
                  </td>
                  <td>
                    {can('return.inspect') &&
                      ['RETURN_INITIATED', 'IN_TRANSIT'].includes(record.status) && (
                        <details>
                          <summary>Record receipt</summary>
                          <form
                            className="staff-form"
                            onSubmit={(event) => void onReceiveReturn(event, record)}
                          >
                            {record.items.map((item) => (
                              <div className="form-row" key={item.id}>
                                <label>
                                  {item.product.sku} received
                                  <input
                                    name={`received-${item.id}`}
                                    type="number"
                                    min="0"
                                    max={item.expectedUnits}
                                    required
                                  />
                                </label>
                                <label>
                                  Quarantine location
                                  <select name={`location-${item.id}`} defaultValue="">
                                    <option value="">Choose location if received</option>
                                    {quarantineLocations.map((location) => (
                                      <option key={location.id} value={location.id}>
                                        {location.barcode} · {location.zone}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                            ))}
                            <button className="btn btn-secondary btn-sm" disabled={busy}>
                              Record actual receipt
                            </button>
                          </form>
                        </details>
                      )}
                    {can('return.inspect') && record.status === 'RECEIVED_AT_WAREHOUSE' && (
                      <details>
                        <summary>Inspect received units</summary>
                        <form
                          className="staff-form"
                          onSubmit={(event) => void onInspectReturn(event, record)}
                        >
                          {record.items
                            .filter((item) => item.receivedUnits > item.inspectedUnits)
                            .map((item) => (
                              <div className="form-row" key={item.id}>
                                <label>
                                  {item.product.sku} quantity
                                  <input
                                    name={`inspect-${item.id}`}
                                    type="number"
                                    min="0"
                                    max={item.receivedUnits - item.inspectedUnits}
                                    defaultValue={item.receivedUnits - item.inspectedUnits}
                                  />
                                </label>
                                <label>
                                  Condition
                                  <select name={`grade-${item.id}`} defaultValue="">
                                    <option value="">Choose grade</option>
                                    <option value="GRADE_A_RESTOCKABLE">Grade A · restockable</option>
                                    <option value="GRADE_B_DAMAGED_PACKAGING">
                                      Grade B · damaged packaging
                                    </option>
                                    <option value="GRADE_C_DAMAGED_PRODUCT">
                                      Grade C · damaged product
                                    </option>
                                    <option value="WRONG_ITEM_RETURNED">Wrong item returned</option>
                                  </select>
                                </label>
                                <label>
                                  Action
                                  <select name={`action-${item.id}`} defaultValue="">
                                    <option value="">Choose action</option>
                                    <option value="RESTOCKED_TO_AVAILABLE">
                                      Restock to available
                                    </option>
                                    <option value="QUARANTINED">Keep quarantined</option>
                                    <option value="RETURNED_TO_MERCHANT">Return to merchant</option>
                                  </select>
                                </label>
                              </div>
                            ))}
                          <button className="btn btn-secondary btn-sm" disabled={busy}>
                            Save inspection
                          </button>
                        </form>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
              {returns.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <Empty>No return records.</Empty>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
