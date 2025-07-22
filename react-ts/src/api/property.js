import { apiFetch } from "./clients";

export async function getProperties() {
  return await apiFetch("/properties/");
}

export async function createProperty(propertyData) {
  return await apiFetch("/properties", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(propertyData),
  });
}

export async function getPropertyById(id){
  return await apiFetch(`/properties/${id}`)
}

export async function deleteProperty(id){
  return await apiFetch(`/properties/${id}`,{
    method: "DELETE"
});
}