import { Link } from '@tanstack/react-router';
import type { MonsterDetail } from '../../../../lib/types';
import { Badge } from '../../../ui/Badge';
import { GAME_NAMES } from '../../../../lib/constants';
import { cn } from '../../../../lib/utils';

interface OverviewTabProps {
  monster: MonsterDetail;
}

export function OverviewTab({ monster }: OverviewTabProps) {
  return (
    <div className="space-y-6 max-w-3xl">
      <p className="text-stone-300 leading-relaxed">{monster.description}</p>

      <div>
        <h3 className="text-stone-500 text-xs uppercase tracking-wider mb-3">Game Appearances</h3>
        <div className="flex flex-wrap gap-2">
          {monster.gameAppearances.map((ga) => (
            <span
              key={ga.id}
              className={cn(
                'px-3 py-1 rounded-full text-sm border',
                ga.isNew
                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                  : 'bg-stone-800 text-stone-400 border-stone-700',
              )}
            >
              {GAME_NAMES[ga.game] ?? ga.game}
              {ga.isNew && ' ★'}
            </span>
          ))}
        </div>
      </div>

      {monster.ailments.length > 0 && (
        <div>
          <h3 className="text-stone-500 text-xs uppercase tracking-wider mb-3">Inflicts</h3>
          <div className="flex flex-wrap gap-2">
            {monster.ailments.map((a) => (
              <Badge key={a.id} className="bg-purple-500/10 text-purple-400">
                {a.ailment}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {monster.parent && (
        <div>
          <h3 className="text-stone-500 text-xs uppercase tracking-wider mb-3">Base Species</h3>
          <Link to="/monsters/$id" params={{ id: monster.parent.id }}>
            <Badge className="bg-stone-800 text-stone-300 hover:bg-stone-700 cursor-pointer transition-colors">
              {monster.parent.name}
            </Badge>
          </Link>
        </div>
      )}

      {monster.subspecies.length > 0 && (
        <div>
          <h3 className="text-stone-500 text-xs uppercase tracking-wider mb-3">Subspecies</h3>
          <div className="flex flex-wrap gap-2">
            {monster.subspecies.map((s) => (
              <Link key={s.id} to="/monsters/$id" params={{ id: s.id }}>
                <Badge className="bg-stone-800 text-stone-300 hover:bg-stone-700 cursor-pointer transition-colors">
                  {s.name}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
