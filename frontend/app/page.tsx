"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import Sidebar, { type Facet } from "@/components/Sidebar";
import FilterBar from "@/components/FilterBar";
import PokemonCard from "@/components/PokemonCard";
import PokemonModal from "@/components/PokemonModal";
import { INITIAL_POKEMON, POKEMON_TYPES } from "@/lib/data";
import {
  normalizeUser,
  type FilterMode,
  type Pokemon,
  type PokemonInput,
} from "@/lib/types";
import { AuthBoundary } from "@/components/auth-boundary";
import { NavBar } from "@/components/nav-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <AuthBoundary>
      <NavBar />
      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <Card>
          <CardHeader><CardTitle className="text-2xl">Your Pokédex</CardTitle></CardHeader>
          <CardContent><p className="text-muted-foreground">Pokémon browsing and management will be available here.</p></CardContent>
        </Card>
      </main>
    </AuthBoundary>
  );
}

const ROWS_PER_PAGE = 10;
const MAX_PAGE_BUTTONS = 20;

function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {}
    setReady(true);
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value, ready]);

  return [value, setValue] as const;
}

function useColumns() {
  const [columns, setColumns] = useState(3);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setColumns(w >= 1024 ? 3 : w >= 640 ? 2 : 1);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return columns;
}

type ModalState = { open: false } | { open: true; editing: Pokemon | null };

export default function Home() {
  const [pokemon, setPokemon] = useLocalStorage<Pokemon[]>(
    "pokedex:v3:pokemon",
    INITIAL_POKEMON,
  );

  const [user, setUser] = useLocalStorage<string | null>(
    "pokedex:v2:user",
    null,
  );
  const [mode, setMode] = useState<FilterMode>("ALL");
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [page, setPage] = useState(1);

  const userId = user ? normalizeUser(user) : null;
  const ownsCard = (p: Pokemon) => userId !== null && p.ownerId === userId;

  const allTypes = useMemo(() => {
    const extra = pokemon
      .flatMap((p) => p.types)
      .filter((t) => !POKEMON_TYPES.includes(t));
    return [...POKEMON_TYPES, ...Array.from(new Set(extra))];
  }, [pokemon]);

  const classifications = useMemo(
    () => Array.from(new Set(pokemon.map((p) => p.classification))).sort(),
    [pokemon],
  );

  const facets: Facet[] = useMemo(() => {
    if (mode === "CLASSIFICATION") {
      return classifications.map((label) => ({
        label,
        count: pokemon.filter((p) => p.classification === label).length,
      }));
    }
    return allTypes.map((label) => ({
      label,
      count: pokemon.filter((p) => p.types.includes(label)).length,
    }));
  }, [mode, allTypes, classifications, pokemon]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pokemon.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q)) return false;
      if (selected) {
        if (mode === "CLASSIFICATION") return p.classification === selected;
        return p.types.includes(selected);
      }
      return true;
    });
  }, [pokemon, query, mode, selected]);

  const columns = useColumns();
  const pageSize = ROWS_PER_PAGE * columns;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const paged = filtered.slice(startIndex, startIndex + pageSize);

  const firstButton = Math.min(
    Math.max(1, currentPage - Math.floor(MAX_PAGE_BUTTONS / 2)),
    Math.max(1, totalPages - MAX_PAGE_BUTTONS + 1),
  );
  const lastButton = Math.min(totalPages, firstButton + MAX_PAGE_BUTTONS - 1);
  const pageNumbers = Array.from(
    { length: lastButton - firstButton + 1 },
    (_, i) => firstButton + i,
  );

  function goToPage(n: number) {
    setPage(Math.min(Math.max(1, n), totalPages));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function changeMode(next: FilterMode) {
    setMode(next);
    setSelected(null);
    setPage(1);
  }

  function selectFacet(label: string | null) {
    if (mode === "ALL" && label) setMode("TYPES");
    setSelected(label);
    setPage(1);
  }

  function savePokemon(data: PokemonInput) {
    if (!userId) return;
    if (modal.open && modal.editing) {
      const id = modal.editing.id;
      setPokemon((list) =>
        list.map((p) =>
          p.id === id && p.ownerId === userId ? { ...p, ...data } : p,
        ),
      );
    } else {
      setPokemon((list) => [
        { id: crypto.randomUUID(), ownerId: userId, ...data },
        ...list,
      ]);
      setPage(1);
    }
    setModal({ open: false });
  }

  function deletePokemon(p: Pokemon) {
    if (!ownsCard(p)) return;
    if (window.confirm(`Delete ${p.name}?`)) {
      setPokemon((list) => list.filter((x) => x.id !== p.id));
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <Header
        user={user}
        onMenuClick={() => setSidebarOpen((o) => !o)}
        onSignIn={setUser}
        onSignOut={() => {
          setUser(null);
          setModal({ open: false });
        }}
      />

      <div className="mt-2 flex">
        <Sidebar
          mode={mode}
          facets={facets}
          selected={selected}
          open={sidebarOpen}
          onSelect={selectFacet}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8">
          <FilterBar
            mode={mode}
            query={query}
            canAdd={userId !== null}
            onModeChange={changeMode}
            onQueryChange={(q) => {
              setQuery(q);
              setPage(1);
            }}
            onAdd={() => setModal({ open: true, editing: null })}
          />

          {filtered.length === 0 ? (
            <div className="mt-16 text-center text-gray-500">
              <p className="text-lg font-bold tracking-widest">
                NO POKÉMON FOUND
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setSelected(null);
                  setPage(1);
                }}
                className="mt-4 rounded-full bg-gray-200 px-5 py-2 text-xs font-bold tracking-widest hover:bg-gray-300"
              >
                CLEAR FILTERS
              </button>
            </div>
          ) : (
            <>
              <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {paged.map((p) => (
                  <PokemonCard
                    key={p.id}
                    pokemon={p}
                    canEdit={ownsCard(p)}
                    isLoggedIn={userId !== null}
                    onOpen={(x) => setModal({ open: true, editing: x })}
                    onDelete={deletePokemon}
                  />
                ))}
              </div>

              <p className="mt-6 text-center text-xs text-gray-500">
                Showing {startIndex + 1}–{startIndex + paged.length} of{" "}
                {filtered.length}
              </p>

              {totalPages > 1 && (
                <nav
                  aria-label="Pagination"
                  className="mt-3 flex flex-wrap items-center justify-center gap-2"
                >
                  <button
                    type="button"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="rounded-full bg-gray-200 px-4 py-2 text-xs font-bold tracking-widest text-gray-700 hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    PREV
                  </button>

                  {pageNumbers.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => goToPage(n)}
                      aria-current={n === currentPage ? "page" : undefined}
                      className={`h-9 min-w-9 rounded-full px-3 text-xs font-bold transition ${
                        n === currentPage
                          ? "bg-yellow-600 text-white shadow"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      {n}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="rounded-full bg-gray-200 px-4 py-2 text-xs font-bold tracking-widest text-gray-700 hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    NEXT
                  </button>
                </nav>
              )}
            </>
          )}
        </main>
      </div>

      {modal.open && (
        <PokemonModal
          key={modal.editing?.id ?? "new"}
          editing={modal.editing}
          readOnly={modal.editing ? !ownsCard(modal.editing) : false}
          types={allTypes}
          classifications={classifications}
          onSave={savePokemon}
          onClose={() => setModal({ open: false })}
        />
      )}
    </div>
  );
}
