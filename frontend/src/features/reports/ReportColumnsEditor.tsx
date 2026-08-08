import { ArrowDown, ArrowUp } from "lucide-react";

import type { ReportColumn } from "./types";

export function ReportColumnsEditor({ columns, onChange }: { columns: ReportColumn[]; onChange: (columns: ReportColumn[]) => void }) {
  const update = (index: number, patch: Partial<ReportColumn>) => {
    onChange(columns.map((item, current) => current === index ? { ...item, ...patch } : item));
  };
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    const sourceColumn = columns[index];
    const targetColumn = columns[target];
    if (!sourceColumn || !targetColumn) return;
    const next = [...columns];
    next[index] = targetColumn;
    next[target] = sourceColumn;
    onChange(next.map((item, position) => ({ ...item, position })));
  };
  return <section><h2 className="font-bold">Columnas</h2><p className="mt-1 text-sm text-slate-500">Configura visibilidad, orden, etiqueta y formato.</p><div className="mt-3 space-y-2">{columns.map((column, index) => <div className="grid gap-2 rounded-lg border p-3 md:grid-cols-[auto_1fr_150px_120px_auto] md:items-center" key={column.source_key}><input aria-label={`Mostrar ${column.label}`} type="checkbox" checked={column.visible} onChange={(event) => { update(index, { visible: event.target.checked }); }} /><input aria-label={`Etiqueta de ${column.source_key}`} className="field" value={column.label} onChange={(event) => { update(index, { label: event.target.value }); }} /><select aria-label={`Formato de ${column.source_key}`} className="field" value={column.format.type} onChange={(event) => { update(index, { format: { ...column.format, type: event.target.value } }); }}>{["automatic", "text", "integer", "decimal", "currency", "percentage", "boolean", "date", "datetime", "time", "json"].map((value) => <option key={value}>{value}</option>)}</select><select aria-label={`Alineación de ${column.source_key}`} className="field" value={column.alignment} onChange={(event) => { update(index, { alignment: event.target.value as ReportColumn["alignment"] }); }}><option value="left">Izquierda</option><option value="center">Centro</option><option value="right">Derecha</option></select><div className="flex"><button type="button" aria-label={`Subir ${column.label}`} className="icon-button" disabled={index === 0} onClick={() => { move(index, -1); }}><ArrowUp className="size-4" /></button><button type="button" aria-label={`Bajar ${column.label}`} className="icon-button" disabled={index === columns.length - 1} onClick={() => { move(index, 1); }}><ArrowDown className="size-4" /></button></div></div>)}</div></section>;
}
