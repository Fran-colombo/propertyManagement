import { apiFetch } from "./clients";

export async function createGarage(data) {
  return await apiFetch("/garages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function getGarages() {
  return await apiFetch("/garages");
}

export async function getGarageById(id) {
  return await apiFetch(`/garages/${id}`);
}
