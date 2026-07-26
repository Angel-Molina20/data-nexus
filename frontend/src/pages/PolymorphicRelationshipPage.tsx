import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";

import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";
import { createPolymorphicRelationship } from "../services/relationships";
import { getSchemaEntity, listSchemaEntities } from "../services/schema";

interface Mapping {
  typeValue: string;
  targetEntity: string;
  targetField: string;
  displayName: string;
}

export function PolymorphicRelationshipPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [sourceEntity, setSourceEntity] = useState("");
  const [typeField, setTypeField] = useState("");
  const [idField, setIdField] = useState("");
  const [name, setName] = useState("Documentable");
  const [mappings, setMappings] = useState<Mapping[]>([
    { typeValue: "", targetEntity: "", targetField: "", displayName: "" },
  ]);
  const entities = useQuery({
    queryKey: ["schema-entities", id, "polymorphic"],
    queryFn: () => listSchemaEntities(id, { isActive: true }),
  });
  const source = useQuery({
    queryKey: ["schema-entity", id, sourceEntity],
    queryFn: () => getSchemaEntity(id, sourceEntity),
    enabled: Boolean(sourceEntity),
  });
  const targets = useQuery({
    queryKey: ["polymorphic-target-details", id, mappings.map((item) => item.targetEntity)],
    queryFn: async () =>
      Promise.all(
        mappings.map((item) =>
          item.targetEntity ? getSchemaEntity(id, item.targetEntity) : Promise.resolve(null),
        ),
      ),
  });
  const create = useMutation({
    mutationFn: () => createPolymorphicRelationship(id, {
      source_entity_id: sourceEntity,
      type_field_id: typeField,
      id_field_id: idField,
      name,
      display_name: name,
      mappings: mappings.map((item) => ({
        type_value: item.typeValue,
        target_entity_id: item.targetEntity,
        target_field_id: item.targetField,
        display_name: item.displayName || item.typeValue,
      })),
    }),
    onSuccess: () => { void navigate(`/connections/${id}/relationships`); },
  });
  const valid = useMemo(
    () =>
      Boolean(
        sourceEntity && typeField && idField && typeField !== idField && name.trim() &&
        mappings.length && mappings.every((item) => item.typeValue && item.targetEntity && item.targetField),
      ),
    [idField, mappings, name, sourceEntity, typeField],
  );
  const updateMapping = (index: number, patch: Partial<Mapping>) => {
    setMappings((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };
  return (
    <PageContainer>
      <PageHeader eyebrow="Relación polimórfica" title="Configurar discriminador y mappings" description="Cada mapping conserva obligatoriamente la condición de tipo y la comparación de identificador." />
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-2 text-sm font-semibold">Entidad origen<select className="field" value={sourceEntity} onChange={(event) => { setSourceEntity(event.target.value); setTypeField(""); setIdField(""); }}><option value="">Seleccionar…</option>{entities.data?.items.map((item) => <option key={item.id} value={item.id}>{item.physical_name}</option>)}</select></label>
          <label className="grid gap-2 text-sm font-semibold">Campo discriminador<select className="field" value={typeField} onChange={(event) => { setTypeField(event.target.value); }}><option value="">Seleccionar…</option>{source.data?.fields.filter((field) => ["string", "text", "enum"].includes(field.normalized_data_type)).map((field) => <option key={field.id} value={field.id}>{field.physical_name}</option>)}</select></label>
          <label className="grid gap-2 text-sm font-semibold">Campo identificador<select className="field" value={idField} onChange={(event) => { setIdField(event.target.value); }}><option value="">Seleccionar…</option>{source.data?.fields.map((field) => <option key={field.id} value={field.id}>{field.physical_name}</option>)}</select></label>
        </div>
        <label className="mt-4 grid gap-2 text-sm font-semibold">Nombre visible<input className="field" value={name} onChange={(event) => { setName(event.target.value); }} /></label>
        <div className="mt-6 grid gap-3">
          <h2 className="font-semibold">Mappings</h2>
          {mappings.map((mapping, index) => (
            <div className="grid gap-3 rounded-lg bg-slate-50 p-4 lg:grid-cols-4" key={String(index)}>
              <label className="grid gap-1 text-xs font-semibold">Valor de tipo<input className="field" placeholder="Student" value={mapping.typeValue} onChange={(event) => { updateMapping(index, { typeValue: event.target.value }); }} /></label>
              <label className="grid gap-1 text-xs font-semibold">Entidad destino<select className="field" value={mapping.targetEntity} onChange={(event) => { updateMapping(index, { targetEntity: event.target.value, targetField: "" }); }}><option value="">Seleccionar…</option>{entities.data?.items.map((item) => <option key={item.id} value={item.id}>{item.physical_name}</option>)}</select></label>
              <label className="grid gap-1 text-xs font-semibold">Campo destino<select className="field" value={mapping.targetField} onChange={(event) => { updateMapping(index, { targetField: event.target.value }); }}><option value="">Seleccionar…</option>{targets.data?.[index]?.fields.filter((field) => field.is_primary_key || field.is_unique).map((field) => <option key={field.id} value={field.id}>{field.physical_name}</option>)}</select></label>
              <label className="grid gap-1 text-xs font-semibold">Nombre visible<input className="field" value={mapping.displayName} onChange={(event) => { updateMapping(index, { displayName: event.target.value }); }} /></label>
              {source.data && mapping.typeValue && targets.data?.[index] ? <p className="alert-success lg:col-span-4">{source.data.physical_name}.{source.data.fields.find((field) => field.id === typeField)?.physical_name} = &quot;{mapping.typeValue}&quot; AND {source.data.physical_name}.{source.data.fields.find((field) => field.id === idField)?.physical_name} = {targets.data[index].physical_name}.{targets.data[index].fields.find((field) => field.id === mapping.targetField)?.physical_name}</p> : null}
            </div>
          ))}
          <button className="btn-secondary justify-self-start" onClick={() => { setMappings((current) => [...current, { typeValue: "", targetEntity: "", targetField: "", displayName: "" }]); }}>Agregar mapping</button>
        </div>
        <p className="alert-warning mt-5">Nunca se relacionará únicamente el campo identificador: el discriminador y el ID forman una condición conjunta obligatoria.</p>
        {create.isError ? <p className="alert-error mt-4">{create.error.message}</p> : null}
        <div className="mt-6 flex justify-end gap-2"><button className="btn-secondary" onClick={() => { void navigate(-1); }}>Cancelar</button><button className="btn-primary" disabled={!valid || create.isPending} onClick={() => { create.mutate(); }}>{create.isPending ? "Guardando…" : "Crear relación polimórfica"}</button></div>
      </section>
    </PageContainer>
  );
}
