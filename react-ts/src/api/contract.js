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

export const cancelContract = async (contractId) => {
  if (!window.confirm("¿Estás seguro que querés cancelar este contrato?")) return;

  try {
    await apiFetch(`/contracts/${contractId}/cancel`, {
      method: "DELETE",
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
