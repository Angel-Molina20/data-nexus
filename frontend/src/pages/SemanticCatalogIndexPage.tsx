import { useQuery } from "@tanstack/react-query";
import { BookOpenText } from "lucide-react";
import { Link } from "react-router";

import { EmptyState } from "../components/feedback/EmptyState";
import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";
import { listConnections } from "../services/connections";

export function SemanticCatalogIndexPage() {
  const query = useQuery({
    queryKey: ["connections", "semantic-selector"],
    queryFn: () => listConnections({ page: 1 }),
  });
  return <PageContainer><PageHeader eyebrow="Capa semántica" title="Catálogo semántico" description="Selecciona una fuente sincronizada para administrar nombres de negocio, visibilidad y sensibilidad." /><section className="rounded-xl border border-slate-200 bg-white p-5">{query.data?.items.length === 0 ? <EmptyState icon={BookOpenText} title="No hay conexiones disponibles" description="Registra y sincroniza una conexión antes de editar su capa semántica." /> : <div className="grid gap-3 md:grid-cols-2">{query.data?.items.map((item) => <Link className="rounded-xl border border-slate-200 p-5 transition hover:border-blue-400" key={item.id} to={`/connections/${item.id}/semantic-catalog`}><strong>{item.name}</strong><p className="mt-1 text-sm text-slate-500">{item.engine} {item.raw_version ?? ""} · {item.database_name}</p></Link>)}</div>}</section></PageContainer>;
}
