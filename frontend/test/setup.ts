import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

beforeEach(() => {
  window.localStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:5000");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
