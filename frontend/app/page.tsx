"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import FilterBar from "@/components/FilterBar";
import PokemonCard from "@/components/PokemonCard";
import PokemonModal from "@/components/PokemonModal";
import { Pagination } from "@/components/pagination";
import { AuthBoundary } from "@/components/auth-boundary";
import { useAuth } from "@/components/auth-provider";
import { api } from "@/lib/api";
import { POKEMON_TYPES } from "@/lib/data";
import type { PaginatedResponse, Pokemon, PokemonInput } from "@/lib/types";

type ModalState = { open: false } | { open: true; editing: Pokemon | null };

function PokemonPage() {
  const { user } = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const query = params.get("q") ?? "";
  const selected = params.get("type") ?? "";
  const rawPage = Number(params.get("page") ?? 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const request = new URLSearchParams({ q: query, type: selected, page: String(page) }).toString();
  const [result, setResult] = useState<{ request: string; data: PaginatedResponse<Pokemon> } | null>(null);
  const [failure, setFailure] = useState<{ request: string; message: string } | null>(null);
  const [revision, setRevision] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [actionError, setActionError] = useState("");
  const [deleting, setDeleting] = useState(false);

  function updateParams(values: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    api<PaginatedResponse<Pokemon>>(`/pokemon?${request}`, { signal: controller.signal })
      .then((data) => {
        if (active) {
          setResult({ request, data });
          setFailure(null);
        }
      })
      .catch((error: unknown) => {
        if (active) setFailure({ request, message: error instanceof Error ? error.message : "Cannot load Pokémon." });
      });
    return () => { active = false; controller.abort(); };
  }, [request, revision]);

  const data = result?.request === request ? result.data : null;
  const error = failure?.request === request ? failure.message : null;
  const canEdit = (pokemon: Pokemon) => user !== null && (pokemon.createdBy === user.id || user.role === "admin");

  function refresh() {
    setResult(null);
    setFailure(null);
    setRevision((value) => value + 1);
  }

  async function savePokemon(input: PokemonInput) {
    if (!user) throw new Error("Sign in to save Pokémon.");
    const editing = modal.open ? modal.editing : null;
    await api<Pokemon>(editing ? `/pokemon/${editing.id}` : "/pokemon", {
      method: editing ? "PATCH" : "POST",
      body: editing || input.imageKey !== null ? input : { ...input, imageKey: undefined },
    });
    setModal({ open: false });
    refresh();
  }

  async function deletePokemon(pokemon: Pokemon) {
    if (!canEdit(pokemon) || deleting || !window.confirm(`Delete ${pokemon.name}?`)) return;
    setDeleting(true);
    setActionError("");
    try {
      await api<void>(`/pokemon/${pokemon.id}`, { method: "DELETE" });
      if (data?.items.length === 1 && page > 1) updateParams({ page: String(page - 1) });
      refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Cannot delete Pokémon.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <Header onMenuClick={() => setSidebarOpen((open) => !open)} />
      <div className="mt-2 flex">
        <Sidebar facets={POKEMON_TYPES.map((label) => ({ label }))} selected={selected || null}
          open={sidebarOpen} onSelect={(type) => updateParams({ type: type ?? "", page: "1" })}
          onClose={() => setSidebarOpen(false)} />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8">
          <FilterBar mode={selected ? "TYPES" : "ALL"} query={query} canAdd={user !== null}
            onModeChange={(mode) => {
              if (mode === "TYPES") setSidebarOpen(true);
              else updateParams({ type: "", page: "1" });
            }}
            onQueryChange={(q) => updateParams({ q, page: "1" })}
            onAdd={() => setModal({ open: true, editing: null })} />
          {actionError && <p role="alert" className="mt-4 text-red-600">{actionError}</p>}
          {error ? <div className="mt-8"><p role="alert">{error}</p><button onClick={refresh}>Retry</button></div>
            : !data ? <p role="status" className="mt-8">Loading Pokémon…</p>
            : data.items.length === 0 ? <div className="mt-16 text-center text-gray-500">
              <p>NO POKÉMON FOUND</p>
              <button onClick={() => updateParams({ q: "", type: "", page: "1" })}>CLEAR FILTERS</button>
            </div> : <>
              <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-busy={deleting}>
                {data.items.map((pokemon) => <PokemonCard key={pokemon.id} pokemon={pokemon}
                  canEdit={canEdit(pokemon)} isLoggedIn={user !== null}
                  onOpen={(editing) => setModal({ open: true, editing })} onDelete={deletePokemon} />)}
              </div>
              <p className="my-6 text-center text-xs text-gray-500">
                Showing {(data.page - 1) * data.pageSize + 1}–{(data.page - 1) * data.pageSize + data.items.length} of {data.total}
              </p>
            </>}
          {data && <Pagination total={data.total} page={data.page} pageSize={data.pageSize}
            onPageChange={(next) => updateParams({ page: String(next) })} />}
        </main>
      </div>
      {modal.open && <PokemonModal key={modal.editing?.id ?? "new"} editing={modal.editing}
        readOnly={modal.editing ? !canEdit(modal.editing) : false} types={POKEMON_TYPES}
        onSave={savePokemon} onClose={() => setModal({ open: false })} />}
    </div>
  );
}

export default function HomePage() {
  return <AuthBoundary><Suspense fallback={<p role="status">Loading Pokémon…</p>}><PokemonPage /></Suspense></AuthBoundary>;
}
