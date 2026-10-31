"use client";

import { useEffect, useState } from "react";
import type { Pokemon, PokemonInput } from "@/lib/types";
import PokemonImage from "./PokemonImage";

type Props = {
  editing: Pokemon | null;
  readOnly: boolean;
  types: string[];
  classifications: string[];
  onSave: (data: PokemonInput) => void;
  onClose: () => void;
};

const inputClass =
  "w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-yellow-400 disabled:bg-gray-50 disabled:text-gray-600";

export default function PokemonModal({
  editing,
  readOnly,
  types,
  classifications,
  onSave,
  onClose,
}: Props) {
  const [name, setName] = useState(editing?.name ?? "");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    editing?.types ?? [],
  );
  const [classification, setClassification] = useState(
    editing?.classification ?? "",
  );
  const [description, setDescription] = useState(editing?.description ?? "");
  const [image, setImage] = useState(editing?.image ?? "");
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggleType(t: string) {
    setSelectedTypes((cur) =>
      cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t],
    );
  }

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setError("");
      setImage(String(reader.result));
    };
    reader.readAsDataURL(file);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (selectedTypes.length === 0) {
      setError("Pick at least one type.");
      return;
    }
    onSave({
      name: name.trim(),
      types: selectedTypes,
      classification: classification.trim() || "Unknown Pokémon",
      description: description.trim(),
      image: image.trim(),
    });
  }

  const isDataUrl = image.startsWith("data:");
  const title = readOnly
    ? "POKÉMON DETAILS"
    : editing
      ? "EDIT POKÉMON"
      : "ADD POKÉMON";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-xl"
      >
        <h2 className="mb-1 text-xl font-black tracking-widest text-red-500">
          {title}
        </h2>
        {editing && (
          <p className="mb-3 text-xs text-gray-500">
            Created by <b>{editing.ownerId}</b>. Only they can edit this card.
          </p>
        )}

        <div className="mb-4 mt-3 flex h-32 items-center justify-center rounded-2xl bg-gray-50">
          <PokemonImage src={image} alt="Preview" className="h-28 w-28" />
        </div>

        <fieldset disabled={readOnly} className="space-y-3">
          <label className="block text-xs font-bold tracking-wider text-gray-600">
            NAME
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${inputClass} mt-1`}
              placeholder="Who is that pokemon?"
              autoFocus={!readOnly}
            />
          </label>

          <div>
            <p className="text-xs font-bold tracking-wider text-gray-600">
              TYPES{" "}
              {!readOnly && (
                <span className="font-normal text-gray-400">
                  (pick one or more)
                </span>
              )}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {types.map((t) => {
                const on = selectedTypes.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleType(t)}
                    aria-pressed={on}
                    className={`rounded-full px-3 py-1 text-[11px] font-bold tracking-wider transition disabled:cursor-default ${
                      on
                        ? "bg-red-500 text-white"
                        : "bg-gray-200 text-gray-600 enabled:hover:bg-gray-300"
                    } ${readOnly && !on ? "hidden" : ""}`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block text-xs font-bold tracking-wider text-gray-600">
            CLASSIFICATION
            <input
              value={classification}
              onChange={(e) => setClassification(e.target.value)}
              list="classification-options"
              className={`${inputClass} mt-1`}
              placeholder="Classification"
            />
            <datalist id="classification-options">
              {classifications.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>

          <label className="block text-xs font-bold tracking-wider text-gray-600">
            DESCRIPTION
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={500}
              className={`${inputClass} mt-1 resize-y font-normal`}
              placeholder={
                readOnly ? "No description." : "Tell us about this Pokémon…"
              }
            />
            {!readOnly && (
              <span className="mt-1 block text-right text-[10px] font-normal text-gray-400">
                {description.length}/500
              </span>
            )}
          </label>

          {!readOnly && (
            <>
              <label className="block text-xs font-bold tracking-wider text-gray-600">
                IMAGE URL
                <input
                  value={isDataUrl ? "" : image}
                  onChange={(e) => setImage(e.target.value)}
                  className={`${inputClass} mt-1`}
                  placeholder={isDataUrl ? "Using uploaded file" : "https://…"}
                />
              </label>

              <label className="block text-xs font-bold tracking-wider text-gray-600">
                …OR UPLOAD A FILE
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                  className="mt-1 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-yellow-400 file:px-4 file:py-2 file:text-xs file:font-bold file:text-white hover:file:bg-yellow-500"
                />
              </label>
            </>
          )}
        </fieldset>

        {error && (
          <p className="mt-3 text-sm font-bold text-red-500" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-gray-200 px-5 py-2 text-xs font-bold tracking-widest text-gray-700 hover:bg-gray-300"
          >
            {readOnly ? "CLOSE" : "CANCEL"}
          </button>
          {!readOnly && (
            <button
              type="submit"
              className="rounded-full bg-red-500 px-5 py-2 text-xs font-bold tracking-widest text-white hover:bg-red-600"
            >
              {editing ? "SAVE" : "ADD"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
