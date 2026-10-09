import React from 'react';
import type { DispatchManifest } from '@shipit/shared-types';
import type { ApiRider, RouteInfo } from '../../types';
import { currency } from '../../types';
import { Panel, Status } from '../../components/ui';
import { Barcode, Plus } from 'lucide-react';
import { RouteMap } from './RouteMap';

interface DispatchViewProps {
  routes: RouteInfo[];
  riders: ApiRider[];
  manifests: DispatchManifest[];
  scanRouteId: string;
  setScanRouteId: (value: string) => void;
  scanManifestId: string;
  setScanManifestId: (value: string) => void;
  scanBarcode: string;
  setScanBarcode: (value: string) => void;
  busy: boolean;
  can: (permission: string) => boolean;
  onCreateManifest: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onScanParcel: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onHandover: (manifest: DispatchManifest) => Promise<void>;
}

export function DispatchView({
  routes,
  riders,
  manifests,
  scanRouteId,
  setScanRouteId,
  scanManifestId,
  setScanManifestId,
  scanBarcode,
  setScanBarcode,
  busy,
  can,
  onCreateManifest,
  onScanParcel,
  onHandover,
}: DispatchViewProps) {
  const stagedManifests = manifests.filter((manifest) => manifest.status === 'STAGED');

  return (
    <>
      <RouteMap
        routes={routes}
        manifests={manifests}
        riders={riders}
        selectedRouteId={scanRouteId}
        onSelectRoute={(routeId) => setScanRouteId(routeId)}
      />

      {can('dispatch.manifest') && (
        <Panel
          title="Create route manifest"
          subtitle="Create a staged manifest for one route and rider, then scan packed parcels into it."
        >
          <form className="staff-form form-row" onSubmit={(event) => void onCreateManifest(event)}>
            <label>
              Route
              <select name="routeId" required>
                {routes.map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.routeCode} · {route.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Rider
              <select name="riderId" required>
                {riders.map((rider) => (
                  <option key={rider.id} value={rider.id}>
                    {rider.name} · {rider.vehiclePlate}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn btn-primary">
              <Plus size={15} /> Create staged manifest
            </button>
          </form>
        </Panel>
      )}

      {can('dispatch.scan') && (
        <Panel
          title="Waybill route scan"
          subtitle="The backend blocks scans that do not match the selected route or manifest (with audio buzzer feedback)."
        >
          <form className="staff-form form-row" onSubmit={(event) => void onScanParcel(event)}>
            <label>
              Delivery route
              <select
                value={scanRouteId}
                onChange={(event) => setScanRouteId(event.target.value)}
                required
              >
                <option value="">Choose a route</option>
                {routes.map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.routeCode}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Staged manifest
              <select
                value={scanManifestId}
                onChange={(event) => setScanManifestId(event.target.value)}
              >
                <option value="">Route validation only</option>
                {stagedManifests.map((manifest) => (
                  <option key={manifest.id} value={manifest.id}>
                    {manifest.manifestNumber} · {manifest.routeCode}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Waybill / order barcode
              <input
                value={scanBarcode}
                onChange={(event) => setScanBarcode(event.target.value)}
                required
                autoComplete="off"
                placeholder="Scan or type barcode"
              />
            </label>
            <button className="btn btn-primary" disabled={busy}>
              <Barcode size={16} /> Validate scan
            </button>
          </form>
        </Panel>
      )}

      <Panel title="Dispatch manifests">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Manifest</th>
                <th>Route</th>
                <th>Rider</th>
                <th>Parcels</th>
                <th>Expected COD</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {manifests.map((manifest) => (
                <tr key={manifest.id}>
                  <td>
                    <code>{manifest.manifestNumber}</code>
                  </td>
                  <td>{manifest.routeCode}</td>
                  <td>{manifest.riderName}</td>
                  <td>{manifest.totalParcels}</td>
                  <td>{currency(manifest.expectedCodTotalKes)}</td>
                  <td>
                    <Status value={manifest.status} />
                  </td>
                  <td>
                    {can('dispatch.handover') &&
                      manifest.status === 'STAGED' &&
                      manifest.totalParcels > 0 && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => void onHandover(manifest)}
                        >
                          Confirm custody handover
                        </button>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
