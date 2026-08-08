import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState } from "react";

import {
  getPolymorphicRelationship,
  listRelationships,
} from "../relationships/api/relationshipsApi";
import type { QueryDocument, QueryJoin } from "../queries/types";
import { uniqueId } from "./state";

export function AddRelationshipDialog({
  document,
  onClose,
  onAdd,
}: {
  document: QueryDocument;
  onClose: () => void;
  onAdd: (join: QueryJoin) => void;
}) {
  const relationships = useQuery({
    queryKey: ["builder-relationships", document.connection_id],
    queryFn: () => listRelationships(document.connection_id),
  });
  const [relationshipId, setRelationshipId] = useState("");
  const [joinType, setJoinType] = useState<QueryJoin["join_type"]>("left");
  const [mappingId, setMappingId] = useState("");
  const relationship = relationships.data?.items.find((item) => item.id === relationshipId);
  const poly = useQuery({
    queryKey: ["builder-poly", document.connection_id, relationshipId],
    queryFn: () => getPolymorphicRelationship(document.connection_id, relationshipId),
    enabled: relationship?.type === "polymorphic",
  });
  const used = new Set([
    document.query.source.entity_id,
    ...document.query.joins.map((join) => join.source.entity_id),
  ]);
  const available =
    relationships.data?.items.filter(
      (item) =>
        item.enabled &&
        item.status === "confirmed" &&
        (item.type === "polymorphic"
          ? used.has(item.source.entity_id)
          : item.target && used.has(item.source.entity_id) !== used.has(item.target.entity_id)),
    ) ?? [];
  const submit = () => {
    if (!relationship) return;
    if (relationship.type === "polymorphic") {
      const mapping = poly.data?.mappings.find((item) => item.id === mappingId && item.is_enabled);
      if (!mapping) return;
      onAdd({
        join_id: uniqueId("join"),
        join_type: joinType,
        source: {
          source_id: uniqueId("src"),
          entity_id: mapping.target_entity_id,
          alias: safeAlias(mapping.target_entity),
        },
        relationship_id: relationship.id,
        polymorphic_mapping_id: mapping.id,
        on: null,
        options: {},
      });
      return;
    }
    if (!relationship.target) return;
    const target = used.has(relationship.source.entity_id)
      ? relationship.target
      : relationship.source;
    onAdd({
      join_id: uniqueId("join"),
      join_type: joinType,
      source: {
        source_id: uniqueId("src"),
        entity_id: target.entity_id,
        alias: safeAlias(target.entity_name),
      },
      relationship_id: relationship.id,
      polymorphic_mapping_id: null,
      on: null,
      options: {},
    });
  };
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="relationship-title"
    >
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center">
          <h2 className="text-lg font-bold" id="relationship-title">
            Añadir entidad relacionada
          </h2>
          <button className="icon-button ml-auto" onClick={onClose} aria-label="Cerrar">
            <X className="size-4" />
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Solo relaciones confirmadas, habilitadas y válidas.
        </p>
        <label className="mt-5 block text-sm font-semibold">
          Relación
          <select
            className="field mt-2"
            value={relationshipId}
            onChange={(event) => {
              setRelationshipId(event.target.value);
              setMappingId("");
            }}
          >
            <option value="">Seleccionar…</option>
            {available.map((item) => (
              <option key={item.id} value={item.id}>
                {item.display_name} · {item.type} · {Math.round(item.confidence * 100)}%
              </option>
            ))}
          </select>
        </label>
        <label className="mt-4 block text-sm font-semibold">
          Tipo de join
          <select
            className="field mt-2"
            value={joinType}
            onChange={(event) => {
              setJoinType(event.target.value as QueryJoin["join_type"]);
            }}
          >
            <option value="inner">INNER JOIN</option>
            <option value="left">LEFT JOIN</option>
            <option value="right">RIGHT JOIN</option>
          </select>
        </label>
        {relationship?.type === "polymorphic" ? (
          <label className="mt-4 block text-sm font-semibold">
            Mapping polimórfico
            <select
              className="field mt-2"
              value={mappingId}
              onChange={(event) => {
                setMappingId(event.target.value);
              }}
            >
              <option value="">Seleccionar discriminador y destino…</option>
              {poly.data?.mappings
                .filter((item) => item.is_enabled)
                .map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.type_value} → {item.target_entity}.{item.target_field}
                  </option>
                ))}
            </select>
            <small className="mt-2 block font-normal text-slate-500">
              Se conservarán ambas condiciones: discriminador e identificador.
            </small>
          </label>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            disabled={!relationship || (relationship.type === "polymorphic" && !mappingId)}
            onClick={submit}
          >
            Añadir relación
          </button>
        </div>
      </div>
    </div>
  );
}
const safeAlias = (value: string) => {
  const cleaned = value.replace(/[^A-Za-z0-9_]/g, "_").replace(/^[^A-Za-z]+/, "entity_");
  return (cleaned || "entity").slice(0, 64);
};
