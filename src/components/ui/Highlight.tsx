// Resaltado de la búsqueda (docs/pm/combobox-recetas/tech.md): pinta en acento el tramo del texto que coincide con
// la consulta, ignorando tildes y mayúsculas. El texto se lee igual: <mark> no cambia el nombre accesible.
import { Fragment } from "react";
import { highlightRanges } from "@/lib/text";

export function Highlight({ text, query }: { text: string; query: string }) {
  const ranges = highlightRanges(text, query);
  if (ranges.length === 0) return <>{text}</>;

  const parts: React.ReactNode[] = [];
  let from = 0;
  ranges.forEach(([start, end], i) => {
    if (start > from) parts.push(<Fragment key={`t${i}`}>{text.slice(from, start)}</Fragment>);
    parts.push(
      <mark key={`m${i}`} className="bg-transparent font-semibold text-[var(--color-accent)]">
        {text.slice(start, end)}
      </mark>,
    );
    from = end;
  });
  if (from < text.length) parts.push(<Fragment key="rest">{text.slice(from)}</Fragment>);
  return <>{parts}</>;
}
