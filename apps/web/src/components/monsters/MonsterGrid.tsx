import type { MonsterListItem } from '../../lib/types';
import { MonsterCard } from './MonsterCard';
import { Spinner } from '../ui/Spinner';

interface MonsterGridProps {
  monsters: MonsterListItem[];
  isLoading: boolean;
}

export function MonsterGrid({ monsters, isLoading }: MonsterGridProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (monsters.length === 0) {
    return <p className="text-center text-stone-400 py-16">No monsters found.</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {monsters.map((m) => (
        <MonsterCard key={m.id} monster={m} />
      ))}
    </div>
  );
}
