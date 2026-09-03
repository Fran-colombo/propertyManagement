import { amountToSpanish } from "./numberToSpanish";

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function parseISODate(value) {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  if (!y || !m) return new Date();
  return new Date(y, m - 1, d || 1);
}

function isDollars(currency) {
  const value = String(currency || "PESOS").toUpperCase();
  return value === "DOLARES" || value === "USD" || value === "DOLAR";
}

function formatMoney(amount, currency) {
  const n = Number(amount || 0);
  const prefix = isDollars(currency) ? "U$S" : "$";
  return `${prefix} ${n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function rosarioDate(date = new Date()) {
  const d = parseISODate(date);
  return `Rosario, ${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
}

export function monthYearLabel(date) {
  const d = parseISODate(date);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function unitBuildingLabel({ floor, apartment, direction, garageLabel } = {}) {
  const unitParts = [];
  if (garageLabel) unitParts.push(garageLabel);
  if (floor) unitParts.push(`Piso ${floor}`);
  if (apartment) unitParts.push(`Depto ${apartment}`);
  const unidad = unitParts.length ? unitParts.join(" / ") : "unidad";
  const edificio = direction || garageLabel || "sin dirección";
  return { unidad, edificio };
}

export function buildCashReceiptText({
  payerName,
  amount,
  currency,
  concept,
  floor,
  apartment,
  direction,
  garageLabel,
  periodDate,
  issuedAt,
} = {}) {
  const currencyWord = isDollars(currency) ? "dólares" : "pesos";
  const { unidad, edificio } = unitBuildingLabel({
    floor,
    apartment,
    direction,
    garageLabel,
  });
  const letters = amountToSpanish(amount);
  const money = formatMoney(amount, currency);
  return [
    rosarioDate(issuedAt),
    "",
    `Recibí de ${payerName || "—"} la suma de ${currencyWord} ${letters} (${money}) en concepto de ${concept}, unidad ${unidad}, edificio ${edificio}, mes ${monthYearLabel(periodDate)}.`,
    "",
    "Firma y aclaración: ______________________________",
  ].join("\n");
}

export function saleInstallmentConcept(sale, installment) {
  const kind = String(installment?.kind || "cuota").toLowerCase();
  if (kind === "adelanto") return "pago de adelanto pactado";
  const cuotas = (sale?.installments || []).filter(
    (row) => String(row.kind || "cuota").toLowerCase() !== "adelanto"
  );
  const index = cuotas.findIndex((row) => row.id === installment?.id);
  const n = index >= 0 ? index + 1 : 1;
  const total = Math.max(cuotas.length, 1);
  return `pago de cuota ${n}/${total}`;
}

export function rentPeriodConcept(periods, periodId) {
  const list = [...(periods || [])].sort((a, b) =>
    String(a.start_date || "").localeCompare(String(b.start_date || ""))
  );
  const index = list.findIndex((row) => row.id === periodId);
  const n = index >= 0 ? index + 1 : 1;
  const total = Math.max(list.length, 1);
  return `pago de cuota ${n}/${total}`;
}

export function openCashReceiptPrint(text) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br />");
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Comprobante de cobro</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; margin: 48px; color: #111; }
    h1 { font-size: 18px; margin-bottom: 32px; }
    p { font-size: 16px; line-height: 1.7; max-width: 720px; }
    .actions { margin-top: 32px; }
    @media print { .actions { display: none; } }
  </style>
</head>
<body>
  <h1>Comprobante de cobro</h1>
  <p>${escaped}</p>
  <div class="actions">
    <button onclick="window.print()">Imprimir</button>
  </div>
</body>
</html>`;
  const popup = window.open("", "_blank");
  if (!popup) {
    throw new Error("El navegador bloqueó la ventana de impresión. Permití pop-ups y reintentá.");
  }
  popup.document.write(html);
  popup.document.close();
  popup.focus();
}
