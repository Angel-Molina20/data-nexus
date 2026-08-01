import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";

import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";
import type { QueryDocument } from "../features/queries/types";
import { listConnections } from "../services/connections";
import { listSchemaEntities } from "../services/schema";
import { createQuery } from "../services/queries";

export function NewQueryPage() {
  const navigate = useNavigate(); const [name, setName] = useState(""); const [description, setDescription] = useState(""); const [connectionId, setConnectionId] = useState(""); const [entityId, setEntityId] = useState(""); const [template, setTemplate] = useState("empty");
  const connections = useQuery({ queryKey: ["connections", "query-picker"], queryFn: () => listConnections({}) });
  const entities = useQuery({ queryKey: ["schema-entities", connectionId], queryFn: () => listSchemaEntities(connectionId), enabled: Boolean(connectionId) });
  const create = useMutation({ mutationFn: () => createQuery({ name, description: description || null, document: initialDocument(connectionId, entityId, template) }), onSuccess: (item) => { void navigate(`/queries/${item.id}/edit-json`); } });
  return <PageContainer><PageHeader eyebrow="Borrador técnico" title="Nueva consulta" description="Selecciona una fuente y crea un AST inicial. No se generará SQL." /><form className="max-w-3xl space-y-5 rounded-xl border bg-white p-6" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}><label className="grid gap-2 text-sm font-semibold">Nombre<input className="field" value={name} onChange={(event) => { setName(event.target.value); }} /></label><label className="grid gap-2 text-sm font-semibold">Descripción<textarea className="field min-h-20" value={description} onChange={(event) => { setDescription(event.target.value); }} /></label><div className="grid gap-4 md:grid-cols-2"><label className="grid gap-2 text-sm font-semibold">Conexión<select className="field" value={connectionId} onChange={(event) => { setConnectionId(event.target.value); setEntityId(""); }}><option value="">Seleccionar…</option>{connections.data?.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="grid gap-2 text-sm font-semibold">Entidad principal<select className="field" value={entityId} onChange={(event) => { setEntityId(event.target.value); }}><option value="">Seleccionar…</option>{entities.data?.items.map((item) => <option key={item.id} value={item.id}>{item.display_name}</option>)}</select></label></div><label className="grid gap-2 text-sm font-semibold">Plantilla<select className="field" value={template} onChange={(event) => { setTemplate(event.target.value); }}><option value="empty">Consulta vacía</option><option value="fields">Seleccionar campos de una entidad</option><option value="filter">Consulta con filtro</option><option value="aggregate">Consulta agregada</option><option value="relationship">Consulta con relación</option></select></label><p className="text-sm text-slate-500">La plantilla crea únicamente nodos universales y puede completarse en el editor JSON.</p>{create.isError ? <p className="alert-error">No fue posible crear el borrador. Verifica acceso analyst y el catálogo.</p> : null}<button className="btn-primary" disabled={!name || !connectionId || !entityId || create.isPending} type="submit">{create.isPending ? "Creando…" : "Crear borrador"}</button></form></PageContainer>;
}

function initialDocument(connectionId: string, entityId: string, template: string): QueryDocument {
  const literal = { node_type: "literal", value_type: "integer", value: 1 };
  return { schema_version: "1.0", connection_id: connectionId, query: { scope_id: "root", query_type: "select", source: { source_id: "src_main", entity_id: entityId, alias: "main" }, joins: [], select: [{ select_id: "item_1", item_type: "literal", expression: literal, alias: "value", label: template === "empty" ? "Valor inicial" : `Plantilla ${template}`, hidden: false }], group_by: [], order_by: [], distinct: false, unions: [] }, parameters: [], metadata: { name: null, description: null, tags: [], created_from: "api", notes: null }, options: { strict_type_validation: true, include_hidden_fields: false, allow_inactive_metadata: false, warnings_as_errors: false } };
}
