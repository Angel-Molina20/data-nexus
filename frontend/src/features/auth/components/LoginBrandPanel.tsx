import { Braces, Database, Network, TableProperties } from "lucide-react";

function DataFlowIllustration() {
  return (
    <div aria-hidden="true" className="auth-data-flow">
      <svg className="auth-data-flow__lines" viewBox="0 0 620 250">
        <path d="M145 126 C215 126 220 66 295 66" />
        <path d="M145 126 C215 126 220 186 295 186" />
        <path d="M380 66 C455 66 450 126 520 126" />
        <path d="M380 186 C455 186 450 126 520 126" />
      </svg>
      <div className="auth-data-flow__node auth-data-flow__node--source">
        <Database className="size-6" />
        <span>Fuentes</span>
      </div>
      <div className="auth-data-flow__node auth-data-flow__node--query">
        <Braces className="size-5" />
        <span>Consulta</span>
      </div>
      <div className="auth-data-flow__node auth-data-flow__node--model">
        <Network className="size-5" />
        <span>Relaciones</span>
      </div>
      <div className="auth-data-flow__node auth-data-flow__node--result">
        <TableProperties className="size-6" />
        <span>Resultados</span>
      </div>
    </div>
  );
}

export function LoginBrandPanel() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-primary text-white shadow-md">
          <Network aria-hidden="true" className="size-6" />
        </span>
        <div>
          <p className="text-lg font-bold tracking-tight text-white">DataNexus</p>
          <p className="text-caption text-slate-400">Plataforma universal de datos</p>
        </div>
      </div>

      <div className="my-auto py-12">
        <p className="text-caption font-semibold uppercase tracking-[0.2em] text-blue-300">
          Tu espacio de análisis
        </p>
        <h1 className="mt-4 max-w-xl text-4xl font-bold leading-tight tracking-tight text-white xl:text-5xl">
          Conecta tus datos y conviértelos en respuestas.
        </h1>
        <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
          Explora fuentes, construye consultas seguras y crea reportes reutilizables desde un solo
          lugar.
        </p>
        <DataFlowIllustration />
      </div>

      <div className="flex items-center gap-2 text-caption text-slate-400">
        <span className="size-2 rounded-full bg-emerald-400" />
        Acceso protegido para equipos de datos
      </div>
    </div>
  );
}
