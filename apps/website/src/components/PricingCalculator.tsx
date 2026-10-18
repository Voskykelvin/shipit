import React, { useState } from 'react';
import { Calculator, CheckCircle2, ShieldCheck, TrendingUp, Truck } from 'lucide-react';

interface PricingCalculatorProps {
  onOpenLeadModal: (orders: number) => void;
}

export function PricingCalculator({ onOpenLeadModal }: PricingCalculatorProps) {
  const [ordersPerMonth, setOrdersPerMonth] = useState(500);
  const [palletsStored, setPalletsStored] = useState(8);
  const [destMix, setDestMix] = useState<'nairobi-only' | 'hybrid' | 'countrywide'>('hybrid');
  const [addDedicatedRider, setAddDedicatedRider] = useState(false);
  const [addDedicatedTruck, setAddDedicatedTruck] = useState(false);

  // Pallet storage rate: KES 2,200 per standard pallet position/month
  const palletStorageCost = palletsStored * 2200;

  // Pick, pack and thermal labeling: KES 45 per order
  const pickAndPackPerOrder = 45;

  // Average delivery rate depending on geographic mix:
  // Nairobi only: KES 250
  // Hybrid (70% Nairobi / 30% Upcountry): KES 310
  // Countrywide (50% Nairobi / 50% Upcountry): KES 350
  const deliveryBaseRate =
    destMix === 'nairobi-only' ? 250 : destMix === 'hybrid' ? 310 : 350;

  const totalPerOrderFee = pickAndPackPerOrder + deliveryBaseRate;
  const variableFulfillmentCost = ordersPerMonth * totalPerOrderFee;

  // Optional dedicated fleet hire
  const dedicatedRiderFee = addDedicatedRider ? 45000 : 0;
  const dedicatedTruckFee = addDedicatedTruck ? 135000 : 0;
  const fleetOutsourceFee = dedicatedRiderFee + dedicatedTruckFee;

  const totalMonthlyCost = palletStorageCost + variableFulfillmentCost + fleetOutsourceFee;
  const effectiveCostPerOrder = Math.round(totalMonthlyCost / ordersPerMonth);
  const laborHoursSaved = Math.round(ordersPerMonth * 0.45 + palletsStored * 2);

  return (
    <section className="section-pad calc-section" id="calculator">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow-badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--amber-safety)' }}>
            <Calculator size={14} /> TRANSPARENT 3PL &amp; COURIER TARIFFS
          </span>
          <h2 className="section-title">
            Calculate Your Monthly <span style={{ color: 'var(--amber-safety)' }}>Logistics Investment.</span>
          </h2>
          <p className="section-sub">
            Use this planning estimate to describe your expected volume and service mix. Final pricing, coverage,
            and service levels are confirmed in your written proposal.
          </p>
        </div>

        <div className="calc-container-card">
          {/* Inputs Column */}
          <div className="calc-inputs-pane">
            {/* Slider 1: Monthly Shipments */}
            <div className="calc-slider-block">
              <div className="slider-label-row">
                <label>Monthly Consignment / Parcel Volume</label>
                <span className="slider-val-tag">{ordersPerMonth.toLocaleString()} Shipments</span>
              </div>
              <input
                type="range"
                className="custom-range"
                min="100"
                max="8000"
                step="100"
                value={ordersPerMonth}
                onChange={(e) => setOrdersPerMonth(Number(e.target.value))}
              />
            </div>

            {/* Slider 2: Pallet Storage */}
            <div className="calc-slider-block">
              <div className="slider-label-row">
                <label>High-Bay Pallet Racking Positions Required</label>
                <span className="slider-val-tag">{palletsStored} Pallet Bays (~{palletsStored * 48} Cartons)</span>
              </div>
              <input
                type="range"
                className="custom-range"
                min="0"
                max="100"
                step="1"
                value={palletsStored}
                onChange={(e) => setPalletsStored(Number(e.target.value))}
              />
            </div>

            {/* Geographic Distribution Mix */}
            <div style={{ marginTop: '1.75rem' }}>
              <label style={{ fontSize: '0.92rem', fontWeight: 600, color: '#e2e8f0', display: 'block', marginBottom: '0.65rem' }}>
                Geographic Delivery Mix
              </label>
              <div className="calc-toggles-grid">
                <button
                  type="button"
                  className={`calc-toggle-btn ${destMix === 'nairobi-only' ? 'selected' : ''}`}
                  onClick={() => setDestMix('nairobi-only')}
                >
                  <strong>Intra-Nairobi Only</strong>
                  <span>Same-day 3-4 hr express</span>
                </button>
                <button
                  type="button"
                  className={`calc-toggle-btn ${destMix === 'hybrid' ? 'selected' : ''}`}
                  onClick={() => setDestMix('hybrid')}
                >
                  <strong>70% Nairobi / 30% Upcountry</strong>
                  <span>Standard Kenyan distributor mix</span>
                </button>
              </div>
            </div>

            {/* Fleet Outsourcing Add-Ons */}
            <div style={{ marginTop: '1.75rem' }}>
              <label style={{ fontSize: '0.92rem', fontWeight: 600, color: '#e2e8f0', display: 'block', marginBottom: '0.65rem' }}>
                Dedicated Fleet Hire (Optional Add-On)
              </label>
              <div className="calc-toggles-grid">
                <button
                  type="button"
                  className={`calc-toggle-btn ${addDedicatedRider ? 'selected' : ''}`}
                  onClick={() => setAddDedicatedRider(!addDedicatedRider)}
                >
                  <strong>Dedicated Motorcycle (+KES 45K)</strong>
                  <span>Includes rider, fuel &amp; maintenance</span>
                </button>
                <button
                  type="button"
                  className={`calc-toggle-btn ${addDedicatedTruck ? 'selected' : ''}`}
                  onClick={() => setAddDedicatedTruck(!addDedicatedTruck)}
                >
                  <strong>Dedicated 3-Tonne Truck (+KES 135K)</strong>
                  <span>Includes driver, turnboy &amp; fuel</span>
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.86rem', color: '#cbd5e1' }}>
                <CheckCircle2 size={16} color="#34d399" /> Use as an indicative planning estimate, not a binding quote
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.86rem', color: '#cbd5e1' }}>
                <CheckCircle2 size={16} color="#34d399" /> Barcoded wave pick, pack &amp; 4x6 thermal waybills included
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.86rem', color: '#cbd5e1' }}>
                <CheckCircle2 size={16} color="#34d399" /> COD collection and settlement options can be scoped in your proposal
              </div>
            </div>
          </div>

          {/* Summary / Result Pane */}
          <div className="calc-summary-pane">
            <div>
              <span className="summary-headline">Estimated Monthly Logistics Tariff</span>
              <div className="summary-grand-total">KES {totalMonthlyCost.toLocaleString()}</div>
              <div className="summary-sub-tag">
                ~KES {effectiveCostPerOrder.toLocaleString()} per consignment all-inclusive
              </div>

              <div className="line-items-table">
                <div className="line-item-row">
                  <span>Pallet Storage ({palletsStored} bays):</span>
                  <strong>KES {palletStorageCost.toLocaleString()}</strong>
                </div>
                <div className="line-item-row">
                  <span>Pick, Pack &amp; Labeling ({ordersPerMonth} pkgs):</span>
                  <strong>KES {(ordersPerMonth * pickAndPackPerOrder).toLocaleString()}</strong>
                </div>
                <div className="line-item-row">
                  <span>Distribution ({destMix.replace('-', ' ')}):</span>
                  <strong>KES {(ordersPerMonth * deliveryBaseRate).toLocaleString()}</strong>
                </div>
                {fleetOutsourceFee > 0 && (
                  <div className="line-item-row" style={{ color: 'var(--amber-safety)' }}>
                    <span>Dedicated Fleet Outsourcing:</span>
                    <strong>KES {fleetOutsourceFee.toLocaleString()}</strong>
                  </div>
                )}
                <div className="line-item-row" style={{ color: '#34d399' }}>
                  <span>Distributor Labor Saved:</span>
                  <strong>~{laborHoursSaved} man-hours/mo</strong>
                </div>
              </div>
            </div>

            <button
              className="btn btn-amber btn-lg"
              style={{ width: '100%' }}
              onClick={() => onOpenLeadModal(ordersPerMonth)}
            >
              Request Custom Enterprise Contract Rate Card
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
