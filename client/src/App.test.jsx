import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const response = (data) => ({ ok: true, json: async () => ({ ok: true, data }) });

function renderAt(pathname) {
  window.history.replaceState({}, "", pathname);
  globalThis.fetch = vi.fn((url) => {
    if (String(url).includes("/events")) {
      return Promise.resolve(response([{ id: 1, title: "同城 AI 夜谈", start_time: "2026-08-01T11:00:00Z", location_name: "静安", capacity: 30, reg_count: 8, status: "published" }]));
    }
    return Promise.resolve(response([]));
  });
  return render(<App />);
}

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/events");
});

describe("AI City Circle application shell", () => {
  it("renders the four primary destinations in the approved order", () => {
    renderAt("/events");
    expect(screen.getByRole("navigation", { name: "主导航" })).toHaveTextContent("活动资讯交流我的");
  });

  it("shows an account-password login surface without verification code controls", () => {
    renderAt("/auth/login");
    expect(screen.getByRole("heading", { name: "欢迎回来" })).toBeInTheDocument();
    expect(screen.getByLabelText("账号")).toBeInTheDocument();
    expect(screen.getByLabelText("密码")).toBeInTheDocument();
    expect(screen.queryByText(/验证码/)).not.toBeInTheDocument();
  });

  it("opens an event detail route when the whole event card is selected", async () => {
    renderAt("/events");
    const card = await screen.findByRole("link", { name: /同城 AI 夜谈/ });
    fireEvent.click(card);
    expect(window.location.pathname).toBe("/events/1");
  });
});
