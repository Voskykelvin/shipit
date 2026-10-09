import React, { useState } from 'react';
import type { DispatchManifest } from '@shipit/shared-types';
import type { ApiRider, RouteInfo } from '../../types';
import { currency } from '../../types';
import { Compass, MapPin, Navigation, ShieldCheck, Truck, Users } from 'lucide-react';

interface RouteMapProps {
  routes: RouteInfo[];
  manifests: DispatchManifest[];
  riders: ApiRider[];
  selectedRouteId: string;
  onSelectRoute: (routeId: string) => void;
}

interface MapZoneNode {
  id: string;
  code: string;
  name: string;
  cx: number;
  cy: number;
  radius: number;
  color: string;
}

const mapZoneNodes: MapZoneNode[] = [
  { id: '1', code: 'NBO-WESTLANDS-01', name: 'Westlands / Parklands', cx: 160, cy: 110, radius: 46, color: '#3b82f6' },
  { id: '2', code: 'NBO-CBD-01', name: 'Nairobi CBD / Upper Hill', cx: 280, cy: 170, radius: 42, color: '#10b981' },
  { id: '3', code: 'NBO-KILIMANI-02', name: 'Kilimani / Kileleshwa / Lavington', cx: 190, cy: 220, radius: 48, color: '#8b5cf6' },
  { id: '4', code: 'NBO-THIKA-RD-01', name: 'Thika Road / Kasarani / Roysambu', cx: 390, cy: 90, radius: 52, color: '#f59e0b' },
  { id: '5', code: 'NBO-SOUTHERN-01', name: 'Langata / Karen / South B / South C', cx: 260, cy: 310, radius: 56, color: '#ec4899' },
  { id: '6', code: 'NBO-EASTLANDS-01', name: 'Eastlands / Donholm / Airport Artery', cx: 420, cy: 230, radius: 50, color: '#06b6d4' },
];

export function RouteMap({
  routes,
  manifests,
  riders,
  selectedRouteId,
  onSelectRoute,
}: RouteMapProps) {
  const [hoveredZone, setHoveredZone] = useState<MapZoneNode | null>(null);

  return (
    <div className="route-map-container" style={{
      background: 'rgba(11, 15, 25, 0.95)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      padding: '1.5rem',
      marginBottom: '1.75rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem', fontWeight: 700 }}>
            <Compass size={17} color="#3b82f6" />
            <span>Interactive Nairobi Dispatch & Zone Radar</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Click any route sector to pre-filter waybill scan validation or review rider fleet allocation.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Truck size={14} color="#10b981" /> <strong>{manifests.length}</strong> Manifests
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Users size={14} color="#3b82f6" /> <strong>{riders.length}</strong> Registered Riders
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.4fr) 1fr', gap: '1.5rem', alignItems: 'center' }}>
        {/* Vector SVG Radar Map */}
        <div style={{
          background: 'radial-gradient(circle at center, #111a2e 0%, #080c16 80%)',
          border: '1px solid #1e293b',
          borderRadius: 'var(--radius-md)',
          padding: '1rem',
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
        }}>
          <svg viewBox="0 0 540 400" style={{ width: '100%', height: 'auto', maxHeight: '340px' }}>
            {/* Grid concentric rings */}
            <circle cx="280" cy="200" r="170" fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeDasharray="4 4" />
            <circle cx="280" cy="200" r="115" fill="none" stroke="rgba(255, 255, 255, 0.05)" />
            <circle cx="280" cy="200" r="60" fill="none" stroke="rgba(255, 255, 255, 0.07)" />

            {/* Crosshairs */}
            <line x1="280" y1="20" x2="280" y2="380" stroke="rgba(255, 255, 255, 0.04)" />
            <line x1="40" y1="200" x2="500" y2="200" stroke="rgba(255, 255, 255, 0.04)" />

            {/* Arterial Highway Connector Lines */}
            <line x1="280" y1="170" x2="160" y2="110" stroke="rgba(59, 130, 246, 0.25)" strokeWidth="2" strokeDasharray="3 3" />
            <line x1="280" y1="170" x2="190" y2="220" stroke="rgba(139, 92, 246, 0.25)" strokeWidth="2" strokeDasharray="3 3" />
            <line x1="280" y1="170" x2="390" y2="90" stroke="rgba(245, 158, 11, 0.25)" strokeWidth="2" strokeDasharray="3 3" />
            <line x1="280" y1="170" x2="260" y2="310" stroke="rgba(236, 72, 153, 0.25)" strokeWidth="2" strokeDasharray="3 3" />
            <line x1="280" y1="170" x2="420" y2="230" stroke="rgba(6, 182, 212, 0.25)" strokeWidth="2" strokeDasharray="3 3" />

            {/* Route Zone Nodes */}
            {mapZoneNodes.map((node) => {
              const matchedRoute = routes.find((r) => r.routeCode.includes(node.code.split('-')[1]) || r.routeCode === node.code);
              const isSelected = matchedRoute && matchedRoute.id === selectedRouteId;
              const isHovered = hoveredZone?.id === node.id;
              const manifestForZone = manifests.find((m) => m.routeCode === node.code || (matchedRoute && m.routeCode === matchedRoute.routeCode));

              return (
                <g
                  key={node.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    if (matchedRoute) onSelectRoute(matchedRoute.id);
                  }}
                  onMouseEnter={() => setHoveredZone(node)}
                  onMouseLeave={() => setHoveredZone(null)}
                >
                  {/* Outer pulse */}
                  <circle
                    cx={node.cx}
                    cy={node.cy}
                    r={node.radius + (isSelected ? 10 : isHovered ? 6 : 0)}
                    fill={node.color}
                    fillOpacity={isSelected ? 0.25 : isHovered ? 0.18 : 0.08}
                    stroke={node.color}
                    strokeWidth={isSelected ? 2.5 : 1}
                  />

                  {/* Node icon & center dot */}
                  <circle cx={node.cx} cy={node.cy} r="18" fill="#0f172a" stroke={node.color} strokeWidth="2" />
                  <circle cx={node.cx} cy={node.cy} r="6" fill={node.color} />

                  {/* Parcel Count Indicator Badge */}
                  {manifestForZone && manifestForZone.totalParcels > 0 && (
                    <g>
                      <rect
                        x={node.cx + 10}
                        y={node.cy - 22}
                        width="26"
                        height="18"
                        rx="9"
                        fill="#10b981"
                      />
                      <text
                        x={node.cx + 23}
                        y={node.cy - 10}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="10"
                        fontWeight="800"
                      >
                        {manifestForZone.totalParcels}
                      </text>
                    </g>
                  )}

                  {/* Label */}
                  <text
                    x={node.cx}
                    y={node.cy + 34}
                    textAnchor="middle"
                    fill={isSelected ? '#ffffff' : '#94a3b8'}
                    fontSize="11"
                    fontWeight={isSelected ? '800' : '600'}
                  >
                    {node.code}
                  </text>
                </g>
              );
            })}

            {/* Central Logistics Hub Waypoint */}
            <g>
              <rect x="250" y="190" width="60" height="20" rx="4" fill="#1e293b" stroke="#3b82f6" strokeWidth="1" />
              <text x="280" y="204" textAnchor="middle" fill="#60a5fa" fontSize="9" fontWeight="700">
                CENTRAL HUB
              </text>
            </g>
          </svg>
        </div>

        {/* Selected Zone Overview Box */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '0.06em' }}>
              Zone Manifest Status
            </span>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#60a5fa',
            }}>
              ACTIVE SECTOR
            </span>
          </div>

          <div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff' }}>
              {hoveredZone?.name ?? 'Select or Hover Sector'}
            </h4>
            <code style={{ fontSize: '0.8rem', color: '#93c5fd' }}>
              {hoveredZone?.code ?? 'NBO-HUB-CENTRAL'}
            </code>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>STAGED PARCELS</span>
              <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                {manifests.find((m) => m.routeCode === (hoveredZone?.code ?? ''))?.totalParcels ?? 0}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>EXPECTED COD</span>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#10b981' }}>
                {currency(manifests.find((m) => m.routeCode === (hoveredZone?.code ?? ''))?.expectedCodTotalKes ?? 0)}
              </div>
            </div>
          </div>

          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            <ShieldCheck size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '4px', color: '#38bdf8' }} />
            <strong>Dispatch Safety:</strong> Parcels scanned in the Dispatch Console are verified against these geographical zones. Out-of-zone waybills trigger an instant error buzzer.
          </div>
        </div>
      </div>
    </div>
  );
}
