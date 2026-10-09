import React from 'react';
import { Clock, Compass, MapPin } from 'lucide-react';

export function CoverageMap() {
  const zones = [
    {
      name: 'Nairobi Central & Commercial',
      code: 'NBO-ZONE-01',
      sla: '3-Hour Express & Same-Day',
      areas: 'CBD, Westlands, Kilimani, Upper Hill, Parklands, Kileleshwa, Lavington, Riverside, Ngara',
    },
    {
      name: 'Thika Road & Northern Artery',
      code: 'NBO-ZONE-02',
      sla: 'Same-Day Standard',
      areas: 'Roysambu, Kasarani, Ruiru, Garden City, Muthaiga, Kahawa Sukari, Kenyatta Road, Juja',
    },
    {
      name: 'Southern & Airport Corridor',
      code: 'NBO-ZONE-03',
      sla: 'Same-Day Standard',
      areas: 'Karen, Langata, South B, South C, Nairobi West, Imara Daima, Syokimau, Athi River',
    },
    {
      name: 'Eastlands & Outlying Towns',
      code: 'NBO-ZONE-04',
      sla: 'Same-Day Standard',
      areas: 'Donholm, Buruburu, Umoja, Komarock, Ruai, Kikuyu, Kiambu Town, Ruaka, Banana',
    },
    {
      name: 'Upcountry Hub Partner Forwarding',
      code: 'REGIONAL-KE',
      sla: 'Next-Day Delivery (24H)',
      areas: 'Mombasa, Kisumu, Nakuru, Eldoret, Nyeri, Meru, Machakos, Naivasha, Malindi',
    },
    {
      name: 'Temperature-Controlled Logistics',
      code: 'COLD-CHAIN',
      sla: 'Direct Insulated Dispatch',
      areas: 'Pharmaceuticals, premium skincare, organic cosmetics & temperature-sensitive consumables',
    },
  ];

  return (
    <section className="section" id="coverage">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">
            <Compass size={14} /> Full Geographic Network
          </div>
          <h2>
            Dense last-mile coverage across <span className="gradient-text">Greater Nairobi & beyond.</span>
          </h2>
          <p>
            Riders stationed across 4 zoned hubs ensure minimum travel time, direct landmark
            familiarity, and reliable Cash-on-Delivery collections.
          </p>
        </div>

        <div className="coverage-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3>Zoned Route Manifest Clusters</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Automated audio barcode scanning prevents riders from taking parcels outside their zone.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                <Clock size={15} color="#10b981" /> <strong>98.4%</strong> On-time delivery SLA
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                <MapPin size={15} color="#3b82f6" /> <strong>48</strong> Neighbourhood Hubs
              </div>
            </div>
          </div>

          <div className="coverage-grid">
            {zones.map((zone) => (
              <div className="zone-chip" key={zone.code}>
                <div className="zone-title">
                  <span>{zone.name}</span>
                  <span className="zone-sla">{zone.sla}</span>
                </div>
                <div className="zone-areas">{zone.areas}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
