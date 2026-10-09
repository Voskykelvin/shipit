import React from 'react';
import { FileUp, Plus, Search } from 'lucide-react';
import type { MerchantData, Product } from '../../types';
import { EmptyState, OrderTable, Panel } from '../../components/ui';

interface OrdersViewProps {
  data: MerchantData;
  products: Product[];
  selectedProductId: string;
  setSelectedProductId: (id: string) => void;
  unitPriceKes: number | '';
  setUnitPriceKes: (val: number | '') => void;
  searchText: string;
  setSearchText: (text: string) => void;
  busy: boolean;
  onCreateOrder: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onImportCsv: (file?: File) => Promise<void>;
  onDownloadLabel: (trackingNumber: string) => Promise<void>;
}

export function OrdersView({
  data,
  products,
  selectedProductId,
  setSelectedProductId,
  unitPriceKes,
  setUnitPriceKes,
  searchText,
  setSearchText,
  busy,
  onCreateOrder,
  onImportCsv,
  onDownloadLabel,
}: OrdersViewProps) {
  const filteredOrders = data.orders.filter((order) =>
    `${order.orderNumber} ${order.customerName} ${order.customerPhone} ${order.waybillNumber ?? ''}`
      .toLowerCase()
      .includes(searchText.toLowerCase()),
  );

  return (
    <>
      <div className="split-grid">
        <Panel
          title="Create a delivery order"
          subtitle="COD orders are held for verification before inventory is reserved."
        >
          {products.length === 0 ? (
            <EmptyState>
              No active products are available to order. Ask your account manager to add products.
            </EmptyState>
          ) : (
            <form className="portal-form" onSubmit={(event) => void onCreateOrder(event)}>
              <div className="form-grid">
                <label>
                  Customer name
                  <input name="customerName" required minLength={2} />
                </label>
                <label>
                  Phone number
                  <input name="customerPhone" type="tel" placeholder="0712345678" required />
                </label>
                <label>
                  County
                  <input name="county" defaultValue="Nairobi" required />
                </label>
                <label>
                  Town / sub-county
                  <input name="townOrSubCounty" required />
                </label>
                <label>
                  Estate / area
                  <input name="estateOrArea" required />
                </label>
                <label>
                  Building / court
                  <input name="buildingOrCourt" />
                </label>
                <label className="field-wide">
                  Delivery landmark
                  <input
                    name="landmark"
                    required
                    minLength={3}
                    placeholder="Specific directions the rider can follow"
                  />
                </label>
                <label className="field-wide">
                  Google Maps URL
                  <input name="googleMapsUrl" type="url" />
                </label>
                <label>
                  Product
                  <select
                    name="productId"
                    value={selectedProductId}
                    onChange={(event) => {
                      const productId = event.target.value;
                      setSelectedProductId(productId);
                      setUnitPriceKes(
                        products.find((product) => product.id === productId)?.declaredValueKes ?? '',
                      );
                    }}
                    required
                  >
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.sku} · {product.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Quantity
                  <input name="quantity" type="number" min="1" defaultValue="1" required />
                </label>
                <label>
                  Unit price (KES)
                  <input
                    name="unitPriceKes"
                    type="number"
                    min="0"
                    value={unitPriceKes}
                    onChange={(event) =>
                      setUnitPriceKes(
                        event.target.value === '' ? '' : Number(event.target.value),
                      )
                    }
                    required
                  />
                </label>
                <label>
                  Delivery fee (KES)
                  <input name="deliveryFeeKes" type="number" min="0" defaultValue="250" required />
                </label>
                <label>
                  Payment method
                  <select name="paymentMethod">
                    <option value="COD_MPESA">Cash on delivery · M-Pesa</option>
                    <option value="COD_CASH">Cash on delivery · cash</option>
                    <option value="PREPAID">Prepaid</option>
                  </select>
                </label>
              </div>
              <button className="btn-emerald" disabled={busy}>
                <Plus size={15} /> Submit order
              </button>
            </form>
          )}
        </Panel>
        <Panel
          title="Bulk import orders"
          subtitle="Upload the CSV template accepted by the Ship It API."
        >
          <p className="helper-copy">
            Each order row needs merchant_id, address fields, product_sku, quantity, unit_price_kes
            and payment_method. Group multiple product rows with the same external_reference.
          </p>
          <label className="upload-button">
            <FileUp size={18} /> Choose CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => void onImportCsv(event.target.files?.[0])}
            />
          </label>
        </Panel>
      </div>

      <Panel
        title="Your orders"
        action={
          <div className="search-field">
            <Search size={15} />
            <input
              aria-label="Search orders"
              placeholder="Order, customer or waybill"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </div>
        }
      >
        <OrderTable orders={filteredOrders} onLabel={onDownloadLabel} />
      </Panel>
    </>
  );
}
