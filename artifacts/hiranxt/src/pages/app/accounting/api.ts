export const API = "/api/accounting";

export function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("swarndesk_token");
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export function authHeader(): Record<string, string> {
  return { Authorization: `Bearer ${localStorage.getItem("swarndesk_token")}` };
}

export async function apiGet<T>(path: string): Promise<T> {
  const r = await fetch(`${API}${path}`, { headers: authHeader() });
  if (!r.ok) throw new Error((await r.json().catch(() => ({ error: "Request failed" }))).error ?? "Request failed");
  return r.json();
}

// For reading party lists (customers/suppliers/karigars) that live outside /api/accounting.
export async function apiGetOther<T>(path: string): Promise<T> {
  const r = await fetch(`/api${path}`, { headers: authHeader() });
  if (!r.ok) throw new Error((await r.json().catch(() => ({ error: "Request failed" }))).error ?? "Request failed");
  return r.json();
}

export async function apiSend<T>(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  const r = await fetch(`${API}${path}`, { method, headers: getAuthHeaders(), body: body !== undefined ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error((await r.json().catch(() => ({ error: "Request failed" }))).error ?? "Request failed");
  return r.json();
}

// For writing to party records (customers/suppliers/karigars) that live outside /api/accounting.
export async function apiSendOther<T>(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  const r = await fetch(`/api${path}`, { method, headers: getAuthHeaders(), body: body !== undefined ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error((await r.json().catch(() => ({ error: "Request failed" }))).error ?? "Request failed");
  return r.json();
}
