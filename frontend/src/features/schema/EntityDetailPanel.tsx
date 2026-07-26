import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { Link } from "react-router";

import { getSchemaEntity } from "../../services/schema";
import { StatusBadge } from "../../components/ui/StatusBadge";

const tabs = ["structure", "indexes", "relationships", "information"] as const;
const labels = {
  structure: "Estructura", indexes: "Índices",
  relationships: "Relaciones", information: "Información",
};

function formatDefaultValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

export function EntityDetailPanel({
  connectionId,
  entityId,
}: {
  connectionId: string;
  entityId: string;
}) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("structure");
  const query = useQuery({
    queryKey: ["schema-entity", connectionId, entityId],
    queryFn: () => getSchemaEntity(connectionId, entityId),
  });
  if (query.isPending) return <p className="state-message">Cargando entidad…</p>;
  if (query.isError) return <p className="alert-error">No fue posible cargar la entidad.</p>;
  const entity = query.data;
  const relationships = [...entity.outgoing_relationships, ...entity.incoming_relationships];
  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold text-slate-950">{entity.display_name}</h2>
          <StatusBadge variant={entity.is_active ? "success" : "warning"}>
            {entity.is_active ? "Activa" : "Inactiva"}
          </StatusBadge>
        </div>
        <p className="mt-1 text-sm text-slate-500">{entity.entity_type} · {entity.schema_name}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link className="btn-secondary" to={`/connections/${connectionId}/relationships/new`}>Crear relación</Link>
          <Link className="btn-secondary" to={`/connections/${connectionId}/semantic-catalog`}>Editar metadatos semánticos</Link>
        </div>
      </div>
      <div className="flex overflow-x-auto border-b border-slate-200 px-3" role="tablist">
        {tabs.map((item) => (
          <button
            aria-selected={tab === item}
            className={`border-b-2 px-4 py-3 text-sm font-semibold ${tab === item ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500"}`}
            key={item}
            onClick={() => { setTab(item); }}
            role="tab"
          >
            {labels[item]}
          </button>
        ))}
      </div>
      <div className="p-5">
        {tab === "structure" ? (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>#</th><th>Campo</th><th>Tipo</th><th>Universal</th><th>Nullable</th><th>Default</th><th>Propiedades</th></tr></thead>
              <tbody>{entity.fields.map((field) => (
                <tr className={!field.is_active ? "opacity-50" : ""} key={field.id}>
                  <td>{field.ordinal_position}</td><td><strong>{field.physical_name}</strong></td>
                  <td>{field.column_type}</td><td>{field.normalized_data_type}</td>
                  <td>{field.is_nullable ? "Sí" : "No"}</td>
                  <td><span className="block max-w-40 truncate">{formatDefaultValue(field.default_value)}</span></td>
                  <td><div className="flex gap-1">{field.is_primary_key ? <StatusBadge variant="info">PK</StatusBadge> : null}{field.is_unique ? <StatusBadge>Unique</StatusBadge> : null}{field.is_auto_increment ? <StatusBadge>Auto</StatusBadge> : null}</div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : null}
        {tab === "indexes" ? (
          <div className="grid gap-3">{entity.indexes.map((index) => (
            <article className="rounded-lg border border-slate-200 p-4" key={index.id}>
              <div className="flex flex-wrap items-center gap-2"><KeyRound className="size-4 text-blue-600" /><strong>{index.physical_name}</strong>{index.is_primary ? <StatusBadge variant="info">Primary</StatusBadge> : null}{index.is_unique ? <StatusBadge>Unique</StatusBadge> : null}</div>
              <p className="mt-2 text-sm text-slate-500">{index.fields.map((field) => `${String(field.sequence)}. ${field.field_name ?? "expresión"}`).join(" · ")}</p>
            </article>
          ))}</div>
        ) : null}
        {tab === "relationships" ? (
          <div className="grid gap-3">
            {relationships.map((relationship) => (
              <article className="rounded-lg border border-slate-200 p-4" key={relationship.id}>
                <strong>{relationship.constraint_name}</strong>
                <p className="mt-1 text-sm text-slate-600">{relationship.source_entity} → {relationship.target_entity}</p>
                <p className="mt-1 text-xs text-slate-500">{relationship.fields.map((field) => `${field.source_field} → ${field.target_field}`).join(", ")} · UPDATE {relationship.update_rule} · DELETE {relationship.delete_rule}</p>
              </article>
            ))}
            {!relationships.length ? <p className="text-sm text-slate-500">No existen claves foráneas físicas.</p> : null}
            <Link className="rounded-lg bg-blue-50 p-3 text-sm font-semibold text-blue-800" to={`/connections/${connectionId}/relationships`}>Ver relaciones físicas, inferidas, manuales y polimórficas</Link>
          </div>
        ) : null}
        {tab === "information" ? (
          <dl className="detail-grid">
            <div><dt>Tipo</dt><dd>{entity.entity_type}</dd></div>
            <div><dt>Motor</dt><dd>{entity.storage_engine ?? "No informado"}</dd></div>
            <div><dt>Collation</dt><dd>{entity.collation ?? "No informada"}</dd></div>
            <div><dt>Filas estimadas</dt><dd>{entity.estimated_rows ?? "No disponible"}</dd></div>
            <div><dt>Primera detección</dt><dd>{new Date(entity.first_seen_at).toLocaleString()}</dd></div>
            <div><dt>Última detección</dt><dd>{new Date(entity.last_seen_at).toLocaleString()}</dd></div>
            <div className="sm:col-span-2"><dt>Comentario</dt><dd>{entity.comment || "Sin comentario"}</dd></div>
            <p className="text-xs text-slate-500 sm:col-span-2">El número de filas es una estimación del motor, no un conteo exacto.</p>
          </dl>
        ) : null}
      </div>
    </section>
  );
}
