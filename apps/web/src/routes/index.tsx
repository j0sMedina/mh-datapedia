import { createFileRoute, Link } from '@tanstack/react-router';
import { useMonsters } from '../hooks/useMonsters';
import { MonsterCard } from '../components/monsters/MonsterCard';
import { Button } from '../components/ui/Button';
import { GAME_ORDER, GAME_NAMES, GAME_COLORS } from '../lib/constants';
import { cn } from '../lib/utils';
import type { MonsterListItem } from '../lib/types';

export const Route = createFileRoute('/')({ component: LandingPage });

function GameSection({ game }: { game: string }) {
  const { data, isLoading } = useMonsters({ game, limit: 100 });

  const newMonsters: MonsterListItem[] = (data?.data ?? []).filter((m) =>
    m.gameAppearances.some((ga) => ga.game === game && ga.isNew),
  );

  if (!isLoading && newMonsters.length === 0) return null;

  return (
    <div className="mb-10">
      <h2 className={cn('text-lg font-semibold mb-4', GAME_COLORS[game])}>
        {GAME_NAMES[game]}
      </h2>
      {isLoading ? (
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-52 h-28 bg-stone-900 border border-stone-800 rounded-lg animate-pulse shrink-0"
            />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {newMonsters.map((m) => (
            <div key={m.id} className="w-52 shrink-0">
              <MonsterCard monster={m} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LandingPage() {
  return (
    <div>
      <div className="border-b border-stone-800 bg-gradient-to-b from-stone-900 to-stone-950 py-20 px-4 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-stone-50 mb-4 tracking-tight">
          MH <span className="text-amber-500">Datapedia</span>
        </h1>
        <p className="text-stone-400 text-lg max-w-xl mx-auto mb-8">
          Hitzones, weaknesses, drop tables, and hunting strategies for every monster across
          World, Iceborne, Rise, Sunbreak, and Wilds.
        </p>
        <Link to="/monsters">
          <Button size="lg">Browse All Monsters</Button>
        </Link>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-stone-400 text-sm uppercase tracking-wider mb-8">
          New monsters by game
        </h2>
        {GAME_ORDER.map((game) => (
          <GameSection key={game} game={game} />
        ))}
      </div>
    </div>
  );
}
