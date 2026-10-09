import React, { useState } from 'react';
import { Calculator, CheckCircle2, TrendingUp } from 'lucide-react';

interface PricingCalculatorProps {
  onOpenLeadModal: (orders: number) => void;
}

export function PricingCalculator({ onOpenLeadModal }: PricingCalculatorProps) {
  const [ordersPerMonth, setOrdersPerMonth] = useState(350);
  const [storageCubicMeters, setStorageCubicMeters] = useState(4);
  const [avgWeightKg, setAvgWeightKg] = useState(1.5);

  // Rate logic
  const storageCost = storageCubicMeters * 1800;
  const pickAndPackPerOrder = 45;
  const baseDeliveryPerOrder = 250;
  const weightSurchargePerOrder = avgWeightKg > 2 ? Math.ceil(avgWeightKg - 2) * 35 : 0;
  const deliveryCostPerOrder = baseDeliveryPerOrder + weightSurchargePerOrder;
  const totalPerOrderFee = pickAndPackPerOrder + deliveryCostPerOrder;

  const totalMonthlyCost = storageCost + ordersPerMonth * totalPerOrderFee;
  const costPerDeliveredParcel = Math.round(totalMonthlyCost / ordersPerMonth);
  const hoursSavedPerMonth = Math.round(ordersPerMonth * 0.45);

  return (
    <section className="section" id="pricing">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">
            <Calculator size={14} /> Transparent Fulfillment Economics
          </div>
          <h2>
            Calculate your <span className="gradient-text">exact monthly fulfillment cost.</span>
          </h2>
          <p>
            No hidden handling charges or setup fees. Transparent rates covering storage, pick & pack,
            thermal labeling, and same-day delivery across Nairobi.
          </p>
        </div>

        <div className="calculator-card">
          <div className="calc-controls">
            <div className="slider-group">
              <label>
                Monthly Order Volume
                <span>{ordersPerMonth.toLocaleString()} orders</span>
              </label>
              <input
                type="range"
                className="calc-slider"
                min="50"
                max="5000"
                step="50"
                value={ordersPerMonth}
                onChange={(event) => setOrdersPerMonth(Number(event.target.value))}
              />
            </div>

            <div className="slider-group">
              <label>
                Dedicated Storage Footprint
                <span>{storageCubicMeters} m³ (~{storageCubicMeters * 12} shelves)</span>
              </label>
              <input
                type="range"
                className="calc-slider"
                min="1"
                max="30"
                step="1"
                value={storageCubicMeters}
                onChange={(event) => setStorageCubicMeters(Number(event.target.value))}
              />
            </div>

            <div className="slider-group">
              <label>
                Average Parcel Weight
                <span>{avgWeightKg.toFixed(1)} kg</span>
              </label>
              <input
                type="range"
                className="calc-slider"
                min="0.5"
                max="10"
                step="0.5"
                value={avgWeightKg}
                onChange={(event) => setAvgWeightKg(Number(event.target.value))}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                <CheckCircle2 size={16} color="#10b981" /> Includes warehouse receiving & barcoded putaway
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                <CheckCircle2 size={16} color="#10b981" /> 4x6 Thermal waybills & packing security seals included
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                <CheckCircle2 size={16} color="#10b981" /> Automated M-Pesa STK Push clearing with zero cash variance
              </div>
            </div>
          </div>

          <div className="calc-result-box">
            <span className="result-label">Estimated Monthly Fulfillment</span>
            <div className="result-price">
              KES {totalMonthlyCost.toLocaleString()}
            </div>
            <div className="result-sub">
              ~KES {costPerDeliveredParcel.toLocaleString()} per order all-inclusive
            </div>

            <div className="calc-breakdown">
              <div className="calc-breakdown-row">
                <span>Warehouse Storage ({storageCubicMeters} m³):</span>
                <strong>KES {storageCost.toLocaleString()}</strong>
              </div>
              <div className="calc-breakdown-row">
                <span>Pick, Pack & Labeling ({ordersPerMonth} orders):</span>
                <strong>KES {(ordersPerMonth * pickAndPackPerOrder).toLocaleString()}</strong>
              </div>
              <div className="calc-breakdown-row">
                <span>Last-Mile Same-Day Delivery:</span>
                <strong>KES {(ordersPerMonth * deliveryCostPerOrder).toLocaleString()}</strong>
              </div>
              <div className="calc-breakdown-row" style={{ color: '#34d399' }}>
                <span>Operations Labor Saved:</span>
                <strong>~{hoursSavedPerMonth} hours/mo</strong>
              </div>
            </div>

            <button
              className="btn btn-emerald"
              style={{ width: '100%' }}
              onClick={() => onOpenLeadModal(ordersPerMonth)}
            >
              Lock In This Rate Card
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
