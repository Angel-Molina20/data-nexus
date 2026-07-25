import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";

import { APP_NAME, APP_TAGLINE } from "../app/constants";
import { BackendStatus } from "../components/BackendStatus";
import { checkBackendHealth, type BackendStatusValue } from "../services/health";

export function HomePage() {
  const [backendStatus, setBackendStatus] = useState<BackendStatusValue>("checking");

  useEffect(() => {
    const controller = new AbortController();

    void checkBackendHealth(controller.signal).then((status) => {
      setBackendStatus(status);
    });

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-12">
      <div className="max-w-2xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
          Infraestructura inicial
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{APP_NAME}</h1>
        <p className="mt-4 text-xl text-slate-600">{APP_TAGLINE}</p>
        <p className="mt-6 text-slate-600">
          El frontend está funcionando. La gestión de fuentes de datos se incorporará en una fase
          posterior.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <BackendStatus status={backendStatus} />
          <Link
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            to="/connections"
          >
            Ver conexiones
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
