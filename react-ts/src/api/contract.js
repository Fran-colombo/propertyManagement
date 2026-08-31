import { apiFetch } from "./clients";


export const getPendingContracts = async () => {
  const response = await apiFetch('/contracts/pending/');
  return response;
};

export const getContract = async (contractId) => {
  return await apiFetch(`/contracts/${contractId}`);
};

export const createContract = async (contractData) => {
  return await apiFetch('/contracts/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(contractData),
  });
};

export const applyContractIndex = async (contractId, value, newIndexValue) => {
  const body = { value };
  if (newIndexValue != null && newIndexValue !== "") {
    body.new_index_value = Number(newIndexValue);
  }
  return await apiFetch(`/contracts/${contractId}/apply-index`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
};

export const updateContract = async (contractId, data) => {
  return await apiFetch(`/contracts/${contractId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
};

export const uploadContractDocument = async (contractId, file) => {
  const form = new FormData();
  form.append("document", file);
  return await apiFetch(`/contracts/${contractId}/document`, {
    method: "POST",
    body: form,
  });
};

export const parseContractDocument = async (file) => {
  const form = new FormData();
  form.append("document", file);
  return await apiFetch("/contracts/parse-document", {
    method: "POST",
    body: form,
  });
};

export const getContracts = async() => {
  return await apiFetch("/contracts/");
}

export const cancelContractDetailed = async (contractId, data) => {
  const form = new FormData();
  form.append("cancelled_by", data.cancelled_by);
  form.append("reason", data.reason);
  form.append("effective_date", data.effective_date);
  form.append("settlement_amount", String(data.settlement_amount ?? 0));
  form.append("settlement_direction", data.settlement_direction || "SIN_MONTO");
  form.append(
    "waive_remaining_rent",
    data.waive_remaining_rent ? "true" : "false"
  );
  if (data.receipt) {
    form.append("receipt", data.receipt);
  }
  return await apiFetch(`/contracts/${contractId}/cancel`, {
    method: "POST",
    body: form,
  });
};

/** @deprecated use cancelContractDetailed + CancelContractModal */
export const cancelContract = async (contractId) => {
  return cancelContractDetailed(contractId, {
    cancelled_by: "PROPIETARIO",
    reason: "Cancelación rápida sin detalle",
    effective_date: new Date().toISOString().slice(0, 10),
    settlement_amount: 0,
    settlement_direction: "SIN_MONTO",
  });
};

export const getContractHistory = async ({
  page = 1,
  pageSize = 20,
  propertyId,
  month,
  tenant,
} = {}) => {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("page_size", String(pageSize));
  if (propertyId) params.set("property_id", String(propertyId));
  if (month) params.set("month", month);
  if (tenant) params.set("tenant", tenant);
  return await apiFetch(`/contracts-history/?${params.toString()}`);
};
