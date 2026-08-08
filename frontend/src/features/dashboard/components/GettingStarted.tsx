import { ArrowRight, Database, SearchCode, TableProperties } from "lucide-react";
import { Link } from "react-router";

import { Card, CardContent } from "../../../components/ui/Card";

export function GettingStarted() {
  const steps = [
    {
      icon: Database,
      title: "Conecta una fuente",
      description: "Registra una conexión de solo lectura.",
    },
    {
      icon: TableProperties,
      title: "Explora su esquema",
      description: "Sincroniza entidades, campos y relaciones.",
    },
    {
      icon: SearchCode,
      title: "Construye una consulta",
      description: "Selecciona datos mediante el constructor visual.",
    },
  ];
  return (
    <Card className="overflow-hidden border-blue-200 bg-blue-50/60">
      <CardContent className="grid gap-6 p-6 lg:grid-cols-[minmax(0,0.42fr)_minmax(0,1fr)] lg:items-center">
        <div>
          <p className="text-caption font-semibold uppercase tracking-[0.16em] text-primary">
            Primeros pasos
          </p>
          <h2 className="text-heading-2 mt-2">Prepara tu espacio de datos</h2>
          <p className="text-body-small mt-2 text-muted">
            Comienza con una conexión y DataNexus te guiará hasta tu primera consulta.
          </p>
          <Link
            className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2"
            to="/connections/new"
          >
            Crear primera conexión <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
        <ol className="grid gap-3 sm:grid-cols-3">
          {steps.map(({ description, icon: Icon, title }, index) => (
            <li className="rounded-lg border border-blue-100 bg-surface p-4" key={title}>
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg bg-blue-50 text-primary">
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <span className="text-caption font-semibold text-muted">Paso {index + 1}</span>
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground">{title}</p>
              <p className="text-caption mt-1 text-muted">{description}</p>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
