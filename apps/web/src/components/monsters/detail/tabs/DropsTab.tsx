import { useState } from 'react';
import { useDrops } from '../../../../hooks/useDrops';
import { Spinner } from '../../../ui/Spinner';
import { GAME_ORDER, GAME_NAMES, DROP_METHOD_NAMES } from '../../../../lib/constants';
import { cn } from '../../../../lib/utils';
import type { MonsterDrop } from '../../../../lib/types';

const RANKS = ['LowRank', 'HighRank', 'MasterRank'] as const;
const RANK_LABELS: Record<string, string> = { LowRank: 'LR', HighRank: 'HR', MasterRank: 'MR' };

function groupByMethod(drops: MonsterDrop[]): Record<string, MonsterDrop[]> {
  return drops.reduce<Record<string, MonsterDrop[]>>((acc, d) => {
    if (!acc[d.method]) acc[d.method] = [];
    acc[d.method].push(d);
    return acc;
  }, {});
}

function Pill({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1 rounded-full text-xs transition-colors duration-150',
        active ? 'bg-accent text-stone-950 font-medium' : 'bg-stone-800 text-stone-400 hover:bg-stone-700',
      )}
    >
      {children}
    </button>
  );
}

export function DropsTab({ monsterId }: { monsterId: string }) {
  const [game, setGame] = useState<string | undefined>();
  const [rank, setRank] = useState<string | undefined>();
  const { data: drops, isLoading } = useDrops(monsterId, game, rank);

  const grouped = groupByMethod(drops ?? []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-wrap gap-2">
          <Pill active={!game} onClick={() => setGame(undefined)}>All Games</Pill>
          {GAME_ORDER.map((g) => (
            <Pill key={g} active={game === g} onClick={() => setGame(game === g ? undefined : g)}>
              {GAME_NAMES[g].replace('Monster Hunter: ', '').replace('Monster Hunter ', '')}
            </Pill>
          ))}
        </div>
        <div className="flex gap-2">
          <Pill active={!rank} onClick={() => setRank(undefined)}>All Ranks</Pill>
          {RANKS.map((r) => (
            <Pill key={r} active={rank === r} onClick={() => setRank(rank === r ? undefined : r)}>
              {RANK_LABELS[r]}
            </Pill>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : Object.keys(grouped).length === 0 ? (
        <p className="text-stone-400 text-sm">No drops match the selected filters.</p>
      ) : (
        Object.entries(grouped).map(([method, methodDrops]) => (
          <div key={method}>
            <h3 className="text-stone-500 text-xs uppercase tracking-wider mb-2">
              {DROP_METHOD_NAMES[method] ?? method}
            </h3>
            <div className="border border-stone-800 rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-900 border-b border-stone-800">
                    <th className="text-left px-3 py-2 text-stone-400 font-normal">Item</th>
                    <th className="text-left px-3 py-2 text-stone-400 font-normal hidden sm:table-cell">Part</th>
                    <th className="text-left px-3 py-2 text-stone-400 font-normal hidden sm:table-cell">Rank</th>
                    <th className="text-right px-3 py-2 text-stone-400 font-normal">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {methodDrops.map((drop) => (
                    <tr key={drop.id} className="border-b border-stone-800/40 last:border-0 hover:bg-stone-900/50">
                      <td className="px-3 py-2 text-stone-50">{drop.itemName}</td>
                      <td className="px-3 py-2 text-stone-400 hidden sm:table-cell">{drop.part ?? '—'}</td>
                      <td className="px-3 py-2 text-stone-500 text-xs hidden sm:table-cell">
                        {RANK_LABELS[drop.rank] ?? drop.rank}
                      </td>
                      <td className="px-3 py-2 text-right text-accent">{drop.rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
