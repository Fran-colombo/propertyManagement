import { apiFetch } from "./clients";

export async function registerTransaction(periodId, paymentData) {
  return await apiFetch(`/transactions/${periodId}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(paymentData),
  });
}

export async function getAllTransactions() {
  return await apiFetch("/transactions");
}

export async function getTransactionsByPeriod(periodId) {
  return await apiFetch(`/transactions/period/${periodId}`);
}
