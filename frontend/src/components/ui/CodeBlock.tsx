import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { IconButton } from "./IconButton";
interface CodeBlockProps { code: string; language?: string; }
export function CodeBlock({ code, language = "text" }: CodeBlockProps) { const [copied, setCopied] = useState(false); return <div className="relative overflow-hidden rounded-md bg-slate-950 text-slate-100"><span className="absolute left-3 top-3 text-xs text-slate-400">{language}</span><IconButton className="absolute right-2 top-2 text-slate-300 hover:bg-slate-800 hover:text-white" label={copied ? "Copiado" : "Copiar código"} onClick={() => { void navigator.clipboard.writeText(code).then(() => { setCopied(true); window.setTimeout(() => { setCopied(false); }, 1500); }); }} size="sm">{copied ? <Check className="size-4" /> : <Copy className="size-4" />}</IconButton><pre className="overflow-auto p-4 pt-12 font-mono text-sm"><code>{code}</code></pre></div>; }
