import { apiFetch } from "./clients";

export async function sellProperty(propertyId, data) {
  return await apiFetch(`/properties/${propertyId}/sell`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function getSales({
  page = 1,
  pageSize = 20,
  q,
  status,
  keepManaging,
  month,
} = {}) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("page_size", String(pageSize));
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  if (keepManaging) params.set("keep_managing", keepManaging);
  if (month) params.set("month", month);
  return await apiFetch(`/sales/?${params.toString()}`);
}

export async function getSale(saleId) {
  return await apiFetch(`/sales/${saleId}`);
}

export async function collectSaleInstallment(saleId, installmentId, data) {
  return await apiFetch(`/sales/${saleId}/installments/${installmentId}/pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
