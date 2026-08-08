import type { ReactNode } from "react";
interface KeyValueItem { label: string; value: ReactNode; }
export function KeyValueList({ items }: { items: KeyValueItem[] }) { return <dl className="divide-y divide-border">{items.map((item) => <div className="grid gap-1 py-3 text-sm sm:grid-cols-[minmax(8rem,0.4fr)_1fr]" key={item.label}><dt className="font-medium text-muted">{item.label}</dt><dd className="min-w-0 text-foreground-secondary">{item.value}</dd></div>)}</dl>; }
