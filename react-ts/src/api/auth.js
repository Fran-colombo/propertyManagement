import { apiFetch } from "./clients"

export async function signup(data) {
  return apiFetch("/signUp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data),
  });
}


export async function login(formData) {
  const body = new URLSearchParams();
  body.append("username", formData.username);
  body.append("password", formData.password);
  console.log("API URL:", import.meta.env.VITE_API_URL);

  try {
    const data = await apiFetch("/login", {
      method: "POST",
      headers: { 
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    

    if (!data.access_token) {
      throw new Error("Formato de respuesta inválido: falta access_token");
    }

    return data;
  } catch (error) {
    console.error("Error en login:", error);
    throw new Error(error.message || "Error al iniciar sesión");
  }
}
