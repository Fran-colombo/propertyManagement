import { apiFetch } from "./clients";

export async function createGarage(data) {
  return await apiFetch("/garages/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function getGarages({ includeSold = false } = {}) {
  return await apiFetch(includeSold ? "/garages/?include_sold=true" : "/garages/");
}

export async function getGarageById(id) {
  return await apiFetch(`/garages/${id}`);
}

export async function updateGarage(id, data) {
  return await apiFetch(`/garages/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteGarage(id) {
  return await apiFetch(`/garages/${id}`, { method: "DELETE" });
}

export async function sellGarage(id, data) {
  return await apiFetch(`/garages/${id}/sell`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
