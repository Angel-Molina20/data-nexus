import { useMemo } from "react";
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { RelationshipGraph as GraphData } from "./types";

export function RelationshipGraph({ graph }: { graph: GraphData }) {
  const nodes = useMemo<Node[]>(
    () =>
      graph.nodes.map((item, index) => ({
        id: item.id,
        position: {
          x: (index % 4) * 260,
          y: Math.floor(index / 4) * 180,
        },
        data: {
          label: (
            <div className="min-w-44">
              <strong className="block text-sm">{item.display_name}</strong>
              {item.display_name !== item.physical_name ? (
                <small className="text-slate-500">{item.physical_name}</small>
              ) : null}
              <p className="mt-2 text-xs text-slate-500">
                {item.key_fields.length ? `Claves: ${item.key_fields.join(", ")}` : "Sin clave"}
              </p>
              {item.sensitive_fields ? (
                <span className="mt-2 block text-xs font-semibold text-amber-700">
                  {item.sensitive_fields} campo(s) sensible(s)
                </span>
              ) : null}
            </div>
          ),
        },
        className: !item.is_active ? "opacity-50" : "",
        style: {
          border: "1px solid #cbd5e1",
          borderRadius: 12,
          background: "#fff",
          padding: 12,
          width: 220,
        },
      })),
    [graph.nodes],
  );
  const edges = useMemo<Edge[]>(
    () =>
      graph.edges.map((item) => ({
        id: item.id,
        source: item.source,
        target: item.target,
        label: item.label,
        animated: item.relationship_type === "polymorphic",
        markerEnd: { type: MarkerType.ArrowClosed },
        style: {
          strokeDasharray:
            item.status === "invalid"
              ? "3 5"
              : item.relationship_type === "manual"
                ? "8 4"
                : undefined,
          stroke:
            item.status === "invalid"
              ? "#dc2626"
              : item.relationship_type === "physical"
                ? "#2563eb"
                : "#7c3aed",
        },
      })),
    [graph.edges],
  );
  return (
    <div className="h-[560px] overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <ReactFlow edges={edges} fitView nodes={nodes} nodesDraggable>
        <Background />
        <MiniMap pannable zoomable />
        <Controls />
      </ReactFlow>
    </div>
  );
}
