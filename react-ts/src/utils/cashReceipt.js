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

function receiptParts(data = {}) {
  const currencyWord = isDollars(data.currency) ? "dólares" : "pesos";
  const { unidad, edificio } = unitBuildingLabel(data);
  return {
    dateLine: rosarioDate(data.issuedAt),
    payerName: data.payerName || "—",
    amountWords: `${currencyWord} ${amountToSpanish(data.amount)} (${formatMoney(data.amount, data.currency)})`,
    concept: data.concept || "pago",
    unidad,
    edificio,
    month: monthYearLabel(data.periodDate),
    sign: "Firma y aclaración: ______________________________",
  };
}

export function buildCashReceiptText(data = {}) {
  const p = receiptParts(data);
  return [
    p.dateLine,
    "",
    `Recibí de ${p.payerName} la suma de ${p.amountWords} en concepto de ${p.concept}, unidad ${p.unidad}, edificio ${p.edificio}, mes ${p.month}.`,
    "",
    p.sign,
  ].join("\n");
}

export function buildClientReceiptText(data = {}) {
  const p = receiptParts(data);
  return [
    p.dateLine,
    "",
    `Se otorga el presente comprobante a ${p.payerName} por haber abonado la suma de ${p.amountWords} en concepto de ${p.concept}, unidad ${p.unidad}, edificio ${p.edificio}, mes ${p.month}.`,
    "",
    p.sign,
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

function splitReceipt(text) {
  const [dateLine = "", , body = "", , sign = ""] = String(text).split("\n");
  return { dateLine, body, sign };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function receiptBlockHtml({ dateLine, body, sign }) {
  return `
  <section class="receipt">
    <h1>Recibo</h1>
    <div class="rule"></div>
    <div class="date">${escapeHtml(dateLine)}</div>
    <div class="body">${escapeHtml(body)}</div>
    <div class="sign">${escapeHtml(sign)}</div>
  </section>`;
}

export function openCashReceiptPrint(data) {
  const archive = splitReceipt(typeof data === "string" ? data : buildCashReceiptText(data));
  const client = splitReceipt(typeof data === "string" ? data : buildClientReceiptText(data));
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Recibo</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Segoe UI", Arial, sans-serif;
      background: #e8eef4;
      color: #1b2430;
    }
    .toolbar {
      max-width: 720px;
      margin: 24px auto 0;
      text-align: center;
    }
    .toolbar button {
      background: #1b4f8a;
      color: #fff;
      border: 0;
      border-radius: 6px;
      padding: 10px 18px;
      font-size: 14px;
      cursor: pointer;
    }
    .sheet {
      max-width: 720px;
      margin: 20px auto 32px;
      padding: 36px 40px;
      background: #fff;
      border: 1px solid #d5dde6;
      border-radius: 8px;
      box-shadow: 0 12px 32px rgba(20, 40, 70, 0.12);
    }
    .receipt { text-align: center; }
    .receipt + .cut { margin: 28px 0; }
    .cut {
      border: 0;
      border-top: 1px dashed #8a97a6;
    }
    h1 {
      font-size: 20px;
      margin: 0 0 8px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .rule { height: 2px; width: 160px; background: #1b2430; margin: 0 auto 18px; }
    .date { color: #4a5568; margin-bottom: 16px; }
    .body { font-size: 15px; line-height: 1.7; max-width: 560px; margin: 0 auto; }
    .sign { margin-top: 28px; }
    @media print {
      body { background: #fff; }
      .toolbar { display: none; }
      .sheet {
        margin: 0;
        padding: 12mm 14mm;
        border: 0;
        box-shadow: none;
        max-width: none;
      }
      .receipt, .sheet { page-break-inside: avoid; page-break-after: auto; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">Imprimir</button>
  </div>
  <div class="sheet">
    ${receiptBlockHtml(archive)}
    <hr class="cut" />
    ${receiptBlockHtml(client)}
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
