import React from 'react';
import type { Order } from '@shipit/shared-types';
import { currency } from '../../types';
import { Empty, Panel, Status } from '../../components/ui';
import { Check, FileUp, XCircle } from 'lucide-react';

interface OrderTableProps {
  orders: Order[];
  can: (permission: string) => boolean;
  onVerify: (id: string, confirmed: boolean) => void;
  onCancel: (id: string) => void;
  onPack: (order: Order) => void;
  onSendNotification?: (phone: string, channel: 'SMS' | 'WHATSAPP', message: string, orderNumber: string) => Promise<void>;
}

export function OrderTable({ orders, can, onVerify, onCancel, onPack, onSendNotification }: OrderTableProps) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer / contact</th>
            <th>Destination</th>
            <th>Items</th>
            <th>COD</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>
                <code>{order.orderNumber}</code>
                {order.waybillNumber && <small>{order.waybillNumber}</small>}
              </td>
              <td>
                {order.customerName}
                <small>{order.customerPhone}</small>
              </td>
              <td>
                {order.address.townOrSubCounty}, {order.address.estateOrArea}
                <small>{order.address.landmark}</small>
              </td>
              <td>{order.items.map((item) => `${item.quantity}× ${item.productName}`).join(', ')}</td>
              <td>{currency(order.codAmountExpectedKes)}</td>
              <td>
                <Status value={order.status} />
              </td>
              <td className="action-cell">
                {can('order.verify') && order.status === 'PENDING_VERIFICATION' && (
                  <>
                    <button className="btn btn-secondary btn-sm" onClick={() => onVerify(order.id, true)}>
                      <Check size={14} /> Verify
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => onVerify(order.id, false)}>
                      <XCircle size={14} /> Reject
                    </button>
                  </>
                )}
                {can('order.cancel') && ['PENDING_VERIFICATION', 'READY_FOR_PICK'].includes(order.status) && (
                  <button className="btn btn-danger btn-sm" onClick={() => onCancel(order.id)}>
                    Cancel
                  </button>
                )}
                {can('inventory.pack') && order.status === 'PICKING' && (
                  <button className="btn btn-secondary btn-sm" onClick={() => onPack(order)}>
                    Pack
                  </button>
                )}
                {onSendNotification && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    title="Send SMS update to recipient"
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                    onClick={() => {
                      const msg = `Hello ${order.customerName}, your Ship It order #${order.orderNumber} status is ${order.status.replaceAll('_', ' ')}. Track at: https://shipit.co.ke/track?waybill=${encodeURIComponent(order.waybillNumber ?? order.orderNumber)}`;
                      void onSendNotification(order.customerPhone, 'SMS', msg, order.orderNumber);
                    }}
                  >
                    SMS
                  </button>
                )}
              </td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr>
              <td colSpan={7}>
                <Empty>No matching orders.</Empty>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

interface OrdersViewProps {
  orders: Order[];
  orderSearch: string;
  setOrderSearch: (value: string) => void;
  can: (permission: string) => boolean;
  onVerify: (id: string, confirmed: boolean) => void;
  onCancel: (id: string) => void;
  onPack: (order: Order) => void;
  onImportCsv: (file?: File) => void;
  onSendNotification?: (phone: string, channel: 'SMS' | 'WHATSAPP', message: string, orderNumber: string) => Promise<void>;
}

export function OrdersView({
  orders,
  orderSearch,
  setOrderSearch,
  can,
  onVerify,
  onCancel,
  onPack,
  onImportCsv,
  onSendNotification,
}: OrdersViewProps) {
  const pendingVerificationOrders = orders.filter((order) => order.status === 'PENDING_VERIFICATION');
  const filteredOrders = orders.filter((order) =>
    `${order.orderNumber} ${order.customerName} ${order.customerPhone} ${order.waybillNumber ?? ''}`
      .toLowerCase()
      .includes(orderSearch.toLowerCase()),
  );

  return (
    <>
      <Panel
        title="Order verification queue"
        subtitle="Only pending COD verification orders can be confirmed or cancelled."
      >
        <OrderTable
          orders={pendingVerificationOrders}
          can={can}
          onVerify={onVerify}
          onCancel={onCancel}
          onPack={onPack}
          onSendNotification={onSendNotification}
        />
      </Panel>

      <Panel
        title="All orders"
        action={
          <div className="search-input">
            <input
              placeholder="Search order, waybill or customer"
              value={orderSearch}
              onChange={(event) => setOrderSearch(event.target.value)}
            />
          </div>
        }
      >
        <OrderTable
          orders={filteredOrders}
          can={can}
          onVerify={onVerify}
          onCancel={onCancel}
          onPack={onPack}
        />
      </Panel>

      {can('order.create') && (
        <Panel
          title="Bulk CSV import"
          subtitle="Imports CSV order rows through the validated backend import service."
        >
          <label className="file-picker">
            <FileUp size={17} /> Select order CSV
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => onImportCsv(event.target.files?.[0])}
            />
          </label>
        </Panel>
      )}
    </>
  );
}
