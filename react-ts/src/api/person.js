import { apiFetch } from "./clients";

export async function getOwners() {
  return await apiFetch("/owners/");
}

export async function createOwner(ownerData) {
  return await apiFetch("/owners", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(ownerData),
  });
}

export async function updateOwner(id, ownerData){
    return await apiFetch(`/owners/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(ownerData),
  });
}

export async function deleteOwner(id){
  return await apiFetch(`/owners/${id}`,{
    method: "DELETE"
});
}

export async function createTenant(tenantData) {
  return await apiFetch("/tenants/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(tenantData),
  });
}

export async function getTenants() {
  return await apiFetch("/tenants/");
}

export async function getTenantById(id) {
  return await apiFetch(`/tenants/${id}`);
}

export async function updateTenant(id, tenantData){
  return await apiFetch(`/tenants/${id}` ,{
    method:"PUT",
        headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(tenantData),
  });
}

export async function deleteTenant(id){
  return await apiFetch(`/tenants/${id}`,{
    method: "DELETE"
});
}


