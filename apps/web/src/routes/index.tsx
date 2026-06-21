import { createFileRoute, Link } from '@tanstack/react-router';
import { useMonsters } from '../hooks/useMonsters';
import { MonsterCard } from '../components/monsters/MonsterCard';
import { Button } from '../components/ui/Button';

export const Route = createFileRoute('/')({ component: LandingPage });

function LandingPage() {
  const { data, isLoading } = useMonsters({ limit: 8 });

  return (
    <div>
      <div className="border-b border-stone-800 bg-gradient-to-b from-stone-900 to-stone-950 py-20 px-4 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-stone-50 mb-4 tracking-tight">
          MH <span className="text-amber-500">Datapedia</span>
        </h1>
        <p className="text-stone-400 text-lg max-w-xl mx-auto mb-8">
          Hitzones, weaknesses, drop tables, and hunting strategies for every monster in
          Monster Hunter Wilds.
        </p>
        <Link to="/monsters">
          <Button size="lg">Browse All Monsters</Button>
        </Link>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-stone-400 text-sm uppercase tracking-wider mb-8">
          Monster Hunter Wilds
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
            {(data?.data ?? []).map((m) => (
              <div key={m.id} className="w-52 shrink-0">
                <MonsterCard monster={m} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
