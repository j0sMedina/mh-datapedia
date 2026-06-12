import { createFileRoute, redirect } from '@tanstack/react-router';
import { useFavorites } from '../hooks/useFavorites';
import { MonsterGrid } from '../components/monsters/MonsterGrid';
import { useAuth } from '../context/AuthContext';

export const Route = createFileRoute('/favorites')({
  beforeLoad: ({ context }) => {
    if (!context.auth.user) {
      throw redirect({ to: '/login', search: { redirect: '/favorites' } });
    }
  },
  component: FavoritesPage,
});

function FavoritesPage() {
  const { user } = useAuth();
  const { data: favorites, isLoading } = useFavorites(!!user);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-50">Favorites</h1>
        <p className="text-stone-400 text-sm mt-1">{favorites?.length ?? 0} saved monsters</p>
      </div>

      {!isLoading && !favorites?.length ? (
        <p className="text-stone-500 text-sm py-8">
          No favorites yet. Browse monsters and click the heart icon on a monster's detail page.
        </p>
      ) : (
        <MonsterGrid monsters={favorites ?? []} isLoading={isLoading} />
      )}
    </div>
  );
}
