import { apiFetch } from "./clients";

export async function registerTransaction(periodId, paymentData) {
  return await apiFetch(`/transactions/${periodId}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(paymentData),
  });
}

export async function getAllTransactions({
  page = 1,
  pageSize = 20,
  q,
  month,
  method,
  remittance,
} = {}) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("page_size", String(pageSize));
  if (q) params.set("q", q);
  if (month) params.set("month", month);
  if (method) params.set("method", method);
  if (remittance) params.set("remittance", remittance);
  return await apiFetch(`/transactions/?${params.toString()}`);
}

export async function getTransactionsByPeriod(periodId) {
  return await apiFetch(`/transactions/period/${periodId}`);
}

export async function registerCreditNote(periodId, data) {
  return await apiFetch(`/transactions/${periodId}/credit-notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function remitToOwner(historyId) {
  return await apiFetch(`/transactions/history/${historyId}/remit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}
