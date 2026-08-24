export async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem("authToken");
  const url = `${import.meta.env.VITE_API_URL}${endpoint}`;
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  try {
    const headers = {
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(options.headers || {}),
    };
    if (!isFormData && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      method: options.method || "GET",
      headers,
      body: options.body,
    });

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      const text = await response.text();
      console.error("Non-JSON response:", text);
      if (response.status === 502) {
        throw new Error("El servidor no respondió (502). Revisá que el backend esté arriba.");
      }
      if (response.status >= 500) {
        throw new Error("Error interno del servidor. Revisá los logs del backend.");
      }
      throw new Error(text?.slice(0, 180) || `Respuesta inválida (${response.status})`);
    }

    if (!response.ok) {
      const errorData = await response.json();
      console.error("API Error:", errorData);
      const detail = errorData.detail || errorData.message || "API request failed";
      throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    }

    // 204 No Content
    if (response.status === 204) return null;
    return await response.json();
  } catch (error) {
    console.error("Fetch error:", error);
    throw error;
  }
}
