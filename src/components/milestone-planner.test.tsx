import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const fixture = vi.hoisted(() => ({
  drop: null as null | ((event: { active: { id: string }; over: { id: string } | null }) => void),
  mutate: vi.fn(), invalidate: vi.fn(), error: false,
  state: { milestones: [{ id: "m", projectId: "p", title: "Beta", outcome: "", version: 3, order: 0, targetDate: "2026-11-15", createdAt: "", updatedAt: "" }], tasks: [] },
}));
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children, onDragEnd }: { children: ReactNode; onDragEnd: typeof fixture.drop }) => { fixture.drop = onDragEnd; return <>{children}</>; },
  DragOverlay: ({ children }: { children: ReactNode }) => <>{children}</>,
  useSensor: vi.fn(), useSensors: vi.fn(), PointerSensor: {}, pointerWithin: vi.fn(),
  useDraggable: () => ({ setNodeRef: vi.fn(), listeners: {}, attributes: {} }),
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
}));
vi.mock("@/lib/hub-api", () => ({
  useCreateMilestone: () => ({ isPending: false, mutate: vi.fn() }),
  useUpdateMilestone: () => ({ isPending: false, mutate: fixture.mutate }),
}));
vi.mock("@/lib/workspace", () => ({
  useWorkspace: () => ({ state: fixture.state, guard: (_: string, save: () => void) => save() }),
  useHubResult: () => (_: string, after?: () => void) => ({ onSuccess: () => { fixture.invalidate(); after?.(); }, onError: () => fixture.invalidate() }),
  errMessage: (e: Error) => e.message,
}));
import { MilestonePlanner } from "./milestone-planner";

afterEach(() => { cleanup(); vi.clearAllMocks(); fixture.state.milestones[0] && (fixture.state.milestones[0].targetDate = "2026-11-15"); });
describe("planner save flow", () => {
  it("saves a dropped deadline and refreshes shared workspace state", () => {
    fixture.mutate.mockImplementation((patch, callbacks) => {
      const m = fixture.state.milestones[0];
      if (m) m.targetDate = patch.data.targetDate;
      callbacks.onSuccess({});
    });
    const view = render(<MilestonePlanner projectId="p" />);
    fixture.drop?.({ active: { id: "m" }, over: { id: "2026-11-08" } });
    expect(fixture.mutate.mock.calls[0]?.[0]).toEqual({ id: "m", data: { expectedVersion: 3, targetDate: "2026-11-08" } });
    expect(fixture.invalidate).toHaveBeenCalledOnce();
    expect(fixture.state.milestones[0]?.targetDate).toBe("2026-11-08");
    view.rerender(<MilestonePlanner projectId="p" />);
    expect(fixture.mutate).toHaveBeenCalledOnce();
  });
  it("does not save a cancelled drag", () => {
    render(<MilestonePlanner projectId="p" />);
    fixture.drop?.({ active: { id: "m" }, over: null });
    expect(fixture.mutate).not.toHaveBeenCalled();
  });
  it("supports clearing the date without dragging", async () => {
    render(<MilestonePlanner projectId="p" />);
    const button = screen.getAllByRole("button").find(item => item.getAttribute("title") === "Edit Beta");
    expect(button).toBeDefined();
    if (!button) return;
    fireEvent.click(button);
    fireEvent.click(screen.getByRole("button", { name: "Clear date" }));
    fireEvent.click(screen.getByRole("button", { name: "Save", exact: true }));
    await waitFor(() => expect(fixture.mutate.mock.calls[0]?.[0]).toEqual({ id: "m", data: { expectedVersion: 3, targetDate: null } }));
  });
});