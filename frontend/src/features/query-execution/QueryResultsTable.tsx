import type { ExecutionResult } from "./types";
import { ResultCell } from "./ResultCell";

export function QueryResultsTable({ result }: { result: ExecutionResult }) {
  if (!result.rows.length)
    return (
      <div className="p-8 text-center text-sm text-slate-500">La consulta no devolvió filas.</div>
    );
  return (
    <div className="max-h-80 overflow-auto" tabIndex={0}>
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead className="sticky top-0 z-10 bg-slate-100">
          <tr>
            {result.columns.map((column) => (
              <th
                className="border-b px-3 py-2 text-left font-semibold"
                scope="col"
                key={column.key}
              >
                {column.label}
                <span className="block text-[10px] font-normal text-slate-400">
                  {column.data_type}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, index) => (
            <tr className="odd:bg-white even:bg-slate-50" key={index}>
              {result.columns.map((column) => (
                <td className="border-b px-3 py-2" key={column.key}>
                  <ResultCell value={row[column.key]} column={column} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
