import { MonsterTypeSchema, MonsterTagSchema } from '@mh-datapedia/shared';
import { TAG_BADGE_CLASSES } from '../../lib/constants';
import { cn, formatType, formatTag } from '../../lib/utils';

const ALL_TAGS = MonsterTagSchema.options;

interface MonsterFiltersProps {
  type: string | undefined;
  tags: string[];
  search: string | undefined;
  onTypeChange: (type: string | undefined) => void;
  onTagsChange: (tags: string[]) => void;
  onSearchChange: (search: string | undefined) => void;
}

export function MonsterFilters({
  type,
  tags,
  search,
  onTypeChange,
  onTagsChange,
  onSearchChange,
}: MonsterFiltersProps) {
  const toggleTag = (tag: string) => {
    onTagsChange(tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]);
  };

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

      <div className="flex flex-wrap gap-2">
        {ALL_TAGS.map((tag) => (
          <button
            key={tag}
            onClick={() => toggleTag(tag)}
            className={cn(
              'px-3 py-1 rounded-full text-xs transition-colors duration-150 border',
              tags.includes(tag)
                ? TAG_BADGE_CLASSES[tag]
                : 'bg-stone-800 text-stone-400 border-stone-700 hover:bg-stone-700',
            )}
          >
            {formatTag(tag)}
          </button>
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
