import { getToken, setToken } from "@/lib/session";

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  auth?: boolean;
};

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { body, auth = true, ...init } = options;
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) throw new Error("Set NEXT_PUBLIC_API_URL before you build the frontend.");

  const token = auth ? getToken() : null;
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
    ...init,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // A response from an earlier session must not end a newer session.
  if (response.status === 401 && auth && getToken() === token) {
    setToken(null);
  }

  if (!response.ok) {
    let message = `The request failed (${response.status}).`;
    try {
      const data: unknown = await response.json();
      if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
        message = data.error;
      }
    } catch {
      // Non-JSON errors still retain the HTTP status.
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
