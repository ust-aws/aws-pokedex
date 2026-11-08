import { SearchBar } from "@/components/search-bar";
import type { FilterMode } from "@/lib/types";

const MODES: FilterMode[] = ["ALL", "TYPES"];

type Props = {
  mode: FilterMode;
  query: string;
  canAdd: boolean;
  onModeChange: (mode: FilterMode) => void;
  onQueryChange: (q: string) => void;
  onAdd: () => void;
};

export default function FilterBar({
  mode,
  query,
  canAdd,
  onModeChange,
  onQueryChange,
  onAdd,
}: Props) {
  return (
    <div className="border-b-2 border-gray-300 pb-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-2xl font-black tracking-widest text-yellow-700 sm:text-3xl">
          POKEMON CARDS
        </h2>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              aria-pressed={mode === m}
              className={`rounded-full px-5 py-2 text-xs font-bold tracking-widest transition ${
                mode === m
                  ? "bg-yellow-500 text-white shadow"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <SearchBar value={query} onSearch={onQueryChange} placeholder="Search Pokémon by name…" />
        </div>

        {canAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="rounded-full bg-yellow-400 px-6 py-2 text-sm font-black tracking-widest text-white shadow transition hover:bg-yellow-500"
          >
            + ADD POKÉMON
          </button>
        )}
      </div>
    </div>
  );
}
