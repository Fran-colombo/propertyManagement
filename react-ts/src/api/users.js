import { apiFetch } from "./clients";

export async function getUsers() {
  return await apiFetch("/users");
}

export async function createUser(data) {
  return await apiFetch("/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateUser(id, data) {
  return await apiFetch(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
