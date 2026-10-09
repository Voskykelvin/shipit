import React from 'react';
import type { ApiRider, Merchant, Product } from '../../types';
import { currency } from '../../types';
import { Panel, Status } from '../../components/ui';
import { Users } from 'lucide-react';

interface SetupViewProps {
  merchants: Merchant[];
  products: Product[];
  can: (permission: string) => boolean;
  onCreateMerchant: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onCreateProduct: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onActivateMerchant: (merchantId: string) => Promise<void>;
  onAddMerchantUser: (event: React.FormEvent<HTMLFormElement>, merchantId: string) => Promise<void>;
  onCreateRider: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
}

export function SetupView({
  merchants,
  products,
  can,
  onCreateMerchant,
  onCreateProduct,
  onActivateMerchant,
  onAddMerchantUser,
  onCreateRider,
}: SetupViewProps) {
  const activeMerchants = merchants.filter((m) => m.status === 'ACTIVE');

  return (
    <>
      <div className="staff-two-col">
        {can('merchant.manage') && (
          <Panel title="Onboard merchant">
            <form className="staff-form" onSubmit={(event) => void onCreateMerchant(event)}>
              <label>
                Merchant code
                <input name="code" required />
              </label>
              <label>
                Business name
                <input name="name" required />
              </label>
              <label>
                Contact email
                <input name="contactEmail" type="email" required />
              </label>
              <label>
                Contact phone
                <input name="contactPhone" type="tel" required placeholder="0712345678" />
              </label>
              <button className="btn btn-primary">Create merchant</button>
            </form>
          </Panel>
        )}

        {can('product.manage') && can('merchant.manage') && (
          <Panel title="Add catalog product">
            <form className="staff-form" onSubmit={(event) => void onCreateProduct(event)}>
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
                SKU
                <input name="sku" required />
              </label>
              <label>
                Barcode
                <input name="barcode" required />
              </label>
              <label>
                Product name
                <input name="name" required />
              </label>
              <div className="form-three">
                <label>
                  Value (KES)
                  <input name="declaredValueKes" type="number" min="0" required />
                </label>
                <label>
                  Weight (kg)
                  <input name="weightKg" type="number" min="0" step="0.01" required />
                </label>
                <label>
                  Reorder level
                  <input name="reorderThreshold" type="number" min="0" defaultValue="0" />
                </label>
              </div>
              <label className="check-label">
                <input name="isFragile" type="checkbox" /> Fragile
              </label>
              <label className="check-label">
                <input name="requiresColdStorage" type="checkbox" /> Requires cold storage
              </label>
              <button className="btn btn-primary">Create product</button>
            </form>
          </Panel>
        )}
      </div>

      {can('merchant.manage') && (
        <Panel title="Merchant onboarding status">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Merchant</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Activate account</th>
                </tr>
              </thead>
              <tbody>
                {merchants.map((merchant) => (
                  <tr key={merchant.id}>
                    <td>
                      <code>{merchant.code}</code>
                    </td>
                    <td>{merchant.name}</td>
                    <td>
                      {merchant.contactEmail}
                      <small>{merchant.contactPhone}</small>
                    </td>
                    <td>
                      <Status value={merchant.status} />
                    </td>
                    <td>
                      {merchant.status !== 'ACTIVE' && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => void onActivateMerchant(merchant.id)}
                        >
                          Activate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {can('merchant.manage') && (
        <Panel title="Create merchant user">
          <div className="merchant-user-grid">
            {activeMerchants.map((merchant) => (
              <form
                className="staff-form mini-form"
                key={merchant.id}
                onSubmit={(event) => void onAddMerchantUser(event, merchant.id)}
              >
                <strong>{merchant.name}</strong>
                <label>
                  First name
                  <input name="firstName" required />
                </label>
                <label>
                  Last name
                  <input name="lastName" required />
                </label>
                <label>
                  Email
                  <input name="email" type="email" required />
                </label>
                <label>
                  Phone
                  <input name="phoneNumber" required />
                </label>
                <label>
                  Initial password
                  <input name="password" type="password" minLength={12} required />
                </label>
                <label>
                  Role
                  <select name="role">
                    <option value="MERCHANT_ADMIN">Merchant admin</option>
                    <option value="MERCHANT_STAFF">Merchant staff</option>
                  </select>
                </label>
                <button className="btn btn-secondary">Create user</button>
              </form>
            ))}
          </div>
        </Panel>
      )}

      {can('rider.manage') && (
        <Panel title="Register rider">
          <form className="staff-form form-row" onSubmit={(event) => void onCreateRider(event)}>
            <label>
              First name
              <input name="firstName" required />
            </label>
            <label>
              Last name
              <input name="lastName" required />
            </label>
            <label>
              Email
              <input name="email" type="email" required />
            </label>
            <label>
              Phone
              <input name="phoneNumber" required />
            </label>
            <label>
              National ID
              <input name="nationalIdNumber" required />
            </label>
            <label>
              Vehicle plate
              <input name="vehicleRegPlate" required />
            </label>
            <label>
              Initial password
              <input name="password" type="password" minLength={12} required />
            </label>
            <button className="btn btn-primary">
              <Users size={15} /> Create rider
            </button>
          </form>
        </Panel>
      )}

      {can('inventory.view') && (
        <Panel title="Catalog products">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Merchant</th>
                  <th>SKU</th>
                  <th>Product</th>
                  <th>Barcode</th>
                  <th>Declared value</th>
                  <th>Weight</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      {merchants.find((m) => m.id === product.merchantId)?.name ?? product.merchantId}
                    </td>
                    <td>
                      <code>{product.sku}</code>
                    </td>
                    <td>{product.name}</td>
                    <td>{product.barcode}</td>
                    <td>{currency(product.declaredValueKes)}</td>
                    <td>{product.weightKg} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}
