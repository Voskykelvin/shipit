export function isMatchingC2bReplay(
  existingPayment: { orderId: string; merchantId: string; amountCollectedKes: number } | null,
  order: { id: string; merchantId: string; codAmountExpectedKes: number; paymentMethod: string } | null,
  amountKes: number,
) {
  return Boolean(
    existingPayment &&
    order &&
    order.paymentMethod === 'COD_MPESA' &&
    existingPayment.orderId === order.id &&
    existingPayment.merchantId === order.merchantId &&
    existingPayment.amountCollectedKes === amountKes &&
    order.codAmountExpectedKes === amountKes,
  );
}
