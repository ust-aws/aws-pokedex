"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { getToken, setToken, subscribeToToken } from "@/lib/session";
import type { AuthResponse, LoginInput, PublicUser, RegisterInput } from "@/lib/types";

type SessionState = {
  status: "loading" | "authenticated" | "anonymous" | "error";
  user: PublicUser | null;
};

type AuthContextValue = SessionState & {
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
  retry: () => void;
};

type CheckedSession = SessionState & { token: string | null; pathname: string };
const AuthContext = createContext<AuthContextValue | null>(null);
const serverToken = () => null;
const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const hydrated = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);
  const token = useSyncExternalStore(subscribeToToken, getToken, serverToken);
  const generation = useRef(0);
  const [checked, setChecked] = useState<CheckedSession | null>(null);

  const invalidate = useCallback(() => { ++generation.current; }, []);
  const validate = useCallback(() => {
    const current = ++generation.current;
    if (!token) return;
    return api<{ user: PublicUser }>("/auth/me").then(({ user }) => {
      if (current === generation.current && getToken() === token) {
        setChecked({ token, pathname, status: "authenticated", user });
      }
    }).catch((error: unknown) => {
      if (current !== generation.current || getToken() !== token) return;
      setChecked({ token, pathname, status: error instanceof ApiError && error.status === 401 ? "anonymous" : "error", user: null });
    });
  }, [pathname, token]);

  useEffect(() => {
    void validate();
    return invalidate;
  }, [validate, invalidate]);

  // A changed token or route hides the old session before validation completes.
  const session: SessionState = !hydrated ? { status: "loading", user: null }
    : !token ? { status: "anonymous", user: null }
    : checked?.token === token && checked.pathname === pathname ? checked
    : { status: "loading", user: null };

  async function authenticate(path: string, input: LoginInput | RegisterInput) {
    const current = ++generation.current;
    const startingToken = getToken();
    const result = await api<AuthResponse>(path, { method: "POST", body: input, auth: false });
    if (current !== generation.current || getToken() !== startingToken) return;
    setToken(result.token);
    setChecked({ token: result.token, pathname, status: "authenticated", user: result.user });
    router.replace("/");
  }

  function logout() {
    invalidate();
    setToken(null);
    router.replace("/login");
  }

  function retry() {
    setChecked(null);
    void validate();
  }

  return (
    <AuthContext.Provider value={{
      ...session,
      login: (input) => authenticate("/auth/login", input),
      register: (input) => authenticate("/auth/register", input),
      logout,
      retry,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth requires AuthProvider.");
  return context;
}
