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
