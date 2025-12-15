/**
 * Lightweight JS API client for the provided endpoints.
 * - Fetch API + async/await
 * - Error handling with typed ApiError
 * - JWT token management (localStorage)
 * - Base URL configuration
 * - Request/response interceptors
 */

class ApiError extends Error {
  constructor(message, { status = 0, data = null, headers = null, url = "", method = "" } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    this.headers = headers;
    this.url = url;
    this.method = method;
  }
}

class ApiClient {
  constructor({
    baseURL,
    tokenStorageKey = "jwt_token",
    defaultHeaders = { "Content-Type": "application/json" },
    timeoutMs = 0, // 0 = no timeout
  } = {}) {
    if (!baseURL) throw new Error("ApiClient requires baseURL");

    this.baseURL = baseURL.replace(/\/+$/, "");
    this.tokenStorageKey = tokenStorageKey;
    this.defaultHeaders = { ...defaultHeaders };
    this.timeoutMs = timeoutMs;

    /** @type {Array<(ctx: RequestContext) => (void|Promise<void>)>} */
    this.requestInterceptors = [];
    /** @type {Array<(ctx: ResponseContext) => (void|Promise<void>)>} */
    this.responseInterceptors = [];

    // Default request interceptor: attach JWT if present
    this.addRequestInterceptor(async (ctx) => {
      const token = this.getToken();
      if (token && !ctx.headers.has("Authorization")) {
        ctx.headers.set("Authorization", `Bearer ${token}`);
      }
    });

    // Default response interceptor: if server returns a new token, store it
    // (common patterns: Authorization: Bearer <token> or { token } in JSON)
    this.addResponseInterceptor(async (ctx) => {
      const authHeader = ctx.response.headers.get("Authorization");
      if (authHeader && /^Bearer\s+/i.test(authHeader)) {
        const token = authHeader.replace(/^Bearer\s+/i, "").trim();
        if (token) this.setToken(token);
      } else if (ctx.data && typeof ctx.data === "object" && typeof ctx.data.token === "string") {
        this.setToken(ctx.data.token);
      }
    });
  }

  // -------------------------
  // Token management
  // -------------------------
  getToken() {
    try {
      return localStorage.getItem(this.tokenStorageKey);
    } catch {
      return null;
    }
  }

  setToken(token) {
    try {
      localStorage.setItem(this.tokenStorageKey, token);
    } catch {
      // ignore storage errors
    }
  }

  clearToken() {
    try {
      localStorage.removeItem(this.tokenStorageKey);
    } catch {
      // ignore storage errors
    }
  }

  // -------------------------
  // Interceptors
  // -------------------------
  addRequestInterceptor(fn) {
    this.requestInterceptors.push(fn);
    return () => {
      this.requestInterceptors = this.requestInterceptors.filter((x) => x !== fn);
    };
  }

  addResponseInterceptor(fn) {
    this.responseInterceptors.push(fn);
    return () => {
      this.responseInterceptors = this.responseInterceptors.filter((x) => x !== fn);
    };
  }

  // -------------------------
  // Core request
  // -------------------------
  async request(method, path, { params, query, body, headers, signal } = {}) {
    const url = this._buildURL(path, params, query);

    const finalHeaders = new Headers(this.defaultHeaders);
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        if (v !== undefined && v !== null) finalHeaders.set(k, String(v));
      }
    }

    /** @type {RequestContext} */
    const ctx = {
      method,
      path,
      url,
      params: params || {},
      query: query || {},
      body,
      headers: finalHeaders,
      init: {
        method,
        headers: finalHeaders,
        signal,
      },
    };

    // Body handling
    if (body !== undefined && body !== null) {
      if (body instanceof FormData) {
        // Let browser set multipart boundary
        ctx.headers.delete("Content-Type");
        ctx.init.body = body;
      } else if (typeof body === "string") {
        ctx.init.body = body;
      } else {
        ctx.init.body = JSON.stringify(body);
        if (!ctx.headers.has("Content-Type")) {
          ctx.headers.set("Content-Type", "application/json");
        }
      }
    }

    // Apply request interceptors
    for (const interceptor of this.requestInterceptors) {
      await interceptor(ctx);
    }

    // Optional timeout
    let timeoutId = null;
    let abortController = null;
    if (this.timeoutMs > 0 && !ctx.init.signal) {
      abortController = new AbortController();
      ctx.init.signal = abortController.signal;
      timeoutId = setTimeout(() => abortController.abort(new DOMException("Request timeout", "AbortError")), this.timeoutMs);
    }

    let response;
    try {
      response = await fetch(ctx.url, ctx.init);
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      throw new ApiError(err?.message || "Network error", {
        status: 0,
        data: null,
        headers: null,
        url: ctx.url,
        method: ctx.method,
      });
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }

    const resHeaders = response.headers;

    // Try to parse response
    const contentType = resHeaders.get("content-type") || "";
    let data = null;

    if (response.status !== 204) {
      try {
        if (contentType.includes("application/json")) {
          data = await response.json();
        } else {
          data = await response.text();
        }
      } catch {
        data = null;
      }
    }

    /** @type {ResponseContext} */
    const resCtx = {
      request: ctx,
      response,
      data,
    };

    // Apply response interceptors (even on errors)
    for (const interceptor of this.responseInterceptors) {
      await interceptor(resCtx);
    }

    if (!response.ok) {
      const message =
        (data && typeof data === "object" && (data.message || data.error)) ||
        (typeof data === "string" && data) ||
        `HTTP ${response.status}`;
      throw new ApiError(message, {
        status: response.status,
        data,
        headers: resHeaders,
        url: ctx.url,
        method: ctx.method,
      });
    }

    return data;
  }

  _buildURL(path, params, query) {
    let p = path;

    // Replace {id} tokens etc.
    if (params) {
      for (const [key, val] of Object.entries(params)) {
        p = p.replace(new RegExp(`\\{${key}\\}`, "g"), encodeURIComponent(String(val)));
      }
    }

    const url = new URL(this.baseURL + (p.startsWith("/") ? p : `/${p}`));

    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null) continue;
        if (Array.isArray(v)) {
          v.forEach((item) => url.searchParams.append(k, String(item)));
        } else {
          url.searchParams.set(k, String(v));
        }
      }
    }

    return url.toString();
  }

  // -------------------------
  // Convenience HTTP methods
  // -------------------------
  get(path, options) {
    return this.request("GET", path, options);
  }
  post(path, options) {
    return this.request("POST", path, options);
  }
  put(path, options) {
    return this.request("PUT", path, options);
  }
  delete(path, options) {
    return this.request("DELETE", path, options);
  }

  // -------------------------
  // Resource APIs
  // -------------------------
  visitors = {
    list: (query) => this.get("/visitors", { query }),
    get: (id, query) => this.get("/visitors/{id}", { params: { id }, query }),
    create: (payload) => this.post("/visitors", { body: payload }),
    update: (id, payload) => this.put("/visitors/{id}", { params: { id }, body: payload }),
    remove: (id) => this.delete("/visitors/{id}", { params: { id } }),
  };

  achievements = {
    list: (query) => this.get("/achievements", { query }),
    get: (id, query) => this.get("/achievements/{id}", { params: { id }, query }),
    create: (payload) => this.post("/achievements", { body: payload }),
    update: (id, payload) => this.put("/achievements/{id}", { params: { id }, body: payload }),
    remove: (id) => this.delete("/achievements/{id}", { params: { id } }),
  };

  gallery = {
    list: (query) => this.get("/gallery", { query }),
    get: (id, query) => this.get("/gallery/{id}", { params: { id }, query }),
    create: (payload) => this.post("/gallery", { body: payload }),
    update: (id, payload) => this.put("/gallery/{id}", { params: { id }, body: payload }),
    remove: (id) => this.delete("/gallery/{id}", { params: { id } }),
  };

  messages = {
    list: (query) => this.get("/messages", { query }),
    get: (id, query) => this.get("/messages/{id}", { params: { id }, query }),
    create: (payload) => this.post("/messages", { body: payload }),
    update: (id, payload) => this.put("/messages/{id}", { params: { id }, body: payload }),
    remove: (id) => this.delete("/messages/{id}", { params: { id } }),
  };

  auth = {
    register: async (payload) => {
      const data = await this.post("/auth/register", { body: payload });
      // token auto-stored by response interceptor if present
      return data;
    },
    login: async (payload) => {
      const data = await this.post("/auth/login", { body: payload });
      // token auto-stored by response interceptor if present
      return data;
    },
    logout: async () => {
      const data = await this.post("/auth/logout");
      this.clearToken();
      return data;
    },
    me: (query) => this.get("/auth/me", { query }),
  };
}

/**
 * @typedef {Object} RequestContext
 * @property {string} method
 * @property {string} path
 * @property {string} url
 * @property {Object} params
 * @property {Object} query
 * @property {*} body
 * @property {Headers} headers
 * @property {RequestInit} init
 */

/**
 * @typedef {Object} ResponseContext
 * @property {RequestContext} request
 * @property {Response} response
 * @property {*} data
 */

// -------------------------
// Example usage
// -------------------------
// const api = new ApiClient({ baseURL: "https://api.example.com" });
//
// api.addRequestInterceptor(async (ctx) => {
//   // Example: add correlation id
//   // ctx.headers.set("X-Correlation-Id", crypto.randomUUID());
// });
//
// api.addResponseInterceptor(async ({ response }) => {
//   // Example: global logging
//   // console.log(response.status, response.url);
// });
//
// const visitors = await api.visitors.list();
// const me = await api.auth.me();

export { ApiClient, ApiError };