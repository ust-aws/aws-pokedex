"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";

export function NavBar() {
  const { user, logout } = useAuth();
  return (
    <header className="border-b">
      <nav aria-label="Main navigation" className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-4">
        <Link href="/" className="mr-auto text-xl font-semibold">AWS Pokédex</Link>
        <Link href="/" className="text-sm hover:underline">Home</Link>
        {user?.role === "admin" && <Link href="/admin" className="text-sm hover:underline">Admin</Link>}
        <span className="max-w-40 truncate text-sm text-muted-foreground">{user?.username}</span>
        <Button variant="outline" onClick={logout}>Log out</Button>
      </nav>
    </header>
  );
}
