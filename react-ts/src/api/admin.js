import { apiFetch } from "./clients";

export function listAdminTables() {
  return apiFetch("/admin/tables");
}

export function listAdminRows(table, { q = "", page = 1, pageSize = 50 } = {}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("page", String(page));
  params.set("page_size", String(pageSize));
  return apiFetch(`/admin/tables/${encodeURIComponent(table)}?${params.toString()}`);
}

export function getAdminRow(table, id) {
  return apiFetch(`/admin/tables/${encodeURIComponent(table)}/${encodeURIComponent(id)}`);
}

export function createAdminRow(table, payload) {
  return apiFetch(`/admin/tables/${encodeURIComponent(table)}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAdminRow(table, id, payload) {
  return apiFetch(`/admin/tables/${encodeURIComponent(table)}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteAdminRow(table, id) {
  return apiFetch(`/admin/tables/${encodeURIComponent(table)}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
