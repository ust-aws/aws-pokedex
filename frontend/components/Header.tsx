"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/components/auth-provider";

function AuthMenu() {
  const { status, user, login, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const displayName = user?.username ?? null;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const mail = email.trim();
    if (!mail || !password || loading) return;

    setLoading(true);
    setError(null);
    try {
      await login({ email: mail, password });
      setEmail("");
      setPassword("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="User profile"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full p-1 text-white transition hover:bg-yellow-300"
      >
        {displayName && (
          <span className="hidden max-w-28 truncate text-xs font-black tracking-widest sm:block">
            {displayName}
          </span>
        )}
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-9 w-9 sm:h-11 sm:w-11"
        >
          <circle cx="12" cy="7.5" r="4.5" />
          <path d="M3 21c0-4.4 3.6-7.5 9-7.5s9 3.1 9 7.5v.5H3V21z" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl bg-white p-4 text-gray-800 shadow-xl ring-1 ring-gray-200">
          {status === "loading" ? (
            <p className="text-xs font-bold tracking-wider text-gray-500">
              LOADING...
            </p>
          ) : status === "authenticated" && displayName ? (
            <>
              <p className="text-xs font-bold tracking-wider text-gray-500">
                SIGNED IN AS
              </p>
              <p className="mt-1 truncate text-lg font-black tracking-widest">
                {displayName}
              </p>

              <button
                type="button"
                onClick={() => {
                  logout();
                  setOpen(false);
                }}
                className="mt-4 w-full rounded-full bg-gray-200 py-2 text-xs font-bold tracking-widest hover:bg-gray-300"
              >
                SIGN OUT
              </button>
            </>
          ) : (
            <form onSubmit={submit}>
              <p className="text-xs font-bold tracking-wider text-gray-500">
                SIGN IN
              </p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                aria-label="Email"
                autoComplete="email"
                autoFocus
                className="mt-2 w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm outline-none focus:border-yellow-400"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                aria-label="Password"
                autoComplete="current-password"
                className="mt-2 w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm outline-none focus:border-yellow-400"
              />
              {error && (
                <p role="alert" className="mt-2 text-xs font-bold text-red-500">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="mt-3 w-full rounded-full bg-red-500 py-2 text-xs font-bold tracking-widest text-white hover:bg-red-600 disabled:opacity-60"
              >
                {loading ? "SIGNING IN..." : "SIGN IN"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

type Props = {
  onMenuClick: () => void;
};

export default function Header({ onMenuClick }: Props) {
  return (
    <header className="relative flex h-16 items-center justify-between bg-yellow-400 px-4 sm:h-20 sm:px-8">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Toggle type menu"
        className="flex h-10 w-10 flex-col items-center justify-center gap-2 rounded-md transition hover:bg-yellow-300 md:pointer-events-none"
      >
        <span className="block h-0.5 w-8 bg-white" />
        <span className="block h-0.5 w-8 bg-white" />
        <span className="block h-0.5 w-8 bg-white" />
      </button>

      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pt-2 sm:pt-3">
        <Image
          src="/aws-pokedex.png"
          alt="AWS - Pokédex"
          width={1417}
          height={944}
          priority
          className="h-12 w-auto object-contain sm:h-50"
        />
      </div>

      <AuthMenu />
    </header>
  );
}
