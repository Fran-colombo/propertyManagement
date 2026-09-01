import { apiFetch } from "./clients";

export const getPendingPeriodsByContract = async (contractId) => {
  try {
    const response = await apiFetch(`/periods/contract/${contractId}/pending`);
    return response || [];
  } catch (error) {
    console.error("Error fetching pending periods:", error);
    return [];
  }
};

export const getOverduePeriodsByContract = async (contractId) => {
  try {
    const response = await apiFetch(`/contracts/${contractId}/periods/overdue`);
    return response || [];
  } catch (error) {
    console.error("Error fetching overdue periods:", error);
    return [];
  }
};

export const registerPayment = async (periodId, paymentData) => {
  return await apiFetch(`/transactions/${periodId}/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(paymentData),
  });
};

export const updateTaxes = async (periodId, taxData) => {
  return await apiFetch(`/periods/${periodId}/taxes`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(taxData),
  });
};

export const getAllPendingPeriods = async () => {
  return await apiFetch("/periods/pending");
};

export const getCurrentPendingPeriods = async () => {
  return await apiFetch("/periods/current-pending");
};

export const getPeriodsByMonth = async (year, month) => {
  return await apiFetch(`/periods/by-month?year=${year}&month=${month}`);
};

export const getPeriodsByContract = async (contractId) => {
  return await apiFetch(`/periods/contract/${contractId}/`);
};

export const updatePeriodRent = async (periodId, data) => {
  return await apiFetch(`/periods/${periodId}/rent`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
};