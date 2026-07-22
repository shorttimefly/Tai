import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

const storage = new Map();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    clear: () => storage.clear(),
    getItem: (key) => storage.get(key) ?? null,
    removeItem: (key) => storage.delete(key),
    setItem: (key, value) => storage.set(key, String(value)),
  },
});

afterEach(() => {
  cleanup();
  storage.clear();
});

Object.defineProperty(window, "scrollTo", {
  configurable: true,
  value: () => {},
});
