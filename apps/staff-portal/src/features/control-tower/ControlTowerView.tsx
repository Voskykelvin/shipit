import React from 'react';
import type { SystemException } from '@shipit/shared-types';
import type { Summary } from '../../types';
import { currency } from '../../types';
import { Empty, Metric, Panel, Pipeline, Status } from '../../components/ui';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Package,
  RefreshCw,
  ShieldAlert,
  Truck,
} from 'lucide-react';

interface ControlTowerViewProps {
  summary: Summary | null;
  exceptions: SystemException[];
  busy: boolean;
  loadIssues: string[];
  userFirstName: string;
  userEmail: string;
  can: (permission: string) => boolean;
  onRefresh: () => void;
}

export function ControlTowerView({
  summary,
  exceptions,
  busy,
  loadIssues,
  userFirstName,
  userEmail,
  can,
  onRefresh,
}: ControlTowerViewProps) {
  const kpis = summary?.kpis;

  return (
    <>
      <div className="welcome-banner">
        <div>
          <span className="staff-eyebrow">LIVE OPERATIONS</span>
          <h2>
            Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, {userFirstName}
          </h2>
          <p>Control tower metrics and active exceptions from the production API.</p>
        </div>
        <button className="btn btn-secondary" onClick={onRefresh} disabled={busy}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      <div className="staff-kpi-grid">
        <Metric label="Orders today" value={kpis?.totalOrdersToday ?? '—'} icon={<ClipboardList />} />
        <Metric label="Pending verification" value={kpis?.pendingVerification ?? '—'} icon={<ShieldAlert />} />
        <Metric label="Ready to pick" value={kpis?.readyToPick ?? '—'} icon={<Package />} />
        <Metric label="Out for delivery" value={kpis?.outForDelivery ?? '—'} icon={<Truck />} />
        <Metric label="Delivered today" value={kpis?.delivered ?? '—'} icon={<CheckCircle2 />} />
        <Metric label="Open NDR cases" value={kpis?.ndrExceptions ?? '—'} icon={<AlertTriangle />} />
        <Metric label="COD collected" value={kpis ? currency(kpis.totalCodCollectedKes) : '—'} icon={<CircleDollarSign />} />
        <Metric label="Delivery success" value={kpis ? `${kpis.deliverySuccessRatePct}%` : '—'} icon={<Check />} />
      </div>

      {can('audit.view') && (
        <Panel
          title={`Active operational exceptions (${exceptions.length})`}
          subtitle="Exception data is read from inventory, delivery, finance and returns services."
        >
          {exceptions.length === 0 ? (
            <Empty>No active exceptions.</Empty>
          ) : (
            <div className="exception-list">
              {exceptions.map((item) => (
                <div className="exception-row" key={item.id}>
                  <div className="severity-icon">
                    <AlertTriangle size={17} />
                  </div>
                  <div className="exception-copy">
                    <strong>{item.title}</strong>
                    <p>{item.details}</p>
                    <small>
                      {item.category} · {new Date(item.createdAt).toLocaleString()}
                    </small>
                  </div>
                  <span className={`severity severity-${item.severity.toLowerCase()}`}>
                    {item.severity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      <div className="staff-two-col">
        <Panel title="Order pipeline">
          <Pipeline label="Verification" count={kpis?.pendingVerification ?? 0} color="amber" />
          <Pipeline label="Ready to pick" count={kpis?.readyToPick ?? 0} color="blue" />
          <Pipeline label="Packed" count={kpis?.packed ?? 0} color="cyan" />
          <Pipeline label="Out for delivery" count={kpis?.outForDelivery ?? 0} color="green" />
        </Panel>
        <Panel title="API health">
          <div className="health-row">
            <span>Client session</span>
            <Status value="AUTHENTICATED" />
          </div>
          <div className="health-row">
            <span>Data refresh</span>
            <strong>{busy ? 'In progress…' : loadIssues.length ? 'Partial' : 'Ready'}</strong>
          </div>
          <div className="health-row">
            <span>Authenticated user</span>
            <strong>{userEmail}</strong>
          </div>
        </Panel>
      </div>
    </>
  );
}
