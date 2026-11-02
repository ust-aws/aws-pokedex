import type { FilterMode } from "@/lib/types";

export type Facet = { label: string; count: number };

type Props = {
  mode: FilterMode;
  facets: Facet[];
  selected: string | null;
  open: boolean;
  onSelect: (label: string | null) => void;
  onClose: () => void;
};

export default function Sidebar({
  mode,
  facets,
  selected,
  open,
  onSelect,
  onClose,
}: Props) {
  const title = mode === "CLASSIFICATION" ? "CLASSIFICATION" : "POKEMON TYPE";

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform overflow-y-auto border-r-2 border-gray-300 bg-white px-6 pb-8 pt-24 transition-transform md:static md:z-auto md:w-60 md:translate-x-0 md:pt-8 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <h2 className="mb-6 text-center text-lg font-black tracking-widest text-yellow-800">
          {title}
        </h2>

        <ul className="space-y-1">
          {facets.map((f) => {
            const active = selected === f.label;
            return (
              <li key={f.label}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(active ? null : f.label);
                    onClose();
                  }}
                  aria-pressed={active}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-bold tracking-wide transition ${
                    active
                      ? "bg-red-500 text-white shadow"
                      : "text-gray-500 hover:bg-yellow-100 hover:text-gray-900"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        active ? "bg-white" : "bg-gray-400"
                      }`}
                    />
                    {f.label}
                  </span>
                  <span
                    className={`text-xs ${active ? "text-white" : "text-gray-400"}`}
                  >
                    {f.count}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>
    </>
  );
}
