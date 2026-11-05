import { StrictMode, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mock = vi.hoisted(() => ({ threads: [] as { id: string; title: string }[], actions: { create: vi.fn(), refresh: vi.fn() } }));
vi.mock("@tanstack/react-router", () => ({ useRouterState: () => "/", Link: ({ children }: { children: ReactNode }) => <span>{children}</span> }));
vi.mock("./use-chat-threads", () => ({ useInbox: () => ({ data: [] }), useChatThreads: () => ({ data: mock.threads }), useChatThreadActions: () => mock.actions }));
vi.mock("./chat-window", () => ({ AgentMark: () => null, DOCK_ASK_EVENT: "mock-ask", setPendingDockAsk: vi.fn() }));
vi.mock("@/pages/chat", () => ({ ChatThreadView: ({ threadId, dock }: { threadId: string; dock: { leading: ReactNode; trailing: ReactNode } }) => <div><span data-testid="active-thread">{threadId}</span>{dock.leading}{dock.trailing}</div> }));
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
it("reuses one startup creation request when an empty thread query rerenders", async () => {
  let resolveCreate!: (value: { id: string; title: string }) => void;
  mock.actions.create.mockImplementation(() => new Promise(resolve => { resolveCreate = resolve; }));
  const view = render(<ChatDock />);
  expect(mock.actions.create).toHaveBeenCalledOnce();
  mock.threads = [];
  view.rerender(<ChatDock />);
  expect(mock.actions.create).toHaveBeenCalledOnce();
  resolveCreate({ id: "new-thread", title: "New" });
  await waitFor(() => expect(screen.getByTestId("active-thread")).toHaveTextContent("new-thread"));
  expect(mock.actions.create).toHaveBeenCalledOnce();
});

it("ignores rapid duplicate New chat clicks until the first request settles", async () => {
  mock.threads = [{ id: "existing-thread", title: "Existing" }];
  let resolveCreate!: (value: { id: string; title: string }) => void;
  mock.actions.create.mockImplementation(() => new Promise(resolve => { resolveCreate = resolve; }));
  render(<ChatDock />);
  await screen.findByRole("button", { name: "New chat" });
  const button = screen.getByRole("button", { name: "New chat" });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(mock.actions.create).toHaveBeenCalledOnce();
  resolveCreate({ id: "new-thread", title: "New" });
  await waitFor(() => expect(screen.getByTestId("active-thread")).toHaveTextContent("new-thread"));
});


it("does not duplicate startup creation when StrictMode replays the effect", async () => {
  mock.actions.create.mockResolvedValue({ id: "strict-thread", title: "Strict" });
  render(<StrictMode><ChatDock /></StrictMode>);
  await waitFor(() => expect(screen.getByTestId("active-thread")).toHaveTextContent("strict-thread"));
  expect(mock.actions.create).toHaveBeenCalledOnce();
});


it("lets the owner explicitly retry a failed startup request", async () => {
  mock.actions.create
    .mockRejectedValueOnce(new Error("Synthetic startup failure"))
    .mockResolvedValueOnce({ id: "retry-thread", title: "Retry" });
  render(<ChatDock />);
  expect(await screen.findByText("Synthetic startup failure")).toBeInTheDocument();
  expect(mock.actions.create).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Retry opening chat" }));
  await waitFor(() => expect(screen.getByTestId("active-thread")).toHaveTextContent("retry-thread"));
  expect(mock.actions.create).toHaveBeenCalledTimes(2);
});

it("does not replace an existing thread when a pending startup request finishes", async () => {
  let resolveCreate!: (value: { id: string; title: string }) => void;
  mock.actions.create.mockImplementation(() => new Promise(resolve => { resolveCreate = resolve; }));
  const view = render(<ChatDock />);
  expect(mock.actions.create).toHaveBeenCalledOnce();
  mock.threads = [{ id: "existing-thread", title: "Existing" }];
  view.rerender(<ChatDock />);
  await waitFor(() => expect(screen.getByTestId("active-thread")).toHaveTextContent("existing-thread"));
  await act(async () => { resolveCreate({ id: "late-startup", title: "Late" }); });
  expect(screen.getByTestId("active-thread")).toHaveTextContent("existing-thread");
});

it("preserves a later user selection when New chat resolves late", async () => {
  mock.threads = [{ id: "thread-one", title: "One" }, { id: "thread-two", title: "Two" }];
  let resolveCreate!: (value: { id: string; title: string }) => void;
  mock.actions.create.mockImplementation(() => new Promise(resolve => { resolveCreate = resolve; }));
  render(<ChatDock />);
  await waitFor(() => expect(screen.getByTestId("active-thread")).toHaveTextContent("thread-one"));
  fireEvent.click(screen.getByRole("button", { name: "New chat" }));
  fireEvent.click(screen.getByRole("button", { name: "Recent chats" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Two" }));
  expect(screen.getByTestId("active-thread")).toHaveTextContent("thread-two");
  await act(async () => { resolveCreate({ id: "late-new", title: "Late new" }); });
  expect(screen.getByTestId("active-thread")).toHaveTextContent("thread-two");
});

it("does not reopen chat after a pending New chat request settles after unmount", async () => {
  mock.threads = [{ id: "existing-thread", title: "Existing" }];
  let resolveCreate!: (value: { id: string; title: string }) => void;
  mock.actions.create.mockImplementation(() => new Promise(resolve => { resolveCreate = resolve; }));
  const view = render(<ChatDock />);
  await waitFor(() => expect(screen.getByTestId("active-thread")).toHaveTextContent("existing-thread"));
  fireEvent.click(screen.getByRole("button", { name: "New chat" }));
  expect(mock.actions.create).toHaveBeenCalledOnce();
  view.unmount();
  await act(async () => { resolveCreate({ id: "late-new", title: "Late new" }); });
  expect(localStorage.getItem("carterhub.chatDock.open")).not.toBe("1");
});
