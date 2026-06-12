import { GAME_ORDER, GAME_NAMES } from '../../lib/constants';
import { cn } from '../../lib/utils';

const MONSTER_TYPES = ['Large', 'ElderDragon', 'Small', 'Apex', 'Afflicted', 'Tempered'];

interface MonsterFiltersProps {
  game: string | undefined;
  type: string | undefined;
  search: string | undefined;
  onGameChange: (game: string | undefined) => void;
  onTypeChange: (type: string | undefined) => void;
  onSearchChange: (search: string | undefined) => void;
}

function shortGame(g: string): string {
  return GAME_NAMES[g].replace('Monster Hunter: ', '').replace('Monster Hunter ', '');
}

export function MonsterFilters({
  game,
  type,
  search,
  onGameChange,
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
        className="w-full bg-stone-800 border border-stone-700 rounded px-3 py-2 text-stone-50 placeholder-stone-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors duration-150"
      />

      <div className="flex flex-wrap gap-2">
        <Pill active={game === undefined} onClick={() => onGameChange(undefined)}>
          All Games
        </Pill>
        {GAME_ORDER.map((g) => (
          <Pill
            key={g}
            active={game === g}
            onClick={() => onGameChange(game === g ? undefined : g)}
          >
            {shortGame(g)}
          </Pill>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Pill active={type === undefined} onClick={() => onTypeChange(undefined)}>
          All Types
        </Pill>
        {MONSTER_TYPES.map((t) => (
          <Pill
            key={t}
            active={type === t}
            onClick={() => onTypeChange(type === t ? undefined : t)}
          >
            {t}
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
          ? 'bg-amber-500 text-stone-950 font-medium'
          : 'bg-stone-800 text-stone-400 hover:bg-stone-700',
      )}
    >
      {children}
    </button>
  );
}
