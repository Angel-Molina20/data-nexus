import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, GitFork, ScanSearch, X } from "lucide-react";
import { Link, useParams } from "react-router";

import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";
import { StatusBadge } from "../components/ui/StatusBadge";
import {
  confirmRelationshipCandidate,
  detectRelationshipCandidates,
  listRelationshipCandidates,
  rejectRelationshipCandidate,
} from "../services/relationships";

export function RelationshipCandidatesPage() {
  const { id = "" } = useParams();
  const client = useQueryClient();
  const candidates = useQuery({
    queryKey: ["relationship-candidates", id],
    queryFn: () => listRelationshipCandidates(id),
  });
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["relationship-candidates", id] }),
      client.invalidateQueries({ queryKey: ["relationships", id] }),
      client.invalidateQueries({ queryKey: ["relationship-graph", id] }),
    ]);
  };
  const detect = useMutation({
    mutationFn: () => detectRelationshipCandidates(id),
    onSuccess: refresh,
  });
  const confirm = useMutation({
    mutationFn: (candidateId: string) => confirmRelationshipCandidate(id, candidateId),
    onSuccess: refresh,
  });
  const reject = useMutation({
    mutationFn: (candidateId: string) => rejectRelationshipCandidate(id, candidateId),
    onSuccess: refresh,
  });
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Relaciones inferidas"
        title="Sugerencias pendientes"
        description="Ninguna relación sugerida se activa sin confirmación administrativa."
        actions={<button className="btn-primary" disabled={detect.isPending} onClick={() => { detect.mutate(); }}><ScanSearch className="size-4" /> {detect.isPending ? "Detectando…" : "Volver a detectar"}</button>}
      />
      {candidates.isPending ? <p className="state-message">Cargando sugerencias…</p> : null}
      {candidates.isError ? <p className="alert-error">No fue posible cargar las sugerencias.</p> : null}
      <div className="grid gap-4">
        {candidates.data?.items.map((item) => (
          <article className="rounded-xl border border-slate-200 bg-white p-5" key={item.id}>
            <div className="flex flex-wrap items-center gap-2"><StatusBadge variant="info">{item.type}</StatusBadge><strong>{item.source.entity_name}.{item.source.fields.join(" + ")}</strong><span aria-hidden>→</span><strong>{item.target ? `${item.target.entity_name}.${item.target.fields.join(" + ")}` : "Mappings configurables"}</strong><span className="ml-auto rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{Math.round(item.confidence * 100)}% confianza</span></div>
            <p className="mt-3 text-sm text-slate-600">Cardinalidad sugerida: {item.cardinality}</p>
            <ul className="mt-2 list-disc pl-5 text-sm text-slate-500">{item.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
            {item.warnings.map((warning) => <p className="mt-2 text-sm text-amber-700" key={warning}>{warning}</p>)}
            <div className="mt-4 flex flex-wrap gap-2">
              {item.type === "polymorphic" ? <Link className="btn-primary" to={`/connections/${id}/relationships/polymorphic/new`}><GitFork className="size-4" /> Configurar mappings</Link> : <button className="btn-primary" disabled={confirm.isPending} onClick={() => { confirm.mutate(item.id); }}><Check className="size-4" /> Confirmar</button>}
              <button className="btn-secondary" disabled={reject.isPending} onClick={() => { reject.mutate(item.id); }}><X className="size-4" /> Rechazar</button>
            </div>
          </article>
        ))}
        {candidates.data?.items.length === 0 ? <div className="state-message rounded-xl border border-slate-200 bg-white">No hay sugerencias pendientes.</div> : null}
      </div>
      <p className="text-xs text-slate-500">Los rechazos se conservan mediante fingerprint y no reaparecen mientras no cambie su estructura.</p>
    </PageContainer>
  );
}
