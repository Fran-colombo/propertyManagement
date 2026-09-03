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
    <div class="inner">
      <h1>RECIBO</h1>
      <div class="date">${escapeHtml(dateLine)}</div>
      <p class="body">${escapeHtml(body)}</p>
      <div class="sign">${escapeHtml(sign)}</div>
    </div>
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
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: "Times New Roman", Times, serif;
      background: #e8eef4;
      color: #111;
    }
    .toolbar {
      width: 210mm;
      margin: 16px auto 0;
      text-align: center;
    }
    .toolbar button {
      background: #1b4f8a;
      color: #fff;
      border: 0;
      border-radius: 6px;
      padding: 10px 18px;
      font-size: 14px;
      font-family: "Segoe UI", Arial, sans-serif;
      cursor: pointer;
    }
    .sheet {
      width: 210mm;
      height: 297mm;
      margin: 12px auto 24px;
      background: #fff;
      border: 1px solid #d5dde6;
      box-shadow: 0 12px 32px rgba(20, 40, 70, 0.12);
      display: flex;
      flex-direction: column;
    }
    .receipt {
      flex: 1 1 50%;
      height: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 18mm 22mm;
    }
    .inner {
      width: 100%;
      max-width: 160mm;
      text-align: center;
    }
    .cut {
      flex: 0 0 auto;
      margin: 0 12mm;
      border: 0;
      border-top: 1px dashed #8a97a6;
    }
    h1 {
      font-size: 22pt;
      font-weight: 700;
      letter-spacing: 0.18em;
      margin: 0 0 14px;
    }
    .date {
      font-size: 12pt;
      font-style: italic;
      margin-bottom: 18px;
    }
    .body {
      font-size: 12pt;
      line-height: 1.55;
      margin: 0 auto;
      text-align: center;
    }
    .sign {
      margin-top: 28px;
      font-size: 12pt;
    }
    @media print {
      body { background: #fff; }
      .toolbar { display: none; }
      .sheet {
        margin: 0;
        border: 0;
        box-shadow: none;
        width: 210mm;
        height: 297mm;
      }
      .receipt { break-inside: avoid; page-break-inside: avoid; }
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
