import React, { useState } from 'react';
import { Clock, Compass, Globe2, MapPin, ShieldCheck, Truck } from 'lucide-react';

export function CoverageMap() {
  const [selectedRegion, setSelectedRegion] = useState<number>(0);

  const regions = [
    {
      name: 'Nairobi Metropolitan Express',
      transitTime: '3-4 Hours (Same Day)',
      hub: 'Central Industrial Area Hub',
      counties: ['Nairobi City', 'Kiambu (Ruiru, Thika, Ruaka)', 'Machakos (Athi River, Syokimau)', 'Kajiado (Kitengela, Rongai)'],
      description: 'Zoned motorbike couriers and express vans delivering across 48 sub-county clusters with real-time GPS telemetry.',
    },
    {
      name: 'Central & Mount Kenya',
      transitTime: 'Next-Day Morning (24H)',
      hub: 'Thika & Nyeri Highway Depots',
      counties: ["Nyeri", "Murang'a", "Kirinyaga", "Embu", "Meru", "Tharaka Nithi", "Laikipia (Nanyuki)"],
      description: 'Daily scheduled line-haul box trucks departing Nairobi at 7:00 PM for early morning delivery to retailers and doorsteps.',
    },
    {
      name: 'Rift Valley Highway',
      transitTime: 'Next-Day Morning (24H)',
      hub: 'Nakuru & Eldoret Transshipment Hubs',
      counties: ['Nakuru', 'Uasin Gishu (Eldoret)', 'Kericho', 'Bomet', 'Trans Nzoia (Kitale)', 'Nandi', 'Baringo', 'Narok'],
      description: 'High-velocity freight artery serving agricultural, commercial hardware, and FMCG wholesale channels.',
    },
    {
      name: 'Western & Lake Victoria Basin',
      transitTime: '24 - 36 Hours',
      hub: 'Kisumu City Logistics Depot',
      counties: ['Kisumu', 'Kakamega', 'Bungoma', 'Busia', 'Vihiga', 'Siaya', 'Homa Bay', 'Migori', 'Kisii', 'Nyamira'],
      description: 'Full coverage of Western Kenya trade centers with dedicated COD remittance and local rider dispatch.',
    },
    {
      name: 'Coastal Belt & Eastern Corridor',
      transitTime: '24 - 36 Hours',
      hub: 'Mombasa Port & Nyali Distribution Center',
      counties: ['Mombasa', 'Kilifi (Malindi)', 'Kwale (Diani)', 'Taita Taveta (Voi)', 'Machakos Town', 'Makueni', 'Kitui'],
      description: 'Daily coastal freight corridor connecting maritime container imports with regional distributors and hospitality businesses.',
    },
    {
      name: 'Cross-Border East Africa (EAC)',
      transitTime: '48 - 72 Hours',
      hub: 'Malaba, Busia & Namanga Border Terminals',
      counties: ['Uganda (Kampala, Jinja)', 'Tanzania (Arusha, Dar es Salaam)', 'Rwanda (Kigali)'],
      description: 'Bonded cross-border road transit with simplified COMESA trade customs documentation and transit escorts.',
    },
  ];

  const active = regions[selectedRegion];

  return (
    <section className="section-pad coverage-section" id="coverage">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow-badge">
            <Compass size={14} /> NATIONWIDE 47-COUNTY INFRASTRUCTURE
          </span>
          <h2 className="section-title">
            Countrywide Distribution Network <span className="text-blue">&amp; Cross-Border Reach.</span>
          </h2>
          <p className="section-sub">
            Whether dispatching emergency pharmaceuticals within Nairobi in 3 hours or transporting palletized
            FMCG goods to wholesale stockists in Eldoret or Mombasa, our physical distribution network has you covered.
          </p>
        </div>

        <div className="coverage-box-card">
          {/* Header Stats */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '2rem' }}>
            <div>
              <h3 style={{ fontSize: '1.45rem', color: 'var(--navy-deep)' }}>Regional Distribution Corridors</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
                Select a logistics corridor to inspect transit SLAs, sorting depots, and counties served.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.9rem', color: 'var(--text-dark)' }}>
                <Clock size={16} color="#059669" /> <strong>99.4%</strong> On-Time Delivery SLA
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.9rem', color: 'var(--text-dark)' }}>
                <MapPin size={16} color="#1d4ed8" /> <strong>47 Counties</strong> Across Kenya
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.9rem', color: 'var(--text-dark)' }}>
                <Globe2 size={16} color="#d97706" /> <strong>3 Regional Borders</strong> (UG, TZ, RW)
              </div>
            </div>
          </div>

          {/* Region Tabs */}
          <div style={{ display: 'flex', gap: '0.65rem', overflowX: 'auto', paddingBottom: '0.75rem', marginBottom: '1.75rem' }}>
            {regions.map((reg, idx) => (
              <button
                key={reg.name}
                type="button"
                onClick={() => setSelectedRegion(idx)}
                style={{
                  background: selectedRegion === idx ? 'var(--navy-deep)' : 'var(--bg-subtle)',
                  color: selectedRegion === idx ? '#ffffff' : 'var(--text-body)',
                  border: selectedRegion === idx ? '1px solid var(--navy-deep)' : '1px solid var(--border-light)',
                  padding: '0.65rem 1.15rem',
                  borderRadius: 'var(--radius-full)',
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                {reg.name}
              </button>
            ))}
          </div>

          {/* Active Region Detail Card */}
          <div
            style={{
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-lg)',
              padding: '2rem',
              display: 'grid',
              gridTemplateColumns: '1.2fr 0.8fr',
              gap: '2rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <h4 style={{ fontSize: '1.35rem', color: 'var(--navy-deep)' }}>{active.name}</h4>
                <span
                  style={{
                    background: 'var(--amber-light)',
                    color: 'var(--amber-dark)',
                    fontWeight: 800,
                    fontSize: '0.75rem',
                    padding: '0.2rem 0.6rem',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  {active.transitTime}
                </span>
              </div>
              <p style={{ color: 'var(--text-body)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                {active.description}
              </p>

              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 700 }}>
                COUNTIES &amp; DESTINATIONS COVERED:
              </div>
              <div className="county-tags-strip" style={{ marginTop: '0.25rem' }}>
                {active.counties.map((c) => (
                  <span className="county-tag hub" key={c}>
                    <MapPin size={12} /> {c}
                  </span>
                ))}
              </div>
            </div>

            <div
              style={{
                background: '#ffffff',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-md)',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>
                  Primary Regional Sorting Hub
                </span>
                <strong style={{ display: 'block', fontSize: '1.1rem', color: 'var(--navy-deep)', marginTop: '0.25rem' }}>
                  {active.hub}
                </strong>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  Equipped with high-speed barcode sorting, secure overnight holding cages, and dedicated cash-on-delivery deposit safes.
                </p>
              </div>

              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', color: 'var(--emerald-mpesa)', fontWeight: 700 }}>
                  <ShieldCheck size={16} /> Pay on Delivery (M-Pesa / Cash) Available
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
