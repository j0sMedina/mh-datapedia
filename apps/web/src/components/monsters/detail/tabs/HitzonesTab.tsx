import { useHitzones } from '../../../../hooks/useHitzones';
import { Spinner } from '../../../ui/Spinner';
import { cn } from '../../../../lib/utils';
import type { Hitzone } from '../../../../lib/types';

const COLS: (keyof Omit<Hitzone, 'id' | 'part'>)[] = [
  'cut', 'blunt', 'bullet', 'fire', 'water', 'thunder', 'ice', 'dragon',
];

const COL_LABELS: Record<string, string> = {
  cut: 'Cut', blunt: 'Blunt', bullet: 'Bullet',
  fire: 'Fire', water: 'Water', thunder: 'Thunder', ice: 'Ice', dragon: 'Dragon',
};

function valueColor(v: number): string {
  if (v >= 45) return 'text-green-400';
  if (v >= 25) return 'text-amber-400';
  return 'text-stone-500';
}

export function HitzonesTab({ monsterId }: { monsterId: string }) {
  const { data: hitzones, isLoading } = useHitzones(monsterId);

  if (isLoading) {
    return <div className="flex justify-center py-8"><Spinner /></div>;
  }
  if (!hitzones?.length) {
    return <p className="text-stone-400 text-sm">No hitzone data available.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border border-stone-800 rounded">
        <thead>
          <tr className="bg-stone-900">
            <th className="text-left px-3 py-2 text-stone-400 font-normal border-b border-stone-800 whitespace-nowrap">
              Part
            </th>
            {COLS.map((col) => (
              <th
                key={col}
                className="px-3 py-2 text-stone-400 font-normal border-b border-stone-800 text-center whitespace-nowrap"
              >
                {COL_LABELS[col]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hitzones.map((hz) => (
            <tr key={hz.id} className="border-b border-stone-800/50 last:border-0 hover:bg-stone-900/50">
              <td className="px-3 py-2 text-stone-50 font-medium">{hz.part}</td>
              {COLS.map((col) => (
                <td key={col} className="px-3 py-2 text-center">
                  <span className={cn('font-mono', valueColor(hz[col] as number))}>
                    {hz[col]}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-stone-600 text-xs mt-2">Values ≥ 45 are effective. All values are placeholder until updated.</p>
    </div>
  );
}
