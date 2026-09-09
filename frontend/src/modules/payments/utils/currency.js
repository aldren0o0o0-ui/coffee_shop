export function formatCurrency(amount) {
  const numeric = Number(amount) || 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(numeric);
}

export function calculateChange(amountPaid, amountDue) {
  const paid = Number(amountPaid) || 0;
  const due = Number(amountDue) || 0;
  return Math.max(0, paid - due);
}
