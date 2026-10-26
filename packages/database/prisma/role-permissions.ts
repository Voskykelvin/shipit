export const rolePermissions: Record<string, string[]> = {
  SUPER_ADMIN: [
    'control_tower.view', 'exception.manage', 'order.view', 'order.create', 'order.verify', 'order.cancel',
    'order.manage', 'inventory.view', 'inventory.locations.view', 'inventory.receive', 'inventory.pick', 'inventory.pack', 'inventory.adjust', 'product.manage',
    'dispatch.view', 'dispatch.manifest', 'dispatch.scan', 'dispatch.handover', 'rider.view', 'rider.manage', 'delivery.execute',
    'ndr.view', 'ndr.resolve', 'return.view', 'return.manage', 'return.inspect', 'finance.view', 'finance.reconcile', 'finance.variance.approve', 'settlement.create', 'settlement.approve', 'settlement.disburse', 'merchant.manage', 'audit.view',
  ],
  OPERATIONS_MANAGER: [
    'control_tower.view', 'exception.manage', 'order.view', 'order.manage', 'inventory.view', 'inventory.receive',
    'inventory.adjust', 'inventory.locations.view', 'inbound.create', 'dispatch.view', 'dispatch.manifest', 'dispatch.scan', 'dispatch.handover', 'rider.view', 'rider.manage',
    'delivery.execute', 'ndr.view', 'ndr.resolve', 'return.view', 'return.manage', 'return.inspect', 'finance.view', 'finance.variance.approve', 'audit.view',
  ],
  WAREHOUSE_SUPERVISOR: ['order.view', 'inventory.view', 'inventory.locations.view', 'inventory.receive', 'inventory.pick', 'inventory.pack', 'inventory.adjust', 'product.manage', 'dispatch.view', 'dispatch.scan', 'return.view', 'return.inspect', 'audit.view'],
  WAREHOUSE_PICKER: ['order.view', 'inventory.view', 'inventory.locations.view', 'inventory.pick', 'inventory.pack'],
  CUSTOMER_CARE_AGENT: ['order.view', 'order.verify', 'order.cancel', 'ndr.view', 'ndr.resolve', 'return.view', 'return.manage'],
  DISPATCHER: ['order.view', 'dispatch.view', 'dispatch.manifest', 'dispatch.scan', 'dispatch.handover', 'rider.view'],
  RIDER: ['delivery.tasks', 'delivery.execute'],
  FINANCE_OFFICER: ['control_tower.view', 'finance.view', 'finance.reconcile', 'settlement.approve', 'settlement.disburse', 'rider.view', 'audit.view'],
  MERCHANT_ADMIN: ['order.view', 'order.create', 'inventory.view', 'inbound.create', 'product.manage', 'finance.view', 'settlement.create', 'return.view', 'return.manage'],
  MERCHANT_STAFF: ['order.view', 'order.create', 'inventory.view', 'inbound.create', 'finance.view', 'settlement.create', 'return.view', 'return.manage'],
};
