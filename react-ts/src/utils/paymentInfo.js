const METHOD_LABELS = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  cheque: "Cheque",
  carga_inicial: "Carga inicial",
  nota_credito: "Nota de crédito",
  venta: "Venta",
};

export function paymentMethodLabel(method) {
  const key = String(method || "").trim().toLowerCase();
  if (!key) return "";
  return METHOD_LABELS[key] || method;
}

export function formatISODate(value) {
  if (!value) return "";
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Date(y, m - 1, d).toLocaleDateString("es-AR");
}

export function isInitialLoad(period) {
  return String(period?.payment_method || "").trim().toLowerCase() === "carga_inicial";
}

export function paymentSummary(period) {
  if (!period || !(Number(period.amount_paid) > 0)) return "";
  if (isInitialLoad(period)) return "Ya estaba cobrado (carga inicial)";
  const date = formatISODate(period.payment_date);
  const method = paymentMethodLabel(period.payment_method);
  const parts = [];
  if (date) parts.push(`Pagado el ${date}`);
  if (method) parts.push(method);
  return parts.join(" · ");
}
