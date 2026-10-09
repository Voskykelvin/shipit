import React from 'react';
import type { Order } from '@shipit/shared-types';
import { kes } from '../types';

export function Metric({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <section className="card metric-card">
      <div className="metric-icon">{icon}</div>
      <span className="metric-title">{label}</span>
      <strong className="metric-val">{value}</strong>
      <span className="metric-detail">{detail}</span>
    </section>
  );
}

export function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="portal-panel">
      <header className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="empty-state">{children}</div>;
}

export function Status({ value }: { value: string }) {
  return (
    <span className={`status-badge status-${value.toLowerCase()}`}>
      {value.replaceAll('_', ' ')}
    </span>
  );
}

export function OrderTable({
  orders,
  onLabel,
}: {
  orders: Order[];
  onLabel: (trackingNumber: string) => void;
}) {
  return (
    <div className="table-scroll">
      <table className="m-table">
        <thead>
          <tr>
            <th>Order / Waybill</th>
            <th>Customer</th>
            <th>Destination</th>
            <th>Items</th>
            <th>COD</th>
            <th>Status</th>
            <th>Created</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>
                <strong>{order.orderNumber}</strong>
                {order.waybillNumber && <small className="table-subline">{order.waybillNumber}</small>}
              </td>
              <td>
                {order.customerName}
                <small className="table-subline">{order.customerPhone}</small>
              </td>
              <td>
                {order.address.townOrSubCounty}, {order.address.county}
              </td>
              <td>{order.items.map((item) => `${item.quantity}× ${item.productName}`).join(', ')}</td>
              <td>{kes(order.codAmountExpectedKes)}</td>
              <td>
                <Status value={order.status} />
              </td>
              <td>{new Date(order.createdAt).toLocaleDateString()}</td>
              <td>
                {order.waybillNumber && (
                  <>
                    <a
                      className="text-button tracking-link"
                      href={`/track?waybill=${encodeURIComponent(order.waybillNumber)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Track
                    </a>
                    <button className="text-button" onClick={() => onLabel(order.waybillNumber!)}>
                      Label PDF
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr>
              <td colSpan={8}>
                <EmptyState>No orders found.</EmptyState>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
