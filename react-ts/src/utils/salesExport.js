import { getSales } from "../api/sale";
import { downloadExcelDocument, formatEsDate, formatMoney } from "./exportTable";

function isAdvance(inst) {
  return String(inst?.kind || "").toLowerCase() === "adelanto";
}

function cuotasOf(sale) {
  return (sale.installments || [])
    .filter((row) => !isAdvance(row))
    .sort((a, b) => String(a.due_date || "").localeCompare(String(b.due_date || "")));
}

function saleProgress(sale) {
  const cuotas = cuotasOf(sale);
  const total = cuotas.length;
  const unpaidIndex = cuotas.findIndex((row) => Number(row.remaining) > 0.009);
  const current = unpaidIndex >= 0 ? unpaidIndex + 1 : total;
  const lastDue = cuotas[cuotas.length - 1]?.due_date || null;
  const nextDue = unpaidIndex >= 0 ? cuotas[unpaidIndex].due_date : null;
  const cuotaLabel =
    !total ? "—" : unpaidIndex < 0 ? `${total} de ${total} (pagada)` : `${current} de ${total}`;
  return { total, lastDue, nextDue, cuotaLabel };
}

function statusLabel(status) {
  const value = String(status || "").toUpperCase();
  if (value === "PAGADA") return "Pagada";
  if (value === "PARCIAL") return "Parcial";
  return "Pendiente";
}

export const SALES_REPORT_HEADERS = [
  "Propiedad",
  "Comprador",
  "Fecha de venta",
  "Moneda",
  "Total",
  "Pagado",
  "Saldo",
  "Cuota",
  "Próximo vencimiento",
  "Se termina",
  "Estado",
  "Administración",
];

export function salesReportRow(sale) {
  const progress = saleProgress(sale);
  return [
    sale.property_direction || "—",
    sale.buyer_name || "—",
    formatEsDate(sale.sale_date) || "—",
    String(sale.currency || "").toUpperCase() === "DOLARES" ? "USD" : "$",
    formatMoney(sale.total_amount, sale.currency),
    formatMoney(sale.amount_paid, sale.currency),
    formatMoney(sale.remaining, sale.currency),
    progress.cuotaLabel,
    formatEsDate(progress.nextDue) || "—",
    formatEsDate(progress.lastDue) || "—",
    statusLabel(sale.status),
    sale.keep_managing ? "Sigo administrando" : "Fuera de cartera",
  ];
}

export async function fetchAllSales(filters = {}) {
  const pageSize = 100;
  let page = 1;
  const items = [];
  for (;;) {
    const data = await getSales({ page, pageSize, ...filters });
    const chunk = data?.items || [];
    items.push(...chunk);
    const pages = data?.pages || 1;
    if (page >= pages || chunk.length === 0) break;
    page += 1;
  }
  return items;
}

export function downloadSalesReport(sales, { filename, subtitle } = {}) {
  const stamp = new Date().toISOString().slice(0, 10);
  downloadExcelDocument({
    filename: filename || `propiedades_vendidas_${stamp}.xls`,
    title: "Propiedades vendidas",
    subtitle: subtitle || "",
    sections: [
      {
        headers: SALES_REPORT_HEADERS,
        rows: (sales || []).map(salesReportRow),
        emptyText: "No hay ventas para exportar.",
      },
    ],
  });
}
