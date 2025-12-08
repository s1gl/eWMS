const BASE_URL = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

type RequestInitExtended = RequestInit & { skipJson?: boolean };

export async function request<T>(
  path: string,
  options: RequestInitExtended = {}
): Promise<T> {
  const { skipJson, ...rest } = options;
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(rest.headers || {}),
    },
    ...rest,
  });

  if (skipJson) {
    // @ts-expect-error generic path
    return res as unknown as T;
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // ignore parse errors for empty bodies
  }

  if (!res.ok) {
    const message = data?.detail || res.statusText || "Request failed";
    throw new Error(message);
  }

  return data as T;
}

export { BASE_URL };
