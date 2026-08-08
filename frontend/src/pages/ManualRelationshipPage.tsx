import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";

import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";
import type { SchemaEntity } from "../features/schema/types";
import { createManualRelationship } from "../features/relationships/api/relationshipsApi";
import { getSchemaEntity, listSchemaEntities } from "../features/schema/api/schemaApi";

type Pair = { source: string; target: string };

export function ManualRelationshipPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [sourceEntity, setSourceEntity] = useState("");
  const [targetEntity, setTargetEntity] = useState("");
  const [pairs, setPairs] = useState<Pair[]>([{ source: "", target: "" }]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cardinality, setCardinality] = useState("many_to_one");
  const entities = useQuery({
    queryKey: ["schema-entities", id, "manual"],
    queryFn: () => listSchemaEntities(id, { isActive: true }),
  });
  const source = useQuery({
    queryKey: ["schema-entity", id, sourceEntity],
    queryFn: () => getSchemaEntity(id, sourceEntity),
    enabled: Boolean(sourceEntity),
  });
  const target = useQuery({
    queryKey: ["schema-entity", id, targetEntity],
    queryFn: () => getSchemaEntity(id, targetEntity),
    enabled: Boolean(targetEntity),
  });
  useEffect(() => {
    setPairs([{ source: "", target: "" }]);
  }, [sourceEntity, targetEntity]);
  const create = useMutation({
    mutationFn: () =>
      createManualRelationship(id, {
        source_entity_id: sourceEntity,
        target_entity_id: targetEntity,
        fields: pairs.map((pair) => ({
          source_field_id: pair.source,
          target_field_id: pair.target,
        })),
        name,
        display_name: name,
        description: description || null,
        cardinality,
        confirm_self_relationship: sourceEntity === targetEntity,
      }),
    onSuccess: () => {
      void navigate(`/connections/${id}/relationships`);
    },
  });
  const valid = Boolean(
    sourceEntity &&
      targetEntity &&
      name.trim() &&
      pairs.every((pair) => pair.source && pair.target),
  );
  const updatePair = (index: number, patch: Partial<Pair>) => {
    setPairs((current) =>
      current.map((pair, itemIndex) => (itemIndex === index ? { ...pair, ...patch } : pair)),
    );
  };
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Relación lógica"
        title="Nueva relación manual"
        description="Selecciona entidades y pares de campos activos pertenecientes a la misma conexión."
      />
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold">
            Entidad origen
            <select
              className="field"
              value={sourceEntity}
              onChange={(event) => {
                setSourceEntity(event.target.value);
              }}
            >
              <option value="">Seleccionar…</option>
              {entities.data?.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.physical_name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Entidad destino
            <select
              className="field"
              value={targetEntity}
              onChange={(event) => {
                setTargetEntity(event.target.value);
              }}
            >
              <option value="">Seleccionar…</option>
              {entities.data?.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.physical_name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-6 grid gap-3">
          <h2 className="font-semibold">Campos relacionados</h2>
          {pairs.map((pair, index) => (
            <FieldPair
              key={String(index)}
              index={index}
              pair={pair}
              source={source.data}
              target={target.data}
              onChange={updatePair}
            />
          ))}
          <button
            className="btn-secondary justify-self-start"
            disabled={pairs.length >= 8}
            onClick={() => {
              setPairs((current) => [...current, { source: "", target: "" }]);
            }}
          >
            Agregar par compuesto
          </button>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold">
            Nombre
            <input
              className="field"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Cardinalidad
            <select
              className="field"
              value={cardinality}
              onChange={(event) => {
                setCardinality(event.target.value);
              }}
            >
              <option value="one_to_one">Uno a uno</option>
              <option value="one_to_many">Uno a muchos</option>
              <option value="many_to_one">Muchos a uno</option>
              <option value="many_to_many">Muchos a muchos</option>
              <option value="unknown">Desconocida</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold md:col-span-2">
            Descripción
            <textarea
              className="field min-h-24"
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
              }}
            />
          </label>
        </div>
        {create.isError ? <p className="alert-error mt-4">{create.error.message}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <button
            className="btn-secondary"
            onClick={() => {
              void navigate(-1);
            }}
          >
            Cancelar
          </button>
          <button
            className="btn-primary"
            disabled={!valid || create.isPending}
            onClick={() => {
              create.mutate();
            }}
          >
            {create.isPending ? "Guardando…" : "Crear relación"}
          </button>
        </div>
      </section>
    </PageContainer>
  );
}

function FieldPair({
  index,
  pair,
  source,
  target,
  onChange,
}: {
  index: number;
  pair: Pair;
  source?: SchemaEntity;
  target?: SchemaEntity;
  onChange: (index: number, patch: Partial<Pair>) => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg bg-slate-50 p-3 md:grid-cols-2">
      <label className="grid gap-1 text-xs font-semibold">
        Campo origen
        <select
          className="field"
          value={pair.source}
          onChange={(event) => {
            onChange(index, { source: event.target.value });
          }}
        >
          <option value="">Seleccionar…</option>
          {source?.fields
            .filter((field) => field.is_active)
            .map((field) => (
              <option key={field.id} value={field.id}>
                {field.physical_name} · {field.column_type}
              </option>
            ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-semibold">
        Campo destino
        <select
          className="field"
          value={pair.target}
          onChange={(event) => {
            onChange(index, { target: event.target.value });
          }}
        >
          <option value="">Seleccionar…</option>
          {target?.fields
            .filter((field) => field.is_active)
            .map((field) => (
              <option key={field.id} value={field.id}>
                {field.physical_name} · {field.column_type}
              </option>
            ))}
        </select>
      </label>
    </div>
  );
}
