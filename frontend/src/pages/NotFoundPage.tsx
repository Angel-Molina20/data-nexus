import { FileQuestion } from "lucide-react";

import { PageContainer } from "../components/layout/PageContainer";
import { BackButton } from "../components/navigation/BackButton";

export function NotFoundPage() {
  return (
    <PageContainer>
      <div className="flex min-h-[540px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-6 text-center shadow-sm">
        <span className="rounded-2xl bg-slate-100 p-4 text-slate-500">
          <FileQuestion aria-hidden="true" className="size-10" />
        </span>
        <p className="mt-5 text-sm font-semibold text-blue-600">Error 404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Página no encontrada
        </h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">
          La dirección solicitada no corresponde a ningún módulo disponible de DataNexus.
        </p>
        <div className="mt-6">
          <BackButton fallback="/" label="Volver" />
        </div>
      </div>
    </PageContainer>
  );
}
