/**
 * Thin fetch wrapper that mirrors axios-style { data } responses.
 * Used by ChatShell and any future API calls so tests can mock `../api` cleanly.
 */

const BASE = '';

async function request<T>(method: string, url: string, body?: unknown): Promise<{ data: T }> {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    throw new Error(`${method} ${url} → ${res.status}`);
  }

  const data: T = await res.json();
  return { data };
}

export const api = {
  get:    <T = unknown>(url: string)               => request<T>('GET',    url),
  post:   <T = unknown>(url: string, body?: unknown) => request<T>('POST',   url, body),
  patch:  <T = unknown>(url: string, body?: unknown) => request<T>('PATCH',  url, body),
  delete: <T = unknown>(url: string)               => request<T>('DELETE', url),
};
