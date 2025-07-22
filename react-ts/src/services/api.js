const API_BASE_URL = "http://localhost:8000/api"

class ApiService {
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`

    const config = {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    }

    if (config.body && typeof config.body === "object") {
      config.body = JSON.stringify(config.body)
    }

    try {
      const response = await fetch(url, config)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error("API request failed:", error)
      throw error
    }
  }

  async get(endpoint) {
    return this.request(endpoint, { method: "GET" })
  }

  async post(endpoint, data) {
    return this.request(endpoint, {
      method: "POST",
      body: data,
    })
  }

  async put(endpoint, data) {
    return this.request(endpoint, {
      method: "PUT",
      body: data,
    })
  }

  async delete(endpoint) {
    return this.request(endpoint, { method: "DELETE" })
  }
}

export const api = new ApiService()
