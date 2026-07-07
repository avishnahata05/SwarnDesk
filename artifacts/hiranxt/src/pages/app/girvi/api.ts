export const API = "/api/girvi";

// Adds calendar months (not just 30*n days) so "1 month" from Jan 31 lands on
// Feb 28/29 the way people expect, not Mar 2/3.
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function toDateInputValue(date: Date): string {
  return date.toISOString().split("T")[0];
}

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

export async function apiSend<T>(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  const r = await fetch(`${API}${path}`, { method, headers: getAuthHeaders(), body: body !== undefined ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error((await r.json().catch(() => ({ error: "Request failed" }))).error ?? "Request failed");
  return r.json();
}
