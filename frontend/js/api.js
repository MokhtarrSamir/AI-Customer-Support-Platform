/* Centralized API client.

   Every request the app makes goes through this file. It owns:
   - the base URL (from config.js)
   - the JWT token storage
   - the "Authorization: Bearer <token>" header
   - JSON headers
   - the HTTP verbs
   - error handling for 400 / 401 / 403 / 404 / 422 / 500 / network failure

   Pages should never call fetch() directly. */

/* Error thrown by every failed request.
   status === 0 means the request never reached the server. */
class ApiError extends Error {
  constructor(status, message, payload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

/* Token handling is centralized here so nothing else touches storage. */
const Token = {
  save(token) {
    /* sessionStorage is used on purpose: the token disappears when the tab is
       closed. An httpOnly cookie would be safer, but that needs a backend change. */
    sessionStorage.setItem(CONFIG.TOKEN_STORAGE_KEY, token);
  },

  read() {
    return sessionStorage.getItem(CONFIG.TOKEN_STORAGE_KEY);
  },

  clear() {
    sessionStorage.removeItem(CONFIG.TOKEN_STORAGE_KEY);
  },
};

/* Called when the backend rejects the token (401).
   app.js registers the real handler so this file stays independent. */
let unauthorizedHandler = null;

function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

/* Friendly message for statuses that do not carry a usable detail. */
function defaultMessage(status) {
  switch (status) {
    case 0:
      return "Cannot reach the server. Make sure the backend is running, then try again.";
    case 400:
      return "The server rejected this request.";
    case 401:
      return "You are not logged in, or your session has expired.";
    case 403:
      return "You do not have permission to do this.";
    case 404:
      return "Not found.";
    case 422:
      return "Please check the values you entered.";
    case 500:
      return "The server ran into an error. Please try again.";
    default:
      return "Request failed.";
  }
}

/* FastAPI sends errors as { "detail": "..." } and validation errors as
   { "detail": [ { "loc": [...], "msg": "..." } ] }. Both are handled. */
function extractMessage(payload, status) {
  if (!payload) return defaultMessage(status);

  if (typeof payload === "string") return payload;

  const detail = payload.detail;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (!item || typeof item !== "object" || !item.msg) return String(item);
        const field = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : "";
        return field ? `${field}: ${item.msg}` : item.msg;
      })
      .filter(Boolean);

    if (messages.length) return messages.join(" ");
  }

  return defaultMessage(status);
}

async function request(method, path, body) {
  const url = CONFIG.API_BASE_URL + path;

  const headers = { Accept: "application/json" };
  const token = Token.read();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (networkError) {
    throw new ApiError(0, defaultMessage(0), null);
  }

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (parseError) {
      payload = text;
    }
  }

  if (response.status === 204) return null;

  if (!response.ok) {
    /* An expired or invalid token: drop it and let app.js send the user to login. */
    if (response.status === 401 && token) {
      Token.clear();
      if (unauthorizedHandler) unauthorizedHandler();
    }
    throw new ApiError(
      response.status,
      extractMessage(payload, response.status),
      payload
    );
  }

  return payload;
}

/* All endpoints that exist in the FastAPI backend, grouped by resource.
   Paths and bodies are copied from the backend routers, nothing is invented. */
const Api = {
  auth: {
    register: (name, email, password) =>
      request("POST", "/auth/register", { name, email, password }),
    login: (email, password) =>
      request("POST", "/auth/login", { email, password }),
    me: () => request("GET", "/auth/me"),
    /* The backend has no logout endpoint: logging out is clearing the token. */
  },

  tickets: {
    list: () => request("GET", "/tickets"),
    get: (id) => request("GET", `/tickets/${id}`),
    create: (subject, description, message) =>
      request("POST", "/tickets", { subject, description, message }),
    /* The backend only accepts status and priority here. */
    update: (id, status, priority) => {
      const body = {};
      if (status !== undefined && status !== null) body.status = status;
      if (priority !== undefined && priority !== null) body.priority = priority;
      return request("PATCH", `/tickets/${id}`, body);
    },
    assign: (id, agentId) =>
      request("PATCH", `/tickets/${id}/assign`, { agent_id: agentId }),
    listMessages: (id) => request("GET", `/tickets/${id}/messages`),
    sendMessage: (id, content) =>
      request("POST", `/tickets/${id}/messages`, { content }),
  },

  users: {
    list: () => request("GET", "/users"),
    get: (id) => request("GET", `/users/${id}`),
    disable: (id) => request("PATCH", `/users/${id}/disable`),
    activate: (id) => request("PATCH", `/users/${id}/activate`),
    remove: (id) => request("DELETE", `/users/${id}`),
  },

  admin: {
    statistics: () => request("GET", "/admin/statistics"),
    customers: () => request("GET", "/admin/customers"),
    supportAgents: () => request("GET", "/admin/support-agents"),
    supportActivity: () => request("GET", "/admin/support-activity"),
    aiUsage: () => request("GET", "/admin/ai-usage"),
  },

  ai: {
    chat: (message) => request("POST", "/ai/chat", { message }),
    /* Not a real HTTP stream: the backend collects the graph events and
       returns them all in one JSON response. */
    chatEvents: (message) =>
      request("POST", "/ai/chat/stream", { message }),
    chatStructured: (message) =>
      request("POST", "/ai/chat/structured", { message }),
    suggestResponse: (ticketId) =>
      request("POST", "/ai/suggest-response", { ticket_id: ticketId }),
  },
};
