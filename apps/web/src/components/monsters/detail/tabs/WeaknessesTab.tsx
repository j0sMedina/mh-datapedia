import { useWeaknesses } from '../../../../hooks/useWeaknesses';
import { Spinner } from '../../../ui/Spinner';
import { Badge } from '../../../ui/Badge';
import { ELEMENT_COLORS } from '../../../../lib/constants';
import { cn } from '../../../../lib/utils';

const ALL_ELEMENTS = [
  'Fire', 'Water', 'Thunder', 'Ice', 'Dragon',
  'Poison', 'Sleep', 'Paralysis', 'Blast', 'Stun',
];

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5 justify-center">
      {[1, 2, 3].map((i) => (
        <span key={i} className={cn('text-base', i <= rating ? 'text-amber-400' : 'text-stone-700')}>
          ★
        </span>
      ))}
    </div>
  );
}

export function WeaknessesTab({ monsterId }: { monsterId: string }) {
  const { data: weaknesses, isLoading } = useWeaknesses(monsterId);

  if (isLoading) {
    return <div className="flex justify-center py-8"><Spinner /></div>;
  }
  if (!weaknesses?.length) {
    return <p className="text-stone-400 text-sm">No weakness data available.</p>;
  }

  const weaknessMap = Object.fromEntries(weaknesses.map((w) => [w.element, w]));

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
      {ALL_ELEMENTS.map((element) => {
        const w = weaknessMap[element];
        return (
          <div key={element} className="bg-stone-900 border border-stone-800 rounded p-3 text-center">
            <div className={cn('font-medium text-sm mb-2', ELEMENT_COLORS[element] ?? 'text-stone-400')}>
              {element}
            </div>
            {!w ? (
              <Stars rating={0} />
            ) : w.isImmune ? (
              <Badge className="bg-red-500/10 text-red-400 border border-red-500/20">Immune</Badge>
            ) : (
              <Stars rating={w.rating} />
            )}
          </div>
        );
      })}
    </div>
  );
}
