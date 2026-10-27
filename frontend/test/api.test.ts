import { describe, expect, it, vi } from "vitest";
import { api, ApiError } from "@/lib/api";
import { getToken, setToken } from "@/lib/session";

describe("API client", () => {
  it("sends JSON and the saved Bearer token", async () => {
    setToken("saved-token");
    const fetch = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetch);
    await expect(api("/pokemon", { method: "POST", body: { name: "Pikachu" } })).resolves.toEqual({ ok: true });
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe("http://localhost:5000/pokemon");
    expect(options.headers.get("Authorization")).toBe("Bearer saved-token");
    expect(options.headers.get("Content-Type")).toBe("application/json");
    expect(JSON.parse(options.body)).toEqual({ name: "Pikachu" });
  });

  it("keeps public 401 errors on the form without clearing a token", async () => {
    setToken("saved-token");
    const fetch = vi.fn().mockResolvedValue(Response.json({ error: "Invalid email or password." }, { status: 401 }));
    vi.stubGlobal("fetch", fetch);
    await expect(api("/auth/login", { auth: false })).rejects.toMatchObject({ status: 401, message: "Invalid email or password." });
    expect(fetch.mock.calls[0][1].headers.has("Authorization")).toBe(false);
    expect(getToken()).toBe("saved-token");
  });

  it("clears a token after a protected 401", async () => {
    setToken("expired");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Invalid or expired token." }, { status: 401 })));
    await expect(api("/auth/me")).rejects.toBeInstanceOf(ApiError);
    expect(getToken()).toBeNull();
  });

  it("preserves a newer session when an older request returns 401", async () => {
    setToken("old-token");
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => {
      setToken("new-token");
      return Response.json({ error: "Expired" }, { status: 401 });
    }));
    await expect(api("/auth/me")).rejects.toMatchObject({ status: 401 });
    expect(getToken()).toBe("new-token");
  });

  it("preserves the session after a network error or a non-401 HTTP error", async () => {
    setToken("saved-token");
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response("Unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetch);
    await expect(api("/auth/me")).rejects.toThrow("Failed to fetch");
    await expect(api("/auth/me")).rejects.toMatchObject({ status: 503 });
    expect(getToken()).toBe("saved-token");
  });

  it("supports successful empty responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(api("/pokemon/id", { method: "DELETE" })).resolves.toBeUndefined();
  });
});
