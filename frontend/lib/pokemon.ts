import { api } from "@/lib/api";

export function pokemonImageUrl(key: string | null): string {
  const base = process.env.NEXT_PUBLIC_IMAGES_BASE_URL;
  return key && base ? `${base.replace(/\/$/, "")}/${key}` : "";
}

export async function uploadPokemonImage(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("Select a PNG, JPEG, or WebP image.");
  }
  if (file.size > 2 * 1024 * 1024) throw new Error("The image must be 2 MB or smaller.");
  const permit = await api<{ url: string; fields: Record<string, string>; key: string }>("/uploads/presign", {
    method: "POST", body: { contentType: file.type },
  });
  const form = new FormData();
  for (const [name, value] of Object.entries(permit.fields)) form.append(name, value);
  form.append("file", file);
  const response = await fetch(permit.url, { method: "POST", body: form });
  if (!response.ok) throw new Error("The image upload failed. Try again.");
  const confirmed = await api<{ key: string }>("/uploads/confirm", { method: "POST", body: { key: permit.key } });
  return confirmed.key;
}
