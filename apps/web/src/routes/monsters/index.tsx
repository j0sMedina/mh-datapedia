import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { useState } from 'react';
import { useMonsters } from '../../hooks/useMonsters';
import { MonsterFilters } from '../../components/monsters/MonsterFilters';
import { MonsterGrid } from '../../components/monsters/MonsterGrid';
import { Button } from '../../components/ui/Button';
import { MonsterFormModal } from '../../components/admin/MonsterFormModal';
import { useAuth } from '../../context/AuthContext';

const monsterSearchSchema = z.object({
  type:   z.string().optional(),
  search: z.string().optional(),
  page:   z.coerce.number().int().min(1).default(1).catch(1),
});

export const Route = createFileRoute('/monsters/')({
  validateSearch: monsterSearchSchema,
  component: MonstersPage,
});

function MonstersPage() {
  const { user } = useAuth();
  const navigate = useNavigate({ from: '/monsters/' });
  const { type, search, page } = Route.useSearch();
  const { data, isLoading } = useMonsters({ type, search, page });
  const [showAddModal, setShowAddModal] = useState(false);

  const setFilter = (key: 'type' | 'search', val: string | undefined) => {
    navigate({ search: (prev) => ({ ...prev, [key]: val, page: 1 }) });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-50">Monsters</h1>
        {user?.role === 'ADMIN' && (
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            + Add Monster
          </Button>
        )}
      </div>

      <div className="mb-6">
        <MonsterFilters
          type={type}
          search={search}
          onTypeChange={(t) => setFilter('type', t)}
          onSearchChange={(s) => setFilter('search', s)}
        />
      </div>

      <MonsterGrid monsters={data?.data ?? []} isLoading={isLoading} />

      {data && data.meta.totalPages > 1 && (
        <div className="flex justify-center items-center gap-3 mt-8">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => navigate({ search: (prev) => ({ ...prev, page: page - 1 }) })}
          >
            Previous
          </Button>
          <span className="text-stone-400 text-sm">
            {page} / {data.meta.totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= data.meta.totalPages}
            onClick={() => navigate({ search: (prev) => ({ ...prev, page: page + 1 }) })}
          >
            Next
          </Button>
        </div>
      )}

      <MonsterFormModal open={showAddModal} onClose={() => setShowAddModal(false)} />
    </div>
  );
}
