"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AuthBoundary({ children, admin = false, guest = false }: {
  children: React.ReactNode;
  admin?: boolean;
  guest?: boolean;
}) {
  const { status, user, retry, logout } = useAuth();
  const router = useRouter();
  const destination = status === "anonymous" && !guest ? "/login"
    : status === "authenticated" && (guest || (admin && user?.role !== "admin")) ? "/" : null;

  useEffect(() => {
    if (destination) router.replace(destination);
  }, [destination, router]);

  if (status === "error") {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader><CardTitle>Cannot check your session</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p role="alert">The API is unavailable. Retry or log out.</p>
            <div className="flex gap-2"><Button onClick={retry}>Retry</Button><Button variant="outline" onClick={logout}>Log out</Button></div>
          </CardContent>
        </Card>
      </main>
    );
  }
  if (status === "loading" || destination) {
    return <main className="flex flex-1 items-center justify-center p-6"><p role="status">Please wait…</p></main>;
  }
  return children;
}
