export const TOKEN_KEY = "pokedex.token";
export const SESSION_CHANGED = "pokedex:session-changed";

export function getToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event(SESSION_CHANGED));
}

export function subscribeToToken(callback: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === TOKEN_KEY || event.key === null) callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(SESSION_CHANGED, callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SESSION_CHANGED, callback);
  };
}
