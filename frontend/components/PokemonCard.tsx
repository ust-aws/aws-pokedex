import type { Pokemon } from "@/lib/types";
import PokemonImage from "./PokemonImage";

type Props = {
  pokemon: Pokemon;
  canEdit: boolean;
  isLoggedIn: boolean;
  onOpen: (p: Pokemon) => void;
  onDelete: (p: Pokemon) => void;
};

export default function PokemonCard({
  pokemon,
  canEdit,
  isLoggedIn,
  onOpen,
  onDelete,
}: Props) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => onOpen(pokemon)}
        aria-label={`${canEdit ? "Edit" : "View"} ${pokemon.name}`}
        className="flex h-full w-full flex-col items-center rounded-3xl border-2 border-gray-200 bg-white px-4 pb-5 pt-6 text-center shadow-sm transition hover:-translate-y-1 hover:border-yellow-400 hover:shadow-md"
      >
        <div className="flex h-36 w-36 items-center justify-center sm:h-40 sm:w-40">
          <PokemonImage
            src={pokemon.image}
            alt={pokemon.name}
            className="h-full w-full"
          />
        </div>
        <h3 className="mt-3 text-lg font-black uppercase tracking-widest">
          {pokemon.name}
        </h3>

        <div className="mt-2 flex flex-wrap justify-center gap-2 text-[10px] font-bold uppercase tracking-wider">
          {pokemon.types.map((t) => (
            <span
              key={t}
              className="rounded-full bg-red-500 px-2.5 py-1 text-white"
            >
              {t}
            </span>
          ))}
          <span className="rounded-full bg-gray-200 px-2.5 py-1 text-gray-600">
            {pokemon.classification}
          </span>
        </div>

        {pokemon.description && (
          <p className="mt-3 line-clamp-3 text-xs font-normal leading-relaxed text-gray-500">
            {pokemon.description}
          </p>
        )}

        {isLoggedIn && (
          <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            By {pokemon.ownerId}
            {!canEdit && " · view only"}
          </p>
        )}
      </button>

      {canEdit && (
        <button
          type="button"
          onClick={() => onDelete(pokemon)}
          aria-label={`Delete ${pokemon.name}`}
          className="absolute right-3 top-3 rounded-full bg-white p-2 text-gray-400 shadow ring-1 ring-gray-200 transition hover:bg-red-500 hover:text-white focus:opacity-100 md:opacity-0 md:group-hover:opacity-100"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
          </svg>
        </button>
      )}
    </div>
  );
}
