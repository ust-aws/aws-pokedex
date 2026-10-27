import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/components/auth-provider";
import { AuthBoundary } from "@/components/auth-boundary";
import { AuthForm } from "@/components/auth-form";
import { NavBar } from "@/components/nav-bar";
import { TOKEN_KEY } from "@/lib/session";

const navigation = vi.hoisted(() => ({ pathname: "/", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => navigation,
}));

const user = { id: "user-id", email: "boss@example.com", username: "boss", role: "user" };
function sessionResponse(role = "user") { return Response.json({ user: { ...user, role } }); }
function Protected({ admin = false }: { admin?: boolean }) {
  return <AuthProvider><AuthBoundary admin={admin}><NavBar /><p>Protected content</p></AuthBoundary></AuthProvider>;
}
function Form({ mode = "login" }: { mode?: "login" | "register" }) {
  return <AuthProvider><AuthBoundary guest><AuthForm mode={mode} /></AuthBoundary></AuthProvider>;
}
function SessionControls() {
  const auth = useAuth();
  return <><span>{auth.status}</span><button onClick={auth.logout}>End session</button></>;
}

beforeEach(() => { navigation.pathname = "/"; });

describe("session and route guards", () => {
  it("redirects anonymous visitors without showing protected content", async () => {
    render(<Protected />);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("restores the current user and clears the session on logout", async () => {
    localStorage.setItem(TOKEN_KEY, "saved");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sessionResponse()));
    render(<Protected />);
    expect(await screen.findByText("Protected content")).toBeInTheDocument();
    expect(screen.getByText("boss")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Log out" }));
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
    expect(navigation.replace).toHaveBeenCalledWith("/login");
  });

  it("redirects a regular user away from the admin page", async () => {
    navigation.pathname = "/admin/";
    localStorage.setItem(TOKEN_KEY, "saved");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sessionResponse()));
    render(<Protected admin />);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/"));
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("allows an admin and shows the Admin link", async () => {
    localStorage.setItem(TOKEN_KEY, "saved");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sessionResponse("admin")));
    render(<Protected admin />);
    expect(await screen.findByText("Protected content")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Admin" })).toHaveAttribute("href", "/admin");
  });

  it("revalidates the role after a protected route change", async () => {
    localStorage.setItem(TOKEN_KEY, "saved");
    const fetch = vi.fn().mockResolvedValueOnce(sessionResponse("admin")).mockResolvedValueOnce(sessionResponse());
    vi.stubGlobal("fetch", fetch);
    const view = render(<Protected admin />);
    await screen.findByText("Protected content");
    navigation.pathname = "/admin/";
    view.rerender(<Protected admin />);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/"));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("keeps the token after a network error and supports Retry", async () => {
    localStorage.setItem(TOKEN_KEY, "saved");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new TypeError("Offline")).mockResolvedValueOnce(sessionResponse()));
    render(<Protected />);
    expect(await screen.findByText("Cannot check your session")).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBe("saved");
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Protected content")).toBeInTheDocument();
  });

  it("redirects when the API rejects an expired token", async () => {
    localStorage.setItem(TOKEN_KEY, "expired");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Expired" }, { status: 401 })));
    render(<Protected />);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/login"));
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it("does not restore an earlier request after logout", async () => {
    localStorage.setItem(TOKEN_KEY, "saved");
    let resolve!: (value: Response) => void;
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise<Response>((done) => { resolve = done; })));
    render(<AuthProvider><SessionControls /></AuthProvider>);
    await userEvent.click(screen.getByRole("button", { name: "End session" }));
    await act(async () => resolve(sessionResponse()));
    expect(screen.getByText("anonymous")).toBeInTheDocument();
  });

  it("synchronizes logout from another tab", async () => {
    localStorage.setItem(TOKEN_KEY, "saved");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sessionResponse()));
    render(<Protected />);
    await screen.findByText("Protected content");
    act(() => {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new StorageEvent("storage", { key: TOKEN_KEY, newValue: null }));
    });
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it.each(["login", "register"] as const)("redirects signed-in visitors from %s", async (mode) => {
    navigation.pathname = `/${mode}`;
    localStorage.setItem(TOKEN_KEY, "saved");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sessionResponse()));
    render(<Form mode={mode} />);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/"));
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });
});

describe("auth forms", () => {
  beforeEach(() => { navigation.pathname = "/login"; });

  async function fill(mode: "login" | "register" = "login") {
    const actor = userEvent.setup();
    await actor.type(await screen.findByLabelText("Email"), " Boss@Example.com ");
    if (mode === "register") await actor.type(screen.getByLabelText("Username"), " boss ");
    await actor.type(screen.getByLabelText("Password", { exact: true }), " password ");
    return actor;
  }

  it.each(["login", "register"] as const)("submits %s, stores the token, and redirects home", async (mode) => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ token: "new-token", user })).mockImplementation(() => Promise.resolve(sessionResponse()));
    vi.stubGlobal("fetch", fetch);
    render(<Form mode={mode} />);
    const actor = await fill(mode);
    await actor.click(screen.getByRole("button", { name: mode === "login" ? "Log in" : "Create an account" }));
    await waitFor(() => expect(localStorage.getItem(TOKEN_KEY)).toBe("new-token"));
    expect(navigation.replace).toHaveBeenCalledWith("/");
    expect(fetch.mock.calls[0][0]).toBe(`http://localhost:5000/auth/${mode}`);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ email: "boss@example.com", password: " password ", ...(mode === "register" ? { username: "boss" } : {}) });
  });

  it("validates empty registration fields without a request", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<Form mode="register" />);
    await userEvent.click(await screen.findByRole("button", { name: "Create an account" }));
    expect(screen.getByText("Enter a username.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByLabelText("Password", { exact: true })).toHaveAttribute("aria-invalid", "true");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows wrong-password errors without navigation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Invalid email or password." }, { status: 401 })));
    render(<Form />);
    const actor = await fill();
    await actor.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("Invalid email or password.")).toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("shows duplicate registration errors beside email and username", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "The email or username already exists." }, { status: 409 })));
    render(<Form mode="register" />);
    const actor = await fill("register");
    await actor.click(screen.getByRole("button", { name: "Create an account" }));
    expect(await screen.findAllByText("The email or username already exists.")).toHaveLength(2);
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  });

  it("maps API validation errors to fields", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "email: Invalid email address" }, { status: 400 })));
    render(<Form mode="register" />);
    const actor = await fill("register");
    await actor.click(screen.getByRole("button", { name: "Create an account" }));
    expect(await screen.findByText("Invalid email address")).toBeInTheDocument();
  });

  it("shows the password and prevents duplicate submissions while pending", async () => {
    let resolve!: (value: Response) => void;
    const fetch = vi.fn().mockImplementationOnce(() => new Promise<Response>((done) => { resolve = done; }));
    vi.stubGlobal("fetch", fetch);
    render(<Form />);
    const actor = await fill();
    await actor.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password", { exact: true })).toHaveAttribute("type", "text");
    const form = screen.getByRole("form", { name: "Log in" });
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Please wait…" })).toBeDisabled();
    await act(async () => resolve(Response.json({ error: "Invalid email or password." }, { status: 401 })));
  });
});
