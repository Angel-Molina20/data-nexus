import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type ReactFlowInstance,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Database, KeyRound, ShieldAlert } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";

import type { QueryDocument } from "../queries/types";
import type { SchemaEntity } from "../schema/types";

/* eslint-disable react-hooks/exhaustive-deps -- sources are an immutable projection of document */

interface EntityNodeData extends Record<string, unknown> {
  alias: string;
  name: string;
  physical: string;
  fields: string[];
  sensitive: boolean;
}
const EntityNode = memo(function EntityNode({ data }: NodeProps<Node<EntityNodeData>>) {
  return (
    <div className="min-w-52 rounded-xl border border-slate-300 bg-white shadow-sm">
      <Handle position={Position.Left} type="target" />
      <div className="flex items-start gap-2 border-b bg-slate-50 p-3">
        <Database className="mt-0.5 size-4 text-blue-600" />
        <div>
          <strong className="block text-sm">{data.alias}</strong>
          <span className="text-xs text-slate-500">
            {data.name} · {data.physical}
          </span>
        </div>
        {data.sensitive ? (
          <ShieldAlert
            aria-label="Contiene campos sensibles"
            className="ml-auto size-4 text-amber-600"
          />
        ) : null}
      </div>
      <div className="space-y-1 p-3 text-xs">
        {data.fields.length ? (
          data.fields.slice(0, 6).map((field) => (
            <div className="flex items-center gap-1" key={field}>
              <KeyRound className="size-3 text-slate-400" />
              {field}
            </div>
          ))
        ) : (
          <span className="text-slate-400">Sin campos seleccionados</span>
        )}
      </div>
      <Handle position={Position.Right} type="source" />
    </div>
  );
});

export function QueryCanvas({
  document,
  entities,
  onLayout,
  onSelectJoin,
  onSelectSource,
  resizeKey,
  selectedJoinId,
  selectedSourceId,
}: {
  document: QueryDocument;
  entities: Record<string, SchemaEntity>;
  onLayout: (sourceId: string, x: number, y: number) => void;
  onSelectJoin: (joinId: string | null) => void;
  onSelectSource: (sourceId: string | null) => void;
  resizeKey: string;
  selectedJoinId: string | null;
  selectedSourceId: string | null;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [flow, setFlow] = useState<ReactFlowInstance<Node<EntityNodeData>> | null>(null);
  const sources = [document.query.source, ...document.query.joins.map((join) => join.source)];
  const layout = document.metadata.builder_layout;
  const nodes = useMemo<Node<EntityNodeData>[]>(
    () =>
      sources.map((source, index) => {
        const entity = entities[source.entity_id];
        const selected = document.query.select
          .filter((item) => item.expression.source_id === source.source_id)
          .map(
            (item) =>
              entity?.fields.find((field) => field.id === item.expression.field_id)?.display_name ??
              item.label ??
              "Expresión",
          );
        return {
          id: source.source_id,
          type: "entity",
          position: layout?.nodes[source.source_id] ?? {
            x: 80 + (index % 3) * 300,
            y: 70 + Math.floor(index / 3) * 220,
          },
          data: {
            alias: source.alias,
            name: entity?.display_name ?? "Entidad",
            physical: entity?.physical_name ?? source.entity_id.slice(0, 8),
            fields: selected,
            sensitive: false,
          },
          selected: source.source_id === selectedSourceId,
        };
      }),
    [document, entities, layout, selectedSourceId, sources],
  );
  const edges = useMemo<Edge[]>(
    () =>
      document.query.joins.map((join, index) => ({
        id: join.join_id,
        source: index === 0 ? document.query.source.source_id : document.query.source.source_id,
        target: join.source.source_id,
        label: `${join.join_type.toUpperCase()} · ${join.polymorphic_mapping_id ? "Polimórfica" : join.relationship_id ? "Relación" : "Manual"}`,
        markerEnd: { type: MarkerType.ArrowClosed },
        animated: Boolean(join.polymorphic_mapping_id),
        style: { strokeDasharray: join.on ? "7 4" : undefined },
        selected: join.join_id === selectedJoinId,
      })),
    [document, selectedJoinId],
  );
  useEffect(() => {
    if (!flow || !container.current) return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        void flow.fitView({ duration: 0, padding: 0.16 });
      });
    });
    observer.observe(container.current);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [flow, resizeKey]);
  return (
    <div aria-label="Lienzo de consulta" className="h-full min-h-0 bg-slate-50" ref={container}>
      <ReactFlow
        nodeTypes={{ entity: EntityNode }}
        nodes={nodes}
        edges={edges}
        fitView
        onEdgeClick={(_, edge) => {
          onSelectSource(null);
          onSelectJoin(edge.id);
        }}
        onInit={setFlow}
        onNodeClick={(_, node) => {
          onSelectJoin(null);
          onSelectSource(node.id);
        }}
        onNodeDragStop={(_, node) => {
          onLayout(node.id, node.position.x, node.position.y);
        }}
        onPaneClick={() => {
          onSelectJoin(null);
          onSelectSource(null);
        }}
      >
        <Background color="#cbd5e1" gap={20} size={1} />
        <MiniMap pannable position="bottom-right" zoomable />
        <Controls />
      </ReactFlow>
    </div>
  );
}
