// import { apiFetch } from "./clients";

// export async function createContract(contractData) {
//   return await apiFetch("/contracts", {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//     },
//     body: JSON.stringify(contractData),
//   });
// }

// export async function getContractById(contractId) {
//   return await apiFetch(`/contracts/${contractId}`);
// }

// export async function getContractsAdjustingNextMonth() {
//   return await apiFetch("/contracts/adjust-next-month");
// }


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

export const getContracts = async() => {
  return await apiFetch("/contracts/");
}

export const cancelContract = async (contractId) => {
  if (!window.confirm("¿Estás seguro que querés cancelar este contrato?")) return;

  try {
    const response = await fetch(`http://localhost:8000/contracts/${contractId}/cancel`, {
      method: "DELETE",
    });

    if (response.ok) {
      alert("Contrato cancelado correctamente");
      // Recargar lista de contratos
      await getContracts(); 
    } else {
      const errorData = await response.json();
      alert("Error al cancelar contrato: " + errorData.detail);
    }
  } catch (err) {
    console.error(err);
    alert("Error inesperado al cancelar contrato");
  }
};

export const getContractHistory = async () => {
  return await apiFetch("/contracts-history/")
}


