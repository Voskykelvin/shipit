import React from 'react';
import type { Order } from '@shipit/shared-types';
import type { PickTask, PickWave } from '../../types';
import { Panel, Status } from '../../components/ui';
import { OrderTable } from '../orders/OrdersView';
import { Plus } from 'lucide-react';

interface PickingViewProps {
  waves: PickWave[];
  orders: Order[];
  selectedOrders: string[];
  setSelectedOrders: React.Dispatch<React.SetStateAction<string[]>>;
  busy: boolean;
  can: (permission: string) => boolean;
  onCreateWave: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onStartWave: (waveId: string) => Promise<void>;
  onCompleteWave: (waveId: string) => Promise<void>;
  onMarkPicked: (event: React.FormEvent<HTMLFormElement>, task: PickTask) => Promise<void>;
  onVerifyOrder: (id: string, confirmed: boolean) => void;
  onCancelOrder: (id: string) => void;
  onPackOrder: (order: Order) => void;
}

export function PickingView({
  waves,
  orders,
  selectedOrders,
  setSelectedOrders,
  busy,
  can,
  onCreateWave,
  onStartWave,
  onCompleteWave,
  onMarkPicked,
  onVerifyOrder,
  onCancelOrder,
  onPackOrder,
}: PickingViewProps) {
  const readyToPickOrders = orders.filter((order) => order.status === 'READY_FOR_PICK');
  const pickingOrders = orders.filter((order) => order.status === 'PICKING');

  return (
    <>
      {can('inventory.pick') && (
        <Panel
          title="Create pick wave"
          subtitle="Select ready-to-pick orders with allocated inventory."
        >
          <form className="staff-form" onSubmit={(event) => void onCreateWave(event)}>
            <div className="select-order-grid">
              {readyToPickOrders.map((order) => (
                <label key={order.id} className="select-order">
                  <input
                    type="checkbox"
                    checked={selectedOrders.includes(order.id)}
                    onChange={(event) =>
                      setSelectedOrders((current) =>
                        event.target.checked
                          ? [...current, order.id]
                          : current.filter((id) => id !== order.id),
                      )
                    }
                  />
                  <span>
                    <strong>{order.orderNumber}</strong>
                    <small>
                      {order.customerName} · {order.items.length} lines
                    </small>
                  </span>
                </label>
              ))}
            </div>
            <button
              className="btn btn-primary"
              disabled={busy || !selectedOrders.length}
            >
              <Plus size={15} /> Create wave ({selectedOrders.length})
            </button>
          </form>
        </Panel>
      )}

      {waves.map((wave) => (
        <Panel
          key={wave.id}
          title={`${wave.waveNumber} · ${wave.status}`}
          action={
            <div className="header-right">
              <Status value={wave.status} />
              {wave.status === 'CREATED' && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => void onStartWave(wave.id)}
                >
                  Start wave
                </button>
              )}
              {wave.status === 'IN_PROGRESS' && wave.confirmedTaskCount === wave.taskCount && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => void onCompleteWave(wave.id)}
                >
                  Complete wave
                </button>
              )}
            </div>
          }
        >
          <div className="task-list">
            {wave.tasks.map((task) => (
              <div
                className={`pick-task ${task.isConfirmed ? 'confirmed' : ''}`}
                key={task.id}
              >
                <div className="task-location">
                  <span>Pick location</span>
                  <code>{task.location.barcode}</code>
                </div>
                <div className="task-detail">
                  <strong>
                    {task.sku} · {task.productName}
                  </strong>
                  <span>
                    {task.orderNumber} · {task.quantity} units
                  </span>
                  <code>Product barcode: {task.barcode}</code>
                </div>
                {task.isConfirmed ? (
                  <Status value="PICKED" />
                ) : wave.status === 'IN_PROGRESS' ? (
                  <form
                    className="pick-task-form"
                    onSubmit={(event) => void onMarkPicked(event, task)}
                  >
                    <input
                      name="scannedBarcode"
                      placeholder="Scan product barcode"
                      autoComplete="off"
                      required
                    />
                    <input
                      name="quantity"
                      type="number"
                      min="1"
                      max={task.quantity - task.pickedQuantity}
                      defaultValue={task.quantity - task.pickedQuantity}
                      required
                    />
                    <button className="btn btn-primary btn-sm" disabled={busy}>
                      Confirm pick
                    </button>
                  </form>
                ) : (
                  <Status value="WAITING" />
                )}
              </div>
            ))}
          </div>
        </Panel>
      ))}

      {can('inventory.pack') && (
        <Panel title="Pack picked orders">
          <OrderTable
            orders={pickingOrders}
            can={can}
            onVerify={onVerifyOrder}
            onCancel={onCancelOrder}
            onPack={onPackOrder}
          />
        </Panel>
      )}
    </>
  );
}
