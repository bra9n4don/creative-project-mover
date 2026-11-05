import { render, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const { rpc, navigate } = vi.hoisted(() => ({ rpc: vi.fn(), navigate: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ isSignedIn: false }) }));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock("@/integrations/lovable/index", () => ({ lovable: { auth: {} } }));
import { AuthPage } from "./auth-page";

afterEach(() => { cleanup(); vi.clearAllMocks(); window.history.replaceState({}, "", "/"); });

describe("private sign-in claim access", () => {
  it("never requests workspace claim state for an anonymous sign-in visitor", async () => {
    render(<AuthPage mode="in" />);
    await waitFor(() => expect(document.querySelector('input[type="email"]')).not.toBeNull());
    expect(rpc).not.toHaveBeenCalled();
  });
  it("redirects public signup without requesting claim state", async () => {
    render(<AuthPage mode="up" />);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ href: "/sign-in" }));
    expect(rpc).not.toHaveBeenCalled();
  });
  it("preserves the linked-sign-in signup path without requesting claim state", async () => {
    window.history.replaceState({}, "", "/sign-up?link=1");
    render(<AuthPage mode="up" />);
    await waitFor(() => expect(document.querySelector('input[type="email"]')).not.toBeNull());
    expect(navigate).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});