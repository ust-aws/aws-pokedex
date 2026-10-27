"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

/** List pages keep value in the URL and reset page to 1 in onSearch. */
export function SearchBar({ value, onSearch, placeholder = "Search…" }: {
  value: string;
  onSearch: (query: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState(value);
  const callback = useRef(onSearch);
  useEffect(() => { callback.current = onSearch; }, [onSearch]);

  useEffect(() => {
    if (query === value) return;
    const timer = window.setTimeout(() => callback.current(query), 300);
    return () => window.clearTimeout(timer);
  }, [query, value]);

  // A parent value change (for example, browser Back) replaces pending input.
  const [previousValue, setPreviousValue] = useState(value);
  if (previousValue !== value) {
    setPreviousValue(value);
    setQuery(value);
  }

  return <Input type="search" aria-label="Search" placeholder={placeholder} value={query} onChange={(event) => setQuery(event.target.value)} />;
}
