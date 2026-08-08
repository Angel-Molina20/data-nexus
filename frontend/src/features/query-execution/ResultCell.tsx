import { useState } from "react";

import type { ExecutionColumn } from "./types";

export function ResultCell({ value, column }: { value: unknown; column: ExecutionColumn }) {
  const [open, setOpen] = useState(false);
  const rendered = formatValue(value, column.data_type);
  return (
    <>
      <button
        className={`block max-w-80 truncate text-left ${["integer", "decimal"].includes(column.data_type) ? "ml-auto tabular-nums" : ""}`}
        onClick={() => {
          setOpen(true);
        }}
        title="Inspeccionar valor"
      >
        {rendered}
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cell-title"
        >
          <div className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 id="cell-title" className="font-bold">
                {column.label}
              </h2>
              <button
                className="btn-secondary"
                autoFocus
                onClick={() => {
                  setOpen(false);
                }}
              >
                Cerrar
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {column.data_type}
              {column.nullable ? " · admite NULL" : ""}
            </p>
            <pre className="mt-4 whitespace-pre-wrap break-words rounded-lg bg-slate-100 p-4 text-sm">
              {inspectValue(value)}
            </pre>
          </div>
        </div>
      ) : null}
    </>
  );
}

function formatValue(value: unknown, type: string) {
  if (value === null) return <span className="italic text-slate-400">NULL</span>;
  if (type === "boolean") return value ? "Sí" : "No";
  if (type === "json" || typeof value === "object") return JSON.stringify(value);
  if (type === "binary") return "Contenido binario";
  return primitiveString(value);
}

function inspectValue(value: unknown) {
  if (value === null) return "NULL";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return primitiveString(value);
}
function primitiveString(value: unknown) {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? String(value)
    : "";
}
