import React from 'react';
import type { NDRCase, SystemException } from '@shipit/shared-types';
import { Empty, Panel, Status } from '../../components/ui';
import { MessageSquare, Phone, Send } from 'lucide-react';

interface ExceptionsViewProps {
  ndr: NDRCase[];
  exceptions: SystemException[];
  busy: boolean;
  can: (permission: string) => boolean;
  onResolveNdr: (event: React.FormEvent<HTMLFormElement>, record: NDRCase) => Promise<void>;
  onSendNotification?: (phone: string, channel: 'SMS' | 'WHATSAPP', message: string, orderNumber: string) => Promise<void>;
}

export function ExceptionsView({
  ndr,
  exceptions,
  busy,
  can,
  onResolveNdr,
  onSendNotification,
}: ExceptionsViewProps) {
  return (
    <>
      {can('ndr.view') && (
        <Panel
          title={`Non-delivery cases (${ndr.length})`}
          subtitle="Real-time NDR interception. Resolve while rider is in the delivery neighborhood."
        >
          {ndr.length === 0 ? (
            <Empty>No open NDR cases.</Empty>
          ) : (
            <div className="exception-list">
              {ndr.map((record) => {
                const cleanPhone = record.customerPhone.replace(/[^0-9]/g, '');
                const intlPhone = cleanPhone.startsWith('0')
                  ? `254${cleanPhone.slice(1)}`
                  : cleanPhone.startsWith('254')
                  ? cleanPhone
                  : `254${cleanPhone}`;
                const waUrl = `https://wa.me/${intlPhone}?text=Hello%20${encodeURIComponent(
                  record.customerName,
                )},%20Ship%20It%20courier%20is%20attempting%20to%20deliver%20order%20${encodeURIComponent(
                  record.orderNumber,
                )}.`;

                return (
                  <div className="ndr-card" key={record.id}>
                    <div>
                      <strong>
                        {record.orderNumber} · {record.customerName}
                      </strong>
                      <p>
                        {record.failureReason.replaceAll('_', ' ')} · {record.area} · Rider{' '}
                        {record.riderName}
                      </p>
                      <small>
                        {record.customerPhone} · {new Date(record.createdAt).toLocaleString()}
                      </small>
                      <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <a
                          href={`tel:${record.customerPhone}`}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.78rem' }}
                        >
                          <Phone size={12} /> Call Customer
                        </a>
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.78rem' }}
                        >
                          <MessageSquare size={12} /> WhatsApp Web
                        </a>
                        {onSendNotification && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.78rem' }}
                            disabled={busy}
                            onClick={() => {
                              const msg = `Hi ${record.customerName}, our Ship It courier attempted delivery for order #${record.orderNumber} but could not reach you (${record.failureReason.replaceAll('_', ' ')}). Please reply to reschedule.`;
                              void onSendNotification(record.customerPhone, 'SMS', msg, record.orderNumber);
                            }}
                          >
                            <Send size={12} /> Send SMS Alert
                          </button>
                        )}
                      </div>
                    </div>
                    {can('ndr.resolve') && (
                      <form
                        className="ndr-card"
                        onSubmit={(event) => void onResolveNdr(event, record)}
                      >
                        <select name="resolution">
                          <option value="RETRY">Retry delivery</option>
                          <option value="RTO">Return to origin</option>
                        </select>
                        <input
                          name="notes"
                          placeholder="Resolution notes"
                          minLength={3}
                          required
                        />
                        <button className="btn btn-primary btn-sm" disabled={busy}>
                          Resolve
                        </button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      )}

      {can('audit.view') && (
        <Panel
          title="All active exceptions"
          subtitle="This list is generated by inventory, delivery, finance and return services."
        >
          {exceptions.map((record) => (
            <div className="exception-row" key={record.id}>
              <div className="exception-copy">
                <strong>{record.title}</strong>
                <p>{record.details}</p>
                <small>
                  {record.category} · {record.entityType} ·{' '}
                  {new Date(record.createdAt).toLocaleString()}
                </small>
              </div>
              <Status value={record.severity} />
            </div>
          ))}
        </Panel>
      )}
    </>
  );
}
