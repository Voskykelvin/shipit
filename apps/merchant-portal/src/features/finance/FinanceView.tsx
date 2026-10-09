import React from 'react';
import type { MerchantData } from '../../types';
import { kes } from '../../types';
import { Panel, Status } from '../../components/ui';

interface FinanceViewProps {
  data: MerchantData;
  busy: boolean;
  onCreateSettlement: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
}

export function FinanceView({ data, busy, onCreateSettlement }: FinanceViewProps) {
  return (
    <>
      <Panel
        title="Request a merchant settlement"
        subtitle="A settlement includes eligible reconciled ledger entries within this date range."
      >
        <form
          className="portal-form inline-form"
          onSubmit={(event) => void onCreateSettlement(event)}
        >
          <label>
            Period start
            <input name="periodStart" type="date" required />
          </label>
          <label>
            Period end
            <input name="periodEnd" type="date" required />
          </label>
          <button className="btn-emerald" disabled={busy}>
            Request settlement
          </button>
        </form>
      </Panel>

      <Panel title="Settlement history">
        <div className="table-scroll">
          <table className="m-table">
            <thead>
              <tr>
                <th>Settlement</th>
                <th>Created</th>
                <th>Gross COD</th>
                <th>Fees</th>
                <th>Net payout</th>
                <th>Status</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {data.settlements.map((settlement) => (
                <tr key={settlement.id}>
                  <td>
                    <code className="code-pill">{settlement.settlementNumber}</code>
                  </td>
                  <td>{new Date(settlement.createdAt).toLocaleDateString()}</td>
                  <td>{kes(settlement.grossCodCollectedKes)}</td>
                  <td>{kes(settlement.totalFeesDeductedKes)}</td>
                  <td>
                    <strong>{kes(settlement.netPayoutKes)}</strong>
                  </td>
                  <td>
                    <Status value={settlement.status} />
                  </td>
                  <td>{settlement.payoutReference ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        title="Merchant ledger"
        subtitle="Append-only transactions for COD credits, fees, returns and settlement payouts."
      >
        <div className="table-scroll">
          <table className="m-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Description</th>
                <th>Order</th>
                <th>Amount</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {data.ledgers.map((entry) => (
                <tr key={entry.id}>
                  <td>{new Date(entry.createdAt).toLocaleString()}</td>
                  <td>{entry.type}</td>
                  <td>{entry.description}</td>
                  <td>{entry.orderId ?? '—'}</td>
                  <td
                    className={
                      entry.amountKes >= 0 ? 'amount-positive' : 'amount-negative'
                    }
                  >
                    {kes(entry.amountKes)}
                  </td>
                  <td>{kes(entry.runningBalanceKes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
