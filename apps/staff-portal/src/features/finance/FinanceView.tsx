import React, { useState } from 'react';
import type { MerchantLedgerEntry, MerchantSettlement, RiderShiftReconciliation } from '@shipit/shared-types';
import type { ApiRider, Merchant } from '../../types';
import { currency, today } from '../../types';
import { Panel, RecordsTable, Status } from '../../components/ui';
import { MpesaConsole } from './MpesaConsole';
import { Smartphone, FileText, Truck } from 'lucide-react';

interface FinanceViewProps {
  shifts: RiderShiftReconciliation[];
  settlements: MerchantSettlement[];
  ledgers: MerchantLedgerEntry[];
  merchants: Merchant[];
  riders: ApiRider[];
  busy: boolean;
  can: (permission: string) => boolean;
  api: {
    request: <T>(path: string, options?: { method?: string; body?: unknown }) => Promise<T>;
  };
  onCloseShift: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onApproveShiftVariance: (event: React.FormEvent<HTMLFormElement>, shiftId: string) => Promise<void>;
  onCreateSettlement: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onApproveSettlement: (settlementId: string) => Promise<void>;
  onDisburseMpesaB2C: (settlementId: string) => Promise<void>;
  onMarkSettlementPaid: (settlementId: string, reference: string) => Promise<void>;
}

export function FinanceView({
  shifts,
  settlements,
  ledgers,
  merchants,
  riders,
  busy,
  can,
  api,
  onCloseShift,
  onApproveShiftVariance,
  onCreateSettlement,
  onApproveSettlement,
  onDisburseMpesaB2C,
  onMarkSettlementPaid,
}: FinanceViewProps) {
  const [subTab, setSubTab] = useState<'mpesa' | 'settlements' | 'shifts'>('mpesa');

  return (
    <>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '14px' }}>
        <button
          type="button"
          className={`btn ${subTab === 'mpesa' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setSubTab('mpesa')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Smartphone size={15} /> M-Pesa Operator Console
        </button>
        <button
          type="button"
          className={`btn ${subTab === 'settlements' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setSubTab('settlements')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <FileText size={15} /> Settlements & Ledgers
        </button>
        <button
          type="button"
          className={`btn ${subTab === 'shifts' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setSubTab('shifts')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Truck size={15} /> Rider Shifts Reconcile
        </button>
      </div>

      {subTab === 'mpesa' && (
        <MpesaConsole api={api} busy={busy} can={can} />
      )}

      {subTab === 'shifts' && (
        <>
          {can('finance.reconcile') && (
            <Panel
              title="Rider shift closeout"
              subtitle="Cash variances remain locked unless an operations manager or super admin approves with an audit reason."
            >
              <form className="staff-form form-row" onSubmit={(event) => void onCloseShift(event)}>
                <label>
                  Rider
                  <select name="riderId" required>
                    {riders.map((rider) => (
                      <option key={rider.id} value={rider.id}>
                        {rider.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Shift date
                  <input type="date" name="shiftDate" defaultValue={today()} required />
                </label>
                <label>
                  Cash handed in (KES)
                  <input type="number" name="cashHandedInKes" min="0" required />
                </label>
                <label>
                  Variance reason
                  <input name="varianceNotes" />
                </label>
                <button className="btn btn-primary" disabled={busy}>Submit closeout</button>
              </form>
            </Panel>
          )}

          {(can('finance.reconcile') || can('finance.variance.approve')) && (
            <Panel title="Rider reconciliation">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Rider</th>
                      <th>Expected COD</th>
                      <th>M-Pesa</th>
                      <th>Cash expected</th>
                      <th>Cash handed in</th>
                      <th>Variance</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.map((shift) => (
                      <tr key={shift.id}>
                        <td>{shift.shiftDate}</td>
                        <td>{shift.riderName}</td>
                        <td>{currency(shift.expectedCodKes)}</td>
                        <td>{currency(shift.mpesaCollectedKes)}</td>
                        <td>{currency(shift.expectedCashKes)}</td>
                        <td>{currency(shift.cashHandedInKes)}</td>
                        <td className={shift.varianceKes === 0 ? '' : 'negative'}>
                          {currency(shift.varianceKes)}
                          {shift.varianceNotes && <small>{shift.varianceNotes}</small>}
                        </td>
                        <td>
                          <Status value={shift.isReconciled ? 'RECONCILED' : 'REQUIRES APPROVAL'} />
                        </td>
                        <td>
                          {!shift.isReconciled &&
                            shift.varianceKes !== 0 &&
                            can('finance.variance.approve') && (
                              <form
                                className="staff-form"
                                onSubmit={(event) => void onApproveShiftVariance(event, shift.id)}
                              >
                                <label>
                                  Approval reason
                                  <input
                                    name="approvalNotes"
                                    minLength={3}
                                    maxLength={1000}
                                    required
                                  />
                                </label>
                                <button className="btn btn-secondary btn-sm" disabled={busy}>
                                  Approve & close
                                </button>
                              </form>
                            )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </>
      )}

      {subTab === 'settlements' && (
        <>
          {can('settlement.create') && (
            <Panel title="Create settlement">
              <form className="staff-form form-row" onSubmit={(event) => void onCreateSettlement(event)}>
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
                  Period start
                  <input name="periodStart" type="date" required />
                </label>
                <label>
                  Period end
                  <input name="periodEnd" type="date" required />
                </label>
                <button className="btn btn-primary" disabled={busy}>Draft settlement</button>
              </form>
            </Panel>
          )}

          {can('finance.view') && (
            <Panel title="Settlement approvals & disbursements">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Settlement</th>
                      <th>Merchant</th>
                      <th>Gross COD</th>
                      <th>Fees</th>
                      <th>Net payout</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlements.map((settlement) => (
                      <tr key={settlement.id}>
                        <td>
                          <code>{settlement.settlementNumber}</code>
                        </td>
                        <td>
                          {merchants.find((merchant) => merchant.id === settlement.merchantId)?.name ??
                            settlement.merchantId}
                        </td>
                        <td>{currency(settlement.grossCodCollectedKes)}</td>
                        <td>{currency(settlement.totalFeesDeductedKes)}</td>
                        <td>{currency(settlement.netPayoutKes)}</td>
                        <td>
                          <Status value={settlement.status} />
                        </td>
                        <td className="action-cell">
                          {can('settlement.approve') && settlement.status === 'DRAFT' && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => void onApproveSettlement(settlement.id)}
                            >
                              Approve
                            </button>
                          )}
                          {can('settlement.disburse') && settlement.status === 'APPROVED' && (
                            <>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => void onDisburseMpesaB2C(settlement.id)}
                              >
                                M-Pesa B2C
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  const reference = window.prompt('Enter payout reference');
                                  if (reference) void onMarkSettlementPaid(settlement.id, reference);
                                }}
                              >
                                Mark paid
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {can('finance.view') && (
            <Panel title="Merchant financial ledger">
              <RecordsTable
                records={ledgers.slice(0, 50) as unknown as Array<Record<string, unknown>>}
              />
            </Panel>
          )}
        </>
      )}
    </>
  );
}
