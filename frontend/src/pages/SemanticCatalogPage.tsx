import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, ShieldAlert } from "lucide-react";
import { useParams } from "react-router";

import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";
import { StatusBadge } from "../components/ui/StatusBadge";
import {
  getSemanticEntity,
  listSemanticEntities,
  updateSemanticEntity,
  updateSemanticField,
} from "../features/relationships/api/relationshipsApi";
import { routes } from "../app/router/routes";

export function SemanticCatalogPage() {
  const { id = "" } = useParams();
  const client = useQueryClient();
  const [selected, setSelected] = useState("");
  const list = useQuery({
    queryKey: ["semantic-entities", id],
    queryFn: () => listSemanticEntities(id),
  });
  useEffect(() => {
    if (!selected && list.data?.items[0]) setSelected(list.data.items[0].id);
  }, [list.data, selected]);
  const detail = useQuery({
    queryKey: ["semantic-entity", id, selected],
    queryFn: () => getSemanticEntity(id, selected),
    enabled: Boolean(selected),
  });
  const saveEntity = useMutation({
    mutationFn: (payload: Record<string, unknown>) => updateSemanticEntity(id, selected, payload),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["semantic-entities", id] }),
        client.invalidateQueries({ queryKey: ["semantic-entity", id, selected] }),
        client.invalidateQueries({ queryKey: ["relationship-graph", id] }),
      ]);
    },
  });
  const saveField = useMutation({
    mutationFn: ({ fieldId, payload }: { fieldId: string; payload: Record<string, unknown> }) =>
      updateSemanticField(id, fieldId, payload),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["semantic-entity", id, selected] });
    },
  });
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Capa semántica"
        title="Catálogo semántico"
        description="Los nombres de negocio complementan el catálogo físico y sobreviven a las resincronizaciones."
        backAction={{ fallback: routes.connections.detail(id), label: "Volver" }}
        breadcrumbs={[
          { label: "Inicio", to: routes.dashboard() },
          { label: "Conexiones", to: routes.connections.list() },
          { label: "Detalle", to: routes.connections.detail(id) },
          { label: "Catálogo semántico" },
        ]}
      />
      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-slate-200 bg-white p-3">
          <input className="field mb-3" placeholder="Buscar entidad…" />
          {list.data?.items.map((item) => (
            <button
              className={`mb-1 flex w-full items-center justify-between rounded-lg p-3 text-left ${selected === item.id ? "bg-blue-50 text-blue-800" : "hover:bg-slate-50"}`}
              key={item.id}
              onClick={() => {
                setSelected(item.id);
              }}
            >
              <span>
                <strong className="block text-sm">{item.display_name}</strong>
                <small>{item.physical_name}</small>
              </span>
              {item.sensitive_fields ? (
                <ShieldAlert className="size-4 text-amber-600" />
              ) : item.is_visible ? (
                <Eye className="size-4" />
              ) : (
                <EyeOff className="size-4" />
              )}
            </button>
          ))}
        </aside>
        {detail.data ? (
          <SemanticEditor
            entity={detail.data}
            saving={saveEntity.isPending || saveField.isPending}
            onSaveEntity={(payload) => {
              saveEntity.mutate(payload);
            }}
            onSaveField={(fieldId, payload) => {
              saveField.mutate({ fieldId, payload });
            }}
          />
        ) : (
          <p className="state-message rounded-xl border border-slate-200 bg-white">
            Selecciona una entidad.
          </p>
        )}
      </div>
    </PageContainer>
  );
}

function SemanticEditor({
  entity,
  saving,
  onSaveEntity,
  onSaveField,
}: {
  entity: Awaited<ReturnType<typeof getSemanticEntity>>;
  saving: boolean;
  onSaveEntity: (payload: Record<string, unknown>) => void;
  onSaveField: (fieldId: string, payload: Record<string, unknown>) => void;
}) {
  const [displayName, setDisplayName] = useState(entity.display_name);
  const [description, setDescription] = useState(entity.description ?? "");
  const [domain, setDomain] = useState(entity.business_domain ?? "");
  useEffect(() => {
    setDisplayName(entity.display_name);
    setDescription(entity.description ?? "");
    setDomain(entity.business_domain ?? "");
  }, [entity]);
  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-semibold">{entity.display_name}</h2>
        <StatusBadge>{entity.is_active ? "Activa" : "Entidad física inactiva"}</StatusBadge>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Nombre físico: <code>{entity.physical_name}</code>
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold">
          Nombre de negocio
          <input
            className="field"
            value={displayName}
            onChange={(event) => {
              setDisplayName(event.target.value);
            }}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Dominio
          <input
            className="field"
            value={domain}
            onChange={(event) => {
              setDomain(event.target.value);
            }}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold md:col-span-2">
          Descripción
          <textarea
            className="field min-h-20"
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
            }}
          />
        </label>
      </div>
      <button
        className="btn-primary mt-4"
        disabled={saving}
        onClick={() => {
          onSaveEntity({
            display_name: displayName,
            description: description || null,
            business_domain: domain || null,
          });
        }}
      >
        Guardar entidad
      </button>
      <h3 className="mt-8 font-semibold">Campos</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Físico</th>
              <th>Nombre visible</th>
              <th>Tipo semántico</th>
              <th>Visible</th>
              <th>Sensible</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {entity.fields.map((field) => (
              <SemanticFieldRow field={field} key={field.id} saving={saving} onSave={onSaveField} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SemanticFieldRow({
  field,
  saving,
  onSave,
}: {
  field: Awaited<ReturnType<typeof getSemanticEntity>>["fields"][number];
  saving: boolean;
  onSave: (fieldId: string, payload: Record<string, unknown>) => void;
}) {
  const [name, setName] = useState(field.display_name);
  const [semanticType, setSemanticType] = useState(field.semantic_type);
  const [visible, setVisible] = useState(field.is_visible);
  const [sensitive, setSensitive] = useState(field.is_sensitive);
  return (
    <tr>
      <td>
        <strong>{field.physical_name}</strong>
      </td>
      <td>
        <input
          className="field min-w-36"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
      </td>
      <td>
        <select
          className="field min-w-40"
          value={semanticType}
          onChange={(event) => {
            setSemanticType(event.target.value);
          }}
        >
          {[
            "unknown",
            "identifier",
            "foreign_identifier",
            "person_name",
            "email",
            "phone",
            "date",
            "datetime",
            "currency",
            "percentage",
            "status",
            "category",
            "description",
            "code",
            "url",
            "boolean",
          ].map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </td>
      <td>
        <input
          aria-label={`Visibilidad de ${field.physical_name}`}
          checked={visible}
          type="checkbox"
          onChange={(event) => {
            setVisible(event.target.checked);
          }}
        />
      </td>
      <td>
        <label className="flex items-center gap-2">
          <input
            checked={sensitive}
            type="checkbox"
            onChange={(event) => {
              setSensitive(event.target.checked);
            }}
          />
          {sensitive ? <ShieldAlert className="size-4 text-amber-600" /> : null}
        </label>
      </td>
      <td>
        <button
          className="btn-secondary"
          disabled={saving}
          onClick={() => {
            onSave(field.id, {
              display_name: name,
              semantic_type: semanticType,
              is_visible: visible,
              is_sensitive: sensitive,
            });
          }}
        >
          Guardar
        </button>
      </td>
    </tr>
  );
}
