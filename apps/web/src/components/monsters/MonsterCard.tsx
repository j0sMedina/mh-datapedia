import { Link } from '@tanstack/react-router';
import type { MonsterListItem } from '../../lib/types';
import { Badge } from '../ui/Badge';
import { TYPE_BADGE_CLASSES } from '../../lib/constants';
import { cn, formatType } from '../../lib/utils';

interface MonsterCardProps {
  monster: MonsterListItem;
}

export function MonsterCard({ monster }: MonsterCardProps) {
  return (
    <Link
      to="/monsters/$id"
      params={{ id: monster.id }}
      className="block bg-stone-900 border border-stone-800 rounded-lg p-4 hover:border-stone-700 hover:bg-stone-800/50 transition-colors duration-150 group"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="font-semibold text-stone-50 group-hover:text-accent-hover transition-colors duration-150 leading-tight">
          {monster.name}
        </h3>
        {monster.isBoss && (
          <span className="text-accent shrink-0 mt-0.5 text-[13px]" title="Boss">♛</span>
        )}
      </div>

      <p className="text-stone-500 text-xs mb-3 line-clamp-1">{monster.title}</p>

      <div className="flex flex-wrap gap-1.5">
        <Badge className={cn(TYPE_BADGE_CLASSES[monster.type] ?? 'bg-stone-700 text-stone-400')}>
          {formatType(monster.type)}
        </Badge>
      </div>
    </Link>
  );
}
