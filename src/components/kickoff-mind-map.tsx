import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ReactFlow, Background, Controls, Handle, Position, applyNodeChanges, type Connection, type Edge, type Node, type NodeChange, type EdgeChange, type NodeProps, applyEdgeChanges } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MindMap } from "@/lib/kickoff";

type Kind = MindMap["nodes"][number]["kind"];
const kinds: { value: Kind; label: string }[] = [
  { value: "idea", label: "Idea" }, { value: "feature", label: "Feature" }, { value: "risk", label: "Risk" }, { value: "question", label: "Question" },
];
const tone: Record<Kind, string> = {
  idea: "border-border bg-card", feature: "border-primary/60 bg-primary/10", risk: "border-destructive/60 bg-destructive/10", question: "border-accent/60 bg-accent/10",
};
type Data = { label: string; kind: Kind };

function MapNode({ data, selected }: NodeProps<Node<Data>>) {
  return (
    <div className={`max-w-[200px] rounded-xl border-2 px-3 py-2 text-sm text-foreground shadow-sm ${tone[data.kind]} ${selected ? "ring-2 ring-ring" : ""}`}>
      <Handle type="target" position={Position.Left} />
      <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{data.kind}</div>
      <div className="break-words">{data.label || "Untitled"}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const nodeTypes = { idea: MapNode };

export function emptyMindMap(seed: string): MindMap {
  return { nodes: [{ id: "root", label: seed.split("\n")[0]?.slice(0, 200) || "My project", kind: "idea", x: 0, y: 0 }], edges: [] };
}

export function KickoffMindMap({ value, onChange, disabled, onExpand, hint, canvasClass = "h-[420px]", nodeActions }: { value: MindMap; onChange: (m: MindMap) => void; disabled?: boolean; onExpand?: () => void; hint?: string; canvasClass?: string; nodeActions?: (node: MindMap["nodes"][number]) => ReactNode }) {
  const [selected, setSelected] = useState<string | null>(null);
  const nodes: Node<Data>[] = useMemo(() => value.nodes.map(n => ({ id: n.id, type: "idea", position: { x: n.x, y: n.y }, data: { label: n.label, kind: n.kind }, selected: n.id === selected })), [value.nodes, selected]);
  const edges: Edge[] = useMemo(() => value.edges.map(e => ({ ...e })), [value.edges]);
  const sel = value.nodes.find(n => n.id === selected);

  const onNodesChange = useCallback((changes: NodeChange<Node<Data>>[]) => {
    if (disabled) return;
    const next = applyNodeChanges(changes, nodes);
    const pick = changes.find(c => c.type === "select" && c.selected);
    if (pick && "id" in pick) setSelected(pick.id);
    const removed = new Set(changes.filter(c => c.type === "remove").map(c => c.id));
    const moved = changes.some(c => c.type === "position" || c.type === "remove");
    if (!moved) return;
    onChange({
      nodes: next.map(n => ({ id: n.id, label: n.data.label, kind: n.data.kind, x: Math.round(n.position.x), y: Math.round(n.position.y) })),
      edges: value.edges.filter(e => !removed.has(e.source) && !removed.has(e.target)),
    });
  }, [nodes, value.edges, onChange, disabled]);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    if (disabled || !changes.some(c => c.type === "remove")) return;
    onChange({ ...value, edges: applyEdgeChanges(changes, edges).map(e => ({ id: e.id, source: e.source, target: e.target })) });
  }, [edges, value, onChange, disabled]);
  const onConnect = useCallback((c: Connection) => {
    if (disabled || !c.source || !c.target || c.source === c.target) return;
    // One parent per node keeps the outline a clean tree.
    const edgesNext = value.edges.filter(e => e.target !== c.target);
    onChange({ ...value, edges: [...edgesNext, { id: `${c.source}-${c.target}`, source: c.source, target: c.target }] });
  }, [value, onChange, disabled]);

  const addChild = () => {
    const parent = sel ?? value.nodes[0];
    const id = crypto.randomUUID().slice(0, 8);
    const siblings = value.edges.filter(e => e.source === parent?.id).length;
    const node = { id, label: "New idea", kind: "idea" as Kind, x: (parent?.x ?? 0) + 240, y: (parent?.y ?? 0) + siblings * 80 };
    onChange({ nodes: [...value.nodes, node], edges: parent ? [...value.edges, { id: `${parent.id}-${id}`, source: parent.id, target: id }] : value.edges });
    setSelected(id);
  };
  const update = (patch: Partial<Data>) => sel && onChange({ ...value, nodes: value.nodes.map(n => n.id === sel.id ? { ...n, ...patch } : n) });
  const remove = () => { if (!sel) return; onChange({ nodes: value.nodes.filter(n => n.id !== sel.id), edges: value.edges.filter(e => e.source !== sel.id && e.target !== sel.id) }); setSelected(null); };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <Button size="sm" variant="secondary" disabled={disabled || value.nodes.length >= 150} onClick={addChild}><Plus /> Add {sel ? "branch" : "idea"}</Button>
        {onExpand && <Button size="sm" disabled={disabled || value.nodes.every(n => !n.label.trim())} onClick={onExpand}><Sparkles /> AI Expand</Button>}
        {sel && <>
          <input aria-label="Node label" maxLength={200} disabled={disabled} className="min-w-[180px] flex-1 rounded-lg border border-input bg-card px-3 py-1.5 text-sm" value={sel.label} onChange={e => update({ label: e.target.value })} />
          <select aria-label="Node type" disabled={disabled} className="rounded-lg border border-input bg-card px-2 py-1.5 text-sm" value={sel.kind} onChange={e => update({ kind: e.target.value as Kind })}>{kinds.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}</select>
          <Button size="sm" variant="ghost" disabled={disabled || value.nodes.length <= 1} onClick={remove}><Trash2 /> Remove</Button>
          {nodeActions?.(sel)}
        </>}
      </div>
      <div className={`${canvasClass} overflow-hidden rounded-xl border bg-background`} data-testid="mind-map">
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onPaneClick={() => setSelected(null)} nodesDraggable={!disabled} nodesConnectable={!disabled} deleteKeyCode={null} fitView proOptions={{ hideAttribution: true }} colorMode="dark">
          <Background gap={20} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <p className="text-xs text-muted-foreground">{hint ?? "Click a node to rename it or change its type. Drag from a node's right dot to another node to link them. The map is written into your ideas as an outline, so AI drafts can use it."}</p>
    </div>
  );
}
