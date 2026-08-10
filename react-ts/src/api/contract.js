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

export const applyContractIndex = async (contractId, value) => {
  return await apiFetch(`/contracts/${contractId}/apply-index`, {
    method: 'POST',
    body: JSON.stringify({ value }),
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
  if (!window.confirm("¿Estás seguro que querés cancelar este contrato?")) return;
  try {
    await cancelContractDetailed(contractId, {
      cancelled_by: "PROPIETARIO",
      reason: "Cancelación rápida sin detalle",
      effective_date: new Date().toISOString().slice(0, 10),
      settlement_amount: 0,
      settlement_direction: "SIN_MONTO",
    });
    alert("Contrato cancelado correctamente");
    await getContracts();
  } catch (err) {
    console.error(err);
    alert(err.message || "Error inesperado al cancelar contrato");
  }
};

export const getContractHistory = async () => {
  return await apiFetch("/contracts-history/")
}
