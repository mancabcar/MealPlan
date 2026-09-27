/** Grupo de radios nativos con aspecto de chip, con nombre accesible (radiogroup). */
export function ChipRadios<T extends string>({
  label,
  name,
  options,
  value,
  onChange,
  scroll = false,
}: {
  label: string;
  name: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  /** Una sola fila con scroll horizontal (con un informe completo hay 23 métricas). */
  scroll?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`flex gap-2 ${scroll ? "overflow-x-auto pb-1" : "flex-wrap"}`}>
      {options.map((o) => (
        <label
          key={o.value}
          className="relative shrink-0 whitespace-nowrap inline-flex items-center px-3 py-1.5 rounded-full text-sm border select-none border-[var(--color-border)] text-[var(--color-text)] has-[:checked]:border-[var(--color-accent)] has-[:checked]:text-[var(--color-accent)] has-[:checked]:bg-[color-mix(in_oklab,var(--color-accent)_18%,var(--color-surface))] has-[:focus-visible]:outline has-[:focus-visible]:outline-2"
        >
          {/* Radio nativo transparente sobre todo el chip: teclado y lector de pantalla como un radio normal */}
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}
