"use client"

import { AuthBoundary } from "@/components/auth-boundary";
import { NavBar } from "@/components/nav-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserTable } from "@/components/user-table";
import { SearchBar } from "@/components/search-bar";
import { Pagination } from "@/components/pagination";
import { Suspense, useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";

type User = {
  id: string;
  email: string;
  username: string;
  role: "user" | "admin";
  createdAt: string;
};

const PAGE_SIZE = 20;

function AdminContent() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const params = useSearchParams();
  const search = params.get("search") ?? ""

  const requestedPage = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);

  const onSearch = (query: string) => {
    const trimmed = query.trim();
    router.replace(trimmed ? `/admin/?search=${encodeURIComponent(trimmed)}` : "/admin/", {
      scroll: false,
    });
  }

  const filtered = useMemo(() => {
    if (!users) return [];
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [users, search]);

  useEffect(() => {
    let cancelled = false;

    api<{ items: User[] }>("/admin/users")
      .then((data) => {
        if (!cancelled) setUsers(data.items);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Could not load users.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);

  const visible = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  const navigate = (next: { search?: string; page?: number }) => {
    const qs = new URLSearchParams();
    const s = (next.search ?? search).trim();
    const p = next.page ?? page;
    if (s) qs.set("search", s);
    if (p > 1) qs.set("page", String(p));
    const query = qs.toString();
    router.replace(query ? `/admin/?${query}` : "/admin/", { scroll: false });
  };

  const handleSearch = (query: string) => navigate({ search: query, page: 1 });
  const handlePageChange = (p: number) => navigate({ page: p });

  return (
    <AuthBoundary admin>
      <NavBar />
      <main className="mx-auto w-full max-w-6xl px-6 py-10">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Administration</CardTitle>
              <SearchBar value={search} onSearch={onSearch}/>
            </CardHeader>
            <CardContent>
              {
                (error) ? (<p>{error}</p>) : 
                (!filtered) ? (<p>Loading...</p>) :
                (filtered.length === 0) ? (<p>No users found.</p>) :
                (<UserTable users={visible} />)
              }
            </CardContent>

            {users && (
              <Pagination
                total={filtered.length}
                page={page}
                pageSize={PAGE_SIZE}
                onPageChange={handlePageChange}
              />
            )}
          </Card>
      </main>
    </AuthBoundary>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminContent />
    </Suspense>
  );
}