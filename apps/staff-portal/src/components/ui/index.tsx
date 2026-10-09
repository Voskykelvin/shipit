import React from 'react';

export function Alert({ variant, children }: { variant: 'error' | 'success' | 'warning'; children: React.ReactNode }) {
  return <div className={`staff-alert ${variant}`} role="status">{children}</div>;
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
    <section className="staff-panel">
      <header className="panel-header">
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

export function Metric({ label, value, icon }: { label: string; value: React.ReactNode; icon: React.ReactNode }) {
  return (
    <section className="staff-metric">
      <div className="metric-top">
        <span>{label}</span>
        {icon}
      </div>
      <strong>{value}</strong>
    </section>
  );
}

export function Pipeline({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="pipeline-row">
      <span className={`pipeline-dot ${color}`} />
      <span>{label}</span>
      <strong>{count}</strong>
    </div>
  );
}

export function Status({ value }: { value: string }) {
  const tone = /FAILED|CANCEL|RTO|NOT_READY|HIGH/i.test(value)
    ? 'danger'
    : /PENDING|DRAFT|EXPECTED|WARNING|IN_PROGRESS/i.test(value)
    ? 'warning'
    : /DELIVER|ACTIVE|COMPLETED|RECONCILED|PICKED|AVAILABLE|AUTHENTICATED/i.test(value)
    ? 'success'
    : 'neutral';
  return <span className={`staff-status ${tone}`}>{value.replaceAll('_', ' ')}</span>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="staff-empty">{children}</div>;
}

export function RecordsTable({ records }: { records: Array<Record<string, unknown>> }) {
  if (!records.length) return <Empty>No ledger records.</Empty>;
  const columns = Object.keys(records[0]);
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((record, index) => (
            <tr key={String(record.id ?? index)}>
              {columns.map((column) => (
                <td key={column}>
                  {record[column] instanceof Object ? JSON.stringify(record[column]) : String(record[column] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
