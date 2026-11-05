import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
const mock = vi.hoisted(() => ({ getUser: vi.fn(), updateUser: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: mock } }));
vi.mock("@/integrations/lovable/index", () => ({ lovable: { auth: {} } }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
import { PasswordSignIn } from "./linked-logins";
beforeEach(() => {
  mock.getUser.mockReset().mockResolvedValue({ data: { user: { email: "synthetic@example.test" } } });
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network request"); }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("does not look up email during server rendering; mount effect looks up once", async () => {
  renderToString(<PasswordSignIn />);
  expect(mock.getUser).not.toHaveBeenCalled();
  render(<PasswordSignIn />);
  expect(await screen.findByText("synthetic@example.test")).toBeInTheDocument();
  expect(mock.getUser).toHaveBeenCalledOnce();
  fireEvent.change(screen.getByTestId("input-new-password"), { target: { value: "synthetic-password-only" } });
  expect(mock.getUser).toHaveBeenCalledOnce(); expect(fetch).not.toHaveBeenCalled();
});
it("handles a rejected effect lookup without displaying an invented email", async () => {
  mock.getUser.mockRejectedValue(new Error("Synthetic lookup failure"));
  render(<PasswordSignIn />);
  expect(await screen.findByText("your email")).toBeInTheDocument();
  expect(screen.getByTestId("button-save-password")).toBeDisabled();
});