import { describe, expect, it, vi } from "vitest";
import { pokemonImageUrl, uploadPokemonImage } from "@/lib/pokemon";

describe("Pokémon images", () => {
  it("uses the configured public image origin", () => {
    vi.stubEnv("NEXT_PUBLIC_IMAGES_BASE_URL", "https://images.example.com/");
    expect(pokemonImageUrl("images/pikachu.png")).toBe("https://images.example.com/images/pikachu.png");
    expect(pokemonImageUrl(null)).toBe("");
    vi.stubEnv("NEXT_PUBLIC_IMAGES_BASE_URL", "");
    expect(pokemonImageUrl("images/pikachu.png")).toBe("");
  });

  it("uploads the file after the permit fields and saves the confirmed key", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ url: "https://s3.example.com", fields: { key: "uploads/raw.png", policy: "policy" }, key: "uploads/raw.png" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(Response.json({ key: "images/confirmed.png" }));
    vi.stubGlobal("fetch", fetch);
    const file = new File(["image"], "pikachu.png", { type: "image/png" });
    expect(await uploadPokemonImage(file)).toBe("images/confirmed.png");
    const upload = fetch.mock.calls[1];
    expect(upload[0]).toBe("https://s3.example.com");
    expect(Array.from((upload[1].body as FormData).keys())).toEqual(["key", "policy", "file"]);
    expect(upload[1].headers).toBeUndefined();
    expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({ key: "uploads/raw.png" });
  });

  it("does not confirm an unsuccessful upload", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ url: "https://s3.example.com", fields: {}, key: "uploads/raw.png" }))
      .mockResolvedValueOnce(new Response(null, { status: 403 }));
    vi.stubGlobal("fetch", fetch);
    await expect(uploadPokemonImage(new File(["image"], "p.png", { type: "image/png" }))).rejects.toThrow("The image upload failed.");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("rejects unsupported types and files larger than 2 MB before a request", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(uploadPokemonImage(new File(["image"], "p.gif", { type: "image/gif" }))).rejects.toThrow("PNG, JPEG, or WebP");
    await expect(uploadPokemonImage(new File([new Uint8Array(2 * 1024 * 1024 + 1)], "p.png", { type: "image/png" }))).rejects.toThrow("2 MB");
    expect(fetch).not.toHaveBeenCalled();
  });
});
