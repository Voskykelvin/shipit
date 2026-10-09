import React, { useState, useEffect, useCallback } from 'react';
import { currency } from '../../types';
import { Panel, Status, Empty } from '../../components/ui';
import { audioCues } from '../../utils/audio';
import { Smartphone, CheckCircle, AlertTriangle, ArrowUpRight, ArrowDownLeft, RefreshCw } from 'lucide-react';

export interface MpesaTransaction {
  id: string;
  channel: 'MPESA_STK' | 'MPESA_C2B' | 'MPESA_B2C';
  direction: 'INBOUND' | 'OUTBOUND';
  status: string;
  receiptNumber: string;
  amountKes: number;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  merchantName: string;
  riderName: string;
  resultDesc?: string;
  timestamp: string;
}

export interface MpesaStats {
  stk: {
    totalRequests: number;
    succeeded: number;
    failed: number;
    pending: number;
    totalVolumeKes: number;
    successRatePercent: number;
  };
  c2b: {
    totalTransactions: number;
    totalVolumeKes: number;
  };
  b2c: {
    totalPayouts: number;
    succeeded: number;
    totalVolumeKes: number;
  };
  totalMobileMoneyVolumeKes: number;
}

interface MpesaConsoleProps {
  api: {
    request: <T>(path: string, options?: { method?: string; body?: unknown }) => Promise<T>;
  };
  busy: boolean;
  can: (permission: string) => boolean;
}

export function MpesaConsole({ api, busy: _busy, can }: MpesaConsoleProps) {
  const [stats, setStats] = useState<MpesaStats | null>(null);
  const [transactions, setTransactions] = useState<MpesaTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [channelFilter, setChannelFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Manual reconcile form
  const [orderNumber, setOrderNumber] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [amountKes, setAmountKes] = useState('');
  const [paymentChannel, setPaymentChannel] = useState<'MPESA_C2B' | 'MPESA_STK'>('MPESA_C2B');
  const [submittingReconcile, setSubmittingReconcile] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, txRes] = await Promise.all([
        api.request<MpesaStats>('/finance/mpesa/stats'),
        api.request<{ transactions: MpesaTransaction[] }>('/finance/mpesa/transactions'),
      ]);
      setStats(statsRes);
      setTransactions(txRes.transactions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not fetch M-Pesa data.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleManualReconcile(e: React.FormEvent) {
    e.preventDefault();
    if (!orderNumber || !receiptNumber || !amountKes) return;

    setSubmittingReconcile(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.request<{ success: boolean; message: string }>('/finance/mpesa/reconcile-query', {
        method: 'POST',
        body: {
          orderNumber: orderNumber.trim(),
          receiptNumber: receiptNumber.trim().toUpperCase(),
          amountKes: Number(amountKes),
          paymentChannel,
        },
      });

      audioCues.playSuccess();
      setSuccess(res.message);
      setOrderNumber('');
      setReceiptNumber('');
      setAmountKes('');
      await loadData();
    } catch (err) {
      audioCues.playError();
      setError(err instanceof Error ? err.message : 'Manual reconciliation failed.');
    } finally {
      setSubmittingReconcile(false);
    }
  }

  const filteredTransactions = transactions.filter((tx) => {
    if (channelFilter !== 'ALL' && tx.channel !== channelFilter) return false;
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'SUCCEEDED' && tx.status !== 'SUCCEEDED') return false;
      if (statusFilter === 'FAILED' && tx.status !== 'FAILED') return false;
      if (statusFilter === 'PENDING' && !['INITIATED', 'PENDING', 'ACCEPTED'].includes(tx.status)) return false;
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const match =
        tx.orderNumber.toLowerCase().includes(term) ||
        tx.receiptNumber.toLowerCase().includes(term) ||
        tx.customerPhone.toLowerCase().includes(term) ||
        tx.customerName.toLowerCase().includes(term);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="mpesa-console-container">
      {/* KPI Cards */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          <div style={{ background: 'var(--color-surface, #1e293b)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>
              <span>Total Mobile Money</span>
              <Smartphone size={16} color="#10b981" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#f8fafc' }}>
              {currency(stats.totalMobileMoneyVolumeKes)}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              STK Push + C2B Paybill
            </div>
          </div>

          <div style={{ background: 'var(--color-surface, #1e293b)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>
              <span>STK Push Volume</span>
              <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 600 }}>{stats.stk.successRatePercent}% Success</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#38bdf8' }}>
              {currency(stats.stk.totalVolumeKes)}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              {stats.stk.succeeded} successful of {stats.stk.totalRequests} prompts
            </div>
          </div>

          <div style={{ background: 'var(--color-surface, #1e293b)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>
              <span>C2B Paybill Inflows</span>
              <ArrowDownLeft size={16} color="#3b82f6" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#818cf8' }}>
              {currency(stats.c2b.totalVolumeKes)}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              {stats.c2b.totalTransactions} matched transactions
            </div>
          </div>

          <div style={{ background: 'var(--color-surface, #1e293b)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>
              <span>B2C Merchant Payouts</span>
              <ArrowUpRight size={16} color="#a855f7" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#c084fc' }}>
              {currency(stats.b2c.totalVolumeKes)}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              {stats.b2c.succeeded} disbursements executed
            </div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', color: '#fca5a5', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ padding: '12px 16px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', borderRadius: '8px', color: '#6ee7b7', marginBottom: '16px' }}>
          {success}
        </div>
      )}

      {/* Manual Force Reconcile Card */}
      {can('finance.reconcile') && (
        <Panel
          title="Manual M-Pesa Force Reconciliation"
          subtitle="Match orphaned C2B Paybill receipts or unconfirmed STK payments directly to an order with instant ledger credit."
        >
          <form className="staff-form form-row" onSubmit={(e) => void handleManualReconcile(e)}>
            <label>
              Order Number
              <input
                type="text"
                placeholder="e.g. ORD-98124"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                required
              />
            </label>
            <label>
              M-Pesa Receipt Number
              <input
                type="text"
                placeholder="e.g. SHG8912KLA"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                required
              />
            </label>
            <label>
              Amount (KES)
              <input
                type="number"
                placeholder="e.g. 3500"
                min="1"
                value={amountKes}
                onChange={(e) => setAmountKes(e.target.value)}
                required
              />
            </label>
            <label>
              Channel
              <select
                value={paymentChannel}
                onChange={(e) => setPaymentChannel(e.target.value as 'MPESA_C2B' | 'MPESA_STK')}
              >
                <option value="MPESA_C2B">M-Pesa C2B Paybill</option>
                <option value="MPESA_STK">M-Pesa STK Push</option>
              </select>
            </label>
            <button
              className="btn btn-primary"
              style={{ alignSelf: 'flex-end', height: '40px' }}
              disabled={submittingReconcile}
            >
              {submittingReconcile ? 'Matching…' : 'Match & Credit'}
            </button>
          </form>
        </Panel>
      )}

      {/* Live Transaction Stream */}
      <Panel
        title="Live M-Pesa Transaction Activity"
        subtitle="Chronological stream of STK push prompts, C2B Paybill deposits, and automated B2C settlement disbursements."
      >
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search receipt, order, phone, customer…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ minWidth: '260px', flex: 1, padding: '8px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }}
          />

          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }}
          >
            <option value="ALL">All Channels</option>
            <option value="MPESA_STK">STK Push</option>
            <option value="MPESA_C2B">C2B Paybill</option>
            <option value="MPESA_B2C">B2C Payout</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="SUCCEEDED">Succeeded</option>
            <option value="PENDING">Pending / Initiated</option>
            <option value="FAILED">Failed</option>
          </select>

          <button
            className="icon-button"
            onClick={() => void loadData()}
            disabled={loading}
            title="Refresh M-Pesa records"
          >
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Channel</th>
                <th>Receipt / Ref</th>
                <th>Order / Settlement</th>
                <th>Party & Phone</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((tx) => (
                <tr key={`${tx.id}-${tx.receiptNumber}`}>
                  <td>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background:
                          tx.channel === 'MPESA_STK'
                            ? 'rgba(56, 189, 248, 0.15)'
                            : tx.channel === 'MPESA_C2B'
                              ? 'rgba(129, 140, 248, 0.15)'
                              : 'rgba(192, 132, 252, 0.15)',
                        color:
                          tx.channel === 'MPESA_STK'
                            ? '#38bdf8'
                            : tx.channel === 'MPESA_C2B'
                              ? '#818cf8'
                              : '#c084fc',
                      }}
                    >
                      {tx.direction === 'INBOUND' ? <ArrowDownLeft size={11} /> : <ArrowUpRight size={11} />}
                      {tx.channel === 'MPESA_STK' ? 'STK PUSH' : tx.channel === 'MPESA_C2B' ? 'C2B PAYBILL' : 'B2C PAYOUT'}
                    </span>
                  </td>
                  <td>
                    <code style={{ fontSize: '12px' }}>{tx.receiptNumber}</code>
                    {tx.resultDesc && <small style={{ display: 'block', color: '#94a3b8', fontSize: '11px' }}>{tx.resultDesc}</small>}
                  </td>
                  <td>
                    <strong>{tx.orderNumber}</strong>
                    <small style={{ display: 'block', color: '#64748b' }}>{tx.merchantName}</small>
                  </td>
                  <td>
                    {tx.customerName}
                    <small style={{ display: 'block', color: '#38bdf8' }}>{tx.customerPhone}</small>
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    {currency(tx.amountKes)}
                  </td>
                  <td>
                    <Status value={tx.status} />
                  </td>
                  <td style={{ fontSize: '12px', color: '#94a3b8' }}>
                    {new Date(tx.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <Empty>No M-Pesa transactions found matching the filter.</Empty>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
