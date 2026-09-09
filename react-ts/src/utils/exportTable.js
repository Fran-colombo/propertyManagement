export function escHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatEsDate(value) {
  if (!value) return "";
  const [y, m, d] = String(value).slice(0, 10).split("-");
  if (!y || !m || !d) return String(value);
  return `${d}/${m}/${y}`;
}

export function formatMoney(amount, currency = "PESOS") {
  const n = Number(amount) || 0;
  const prefix = String(currency).toUpperCase() === "DOLARES" ? "U$S" : "$";
  return `${prefix} ${n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function yesNo(value) {
  return value ? "Sí" : "No";
}

function cellHtml(cell) {
  if (cell && typeof cell === "object" && !Array.isArray(cell)) {
    const text = escHtml(cell.text ?? "");
    return `<td>${text}</td>`;
  }
  return `<td>${escHtml(cell)}</td>`;
}

function rowHtml(row) {
  const cells = Array.isArray(row) ? row : row?.cells || [];
  const cls = !Array.isArray(row) && row?.className ? ` class="${escHtml(row.className)}"` : "";
  return `<tr${cls}>${cells.map(cellHtml).join("")}</tr>`;
}

function tableHtml(section) {
  const headers = (section.headers || [])
    .map((h) => `<th>${escHtml(h)}</th>`)
    .join("");
  const bodyRows = (section.rows || []).map(rowHtml).join("");
  const emptyCols = section.headers?.length || 1;
  const body =
    bodyRows ||
    `<tr><td colspan="${emptyCols}">${escHtml(section.emptyText || "Sin datos.")}</td></tr>`;
  const footer = section.footer
    ? `<tfoot>${rowHtml({ cells: section.footer })}</tfoot>`
    : "";
  const heading = section.heading
    ? `<h2 style="font-size:16px">${escHtml(section.heading)}</h2>`
    : "";
  return `${heading}
  <table>
    <thead><tr>${headers}</tr></thead>
    <tbody>${body}</tbody>
    ${footer}
  </table>`;
}

export function downloadExcelDocument({
  filename,
  title,
  subtitle,
  sections = [],
}) {
  const tables = sections.map(tableHtml).join("\n");
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escHtml(title || "Exportación")}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #1a1a1a; margin: 24px; }
    h1 { font-size: 18px; margin: 0 0 8px; }
    h2 { font-size: 16px; margin: 20px 0 8px; }
    p { margin: 0 0 16px; color: #444; }
    table { border-collapse: collapse; width: 100%; margin: 0 0 28px; }
    th, td { border: 1px solid #bbb; padding: 8px 10px; font-size: 13px; vertical-align: top; }
    th { background: #1f4e79; color: #fff; text-align: left; }
    tfoot td { font-weight: bold; background: #eef3f8; }
    .vacant td { color: #666; font-style: italic; background: #f7f7f7; }
  </style>
</head>
<body>
  <h1>${escHtml(title || "Exportación")}</h1>
  ${subtitle ? `<p>${escHtml(subtitle)}</p>` : ""}
  ${tables}
</body>
</html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
