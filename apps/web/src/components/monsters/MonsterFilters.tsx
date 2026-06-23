import { MonsterTypeSchema } from '@mh-datapedia/shared';
import { cn, formatType } from '../../lib/utils';

interface MonsterFiltersProps {
  type: string | undefined;
  search: string | undefined;
  onTypeChange: (type: string | undefined) => void;
  onSearchChange: (search: string | undefined) => void;
}

export function MonsterFilters({
  type,
  search,
  onTypeChange,
  onSearchChange,
}: MonsterFiltersProps) {
  return (
    <div className="space-y-3">
      <input
        type="search"
        placeholder="Search monsters…"
        value={search ?? ''}
        onChange={(e) => onSearchChange(e.target.value || undefined)}
        className="w-full bg-stone-800 border border-stone-700 rounded px-3 py-2 text-stone-50 placeholder-stone-500 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors duration-150"
      />

      <div className="flex flex-wrap gap-2">
        <Pill active={type === undefined} onClick={() => onTypeChange(undefined)}>
          All Types
        </Pill>
        {MonsterTypeSchema.options.map((t) => (
          <Pill
            key={t}
            active={type === t}
            onClick={() => onTypeChange(type === t ? undefined : t)}
          >
            {formatType(t)}
          </Pill>
        ))}
      </div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1 rounded-full text-xs transition-colors duration-150',
        active
          ? 'bg-accent text-stone-950 font-medium'
          : 'bg-stone-800 text-stone-400 hover:bg-stone-700',
      )}
    >
      {children}
    </button>
  );
}
