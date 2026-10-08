// Calls the server functions in /api. The Gemini key stays on the server; the browser never sees it.
export async function callApi(path: string, body: unknown): Promise<{ text?: string }> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
