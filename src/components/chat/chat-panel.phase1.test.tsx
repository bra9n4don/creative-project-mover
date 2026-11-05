import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mock = vi.hoisted(() => ({ threads: [] as { id: string; title: string }[], actions: { create: vi.fn(), refresh: vi.fn() } }));
vi.mock("@tanstack/react-router", () => ({ useRouterState: () => "/", Link: ({ children }: { children: ReactNode }) => <span>{children}</span> }));
vi.mock("./use-chat-threads", () => ({ useInbox: () => ({ data: [] }), useChatThreads: () => ({ data: mock.threads }), useChatThreadActions: () => mock.actions }));
vi.mock("./chat-window", () => ({ AgentMark: () => null, DOCK_ASK_EVENT: "mock-ask", setPendingDockAsk: vi.fn() }));
vi.mock("@/pages/chat", () => ({ ChatThreadView: ({ threadId, dock }: { threadId: string; dock: { leading: ReactNode } }) => <div><span data-testid="active-thread">{threadId}</span>{dock.leading}</div> }));
import { ChatDock } from "./chat-panel";

beforeEach(() => {
  localStorage.clear(); localStorage.setItem("carterhub.chatDock.mini", "0");
  mock.threads = []; mock.actions.create.mockReset();
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network request"); }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("shows initial creation failure instead of silently remaining on Opening chat", async () => {
  mock.actions.create.mockRejectedValue(new Error("Synthetic initial failure"));
  render(<ChatDock />);
  expect(await screen.findByText("Synthetic initial failure")).toBeInTheDocument();
  expect(screen.queryByText("Opening chat…")).not.toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});
it("shows an explicit New chat creation error", async () => {
  mock.threads = [{ id: "active-thread", title: "Existing" }];
  mock.actions.create.mockRejectedValue(new Error("Synthetic new chat failure"));
  render(<ChatDock />);
  fireEvent.click(await screen.findByRole("button", { name: "New chat" }));
  expect(await screen.findByText("Synthetic new chat failure")).toBeInTheDocument();
  expect(mock.actions.create).toHaveBeenCalledOnce();
});
it("keeps the active conversation accessible after New chat fails", async () => {
  mock.threads = [{ id: "active-thread", title: "Existing" }];
  mock.actions.create.mockRejectedValue(new Error("Synthetic new chat failure"));
  render(<ChatDock />);
  await waitFor(() => expect(screen.getByTestId("active-thread")).toHaveTextContent("active-thread"));
  fireEvent.click(screen.getByRole("button", { name: "New chat" }));
  await screen.findByText("Synthetic new chat failure");
  // Desired regression contract: keep the existing conversation usable alongside the error.
  expect(screen.queryByTestId("active-thread")).toHaveTextContent("active-thread");
});