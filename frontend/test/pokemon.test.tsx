import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "@/app/page";
import { AuthProvider } from "@/components/auth-provider";
import PokemonModal from "@/components/PokemonModal";
import { TOKEN_KEY } from "@/lib/session";
import type { Pokemon } from "@/lib/types";

const navigation = vi.hoisted(() => ({ search: "", push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => navigation,
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

const user = { id: "trainer-id", username: "Trainer", email: "trainer@example.com", role: "user" };
const pikachu: Pokemon = { id: "pokemon-id", name: "Pikachu", types: ["electric"], description: "Electric mouse", imageKey: null, createdBy: user.id, creatorUsername: user.username };
const other: Pokemon = { ...pikachu, id: "other-id", name: "Charmander", types: ["fire"], createdBy: "other-user", creatorUsername: "Other" };
const pageResponse = (items = [pikachu, other], total = items.length, page = 1) => Response.json({ items, total, page, pageSize: 20 });
function mockApi(handler: (url: string, init?: RequestInit) => Response | Promise<Response>, role = "user") {
  const fetch = vi.fn((url: string, init?: RequestInit) => Promise.resolve(url.endsWith("/auth/me") ? Response.json({ user: { ...user, role } }) : handler(url, init)));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
function Page() { return <AuthProvider><HomePage /></AuthProvider>; }

beforeEach(() => {
  navigation.search = "";
  localStorage.setItem(TOKEN_KEY, "saved-token");
  vi.stubGlobal("confirm", vi.fn(() => true));
});

describe("Pokémon page API integration", () => {
  it("loads backend records and limits edit controls to the creator", async () => {
    const fetch = mockApi(() => pageResponse());
    render(<Page />);
    expect(await screen.findByRole("button", { name: "Edit Pikachu" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View Charmander" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete Charmander" })).not.toBeInTheDocument();
    const call = fetch.mock.calls.find(([url]) => url.includes("/pokemon?"))!;
    expect(new Headers(call[1]?.headers).get("Authorization")).toBe("Bearer saved-token");
    await userEvent.click(screen.getByRole("button", { name: "View Charmander" }));
    expect(screen.getByLabelText("NAME")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "SAVE" })).not.toBeInTheDocument();
  });

  it("uses URL filters and the backend page size, and ignores a stale response", async () => {
    let resolve!: (response: Response) => void;
    const fetch = mockApi((url) => url.includes("q=old") ? new Promise<Response>((done) => { resolve = done; }) : pageResponse([pikachu], 41, 2));
    navigation.search = "q=old";
    const view = render(<Page />);
    await waitFor(() => expect(fetch.mock.calls.some(([url]) => url.includes("q=old"))).toBe(true));
    navigation.search = "q=Pika&type=electric&page=2";
    view.rerender(<Page />);
    expect(await screen.findByText("Page 2 of 3")).toBeInTheDocument();
    await act(async () => resolve(pageResponse([other])));
    expect(screen.queryByRole("button", { name: "View Charmander" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(navigation.push).toHaveBeenCalledWith("/?q=Pika&type=electric&page=3", { scroll: false });
    await userEvent.clear(screen.getByRole("searchbox"));
    await userEvent.type(screen.getByRole("searchbox"), "Char");
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/?q=Char&type=electric&page=1", { scroll: false }));
  });

  it("creates and updates records with API fields and preserves the form after an error", async () => {
    const fetch = mockApi((_url, init) => init?.method === "POST" ? Response.json({ error: "Save failed" }, { status: 500 }) : init?.method === "PATCH" ? Response.json(pikachu) : pageResponse());
    render(<Page />);
    await userEvent.click(await screen.findByRole("button", { name: "+ ADD POKÉMON" }));
    await userEvent.type(screen.getByLabelText("NAME"), "Eevee");
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "normal" }));
    await userEvent.click(screen.getByRole("button", { name: "ADD" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Save failed");
    const create = fetch.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(JSON.parse(create[1]?.body as string)).toEqual({ name: "Eevee", types: ["normal"], description: "" });
    await userEvent.click(screen.getByRole("button", { name: "CANCEL" }));
    await userEvent.click(screen.getByRole("button", { name: "Edit Pikachu" }));
    await userEvent.clear(screen.getByLabelText("NAME"));
    await userEvent.type(screen.getByLabelText("NAME"), "Raichu");
    await userEvent.click(screen.getByRole("button", { name: "SAVE" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const update = fetch.mock.calls.find(([, init]) => init?.method === "PATCH")!;
    expect(update[0]).toBe("http://localhost:5000/pokemon/pokemon-id");
    expect(JSON.parse(update[1]?.body as string)).toMatchObject({ name: "Raichu", imageKey: null });
  });

  it("allows admins to delete other creators' records and refreshes after 204", async () => {
    let deleted = false;
    const fetch = mockApi((_url, init) => {
      if (init?.method === "DELETE") { deleted = true; return new Response(null, { status: 204 }); }
      return pageResponse(deleted ? [pikachu] : [pikachu, other]);
    }, "admin");
    render(<Page />);
    await userEvent.click(await screen.findByRole("button", { name: "Delete Charmander" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Edit Charmander" })).not.toBeInTheDocument());
    expect(fetch.mock.calls.some(([url, init]) => url.endsWith("/pokemon/other-id") && init?.method === "DELETE")).toBe(true);
    expect(await screen.findByRole("button", { name: "Edit Pikachu" })).toBeInTheDocument();
  });

  it("shows API failures and retries without loading demo data", async () => {
    let failed = true;
    mockApi(() => failed ? Response.json({ error: "API unavailable" }, { status: 503 }) : pageResponse([]));
    render(<Page />);
    expect(await screen.findByRole("alert")).toHaveTextContent("API unavailable");
    failed = false;
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("NO POKÉMON FOUND")).toBeInTheDocument();
    expect(screen.queryByText("Bulbasaur")).not.toBeInTheDocument();
  });
});

it("limits Pokémon to two types and prevents repeated saves while pending", async () => {
  let resolve!: () => void;
  const save = vi.fn(() => new Promise<void>((done) => { resolve = done; }));
  render(<PokemonModal editing={null} readOnly={false} types={["fire", "flying", "water"]} onSave={save} onClose={vi.fn()} />);
  await userEvent.type(screen.getByLabelText("NAME"), "Charizard");
  await userEvent.click(screen.getByRole("button", { name: "fire" }));
  await userEvent.click(screen.getByRole("button", { name: "flying" }));
  expect(screen.getByRole("button", { name: "water" })).toBeDisabled();
  const form = screen.getByRole("dialog");
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(save).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "SAVING…" })).toBeDisabled();
  await act(async () => resolve());
});
