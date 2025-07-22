import { apiFetch } from "./clients";

export async function createAgency(data) {
  return await apiFetch("/real-agencies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function getAllAgencies() {
  return await apiFetch("/real-agencies");
}

export async function getAgencyById(id) {
  return await apiFetch(`/real-agencies/${id}`);
}

// export async function updateAgency(id, agencyData){
//   return await apiFetch(`/real-agencies/${id}`,{
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify(agencyData),
//   });
// }
export async function updateAgency(id, agencyData) {
  return await apiFetch(`/real-agencies/${id}`, {
    method: "PUT",  
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(agencyData),
  });
}

export async function deleteAgency(id){
  return await apiFetch(`/real-agencies/${id}`,{
    method: "DELETE"
});
}