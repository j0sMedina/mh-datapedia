import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { useState } from 'react';
import { useMonster } from '../../hooks/useMonster';
import { MonsterHeader } from '../../components/monsters/detail/MonsterHeader';
import { OverviewTab } from '../../components/monsters/detail/tabs/OverviewTab';
import { HitzonesTab } from '../../components/monsters/detail/tabs/HitzonesTab';
import { WeaknessesTab } from '../../components/monsters/detail/tabs/WeaknessesTab';
import { DropsTab } from '../../components/monsters/detail/tabs/DropsTab';
import { StrategiesTab } from '../../components/monsters/detail/tabs/StrategiesTab';
import { Spinner } from '../../components/ui/Spinner';
import { cn } from '../../lib/utils';

const TABS = ['overview', 'hitzones', 'weaknesses', 'drops', 'strategies'] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  overview: 'Overview',
  hitzones: 'Hitzones',
  weaknesses: 'Weaknesses',
  drops: 'Drops',
  strategies: 'Strategies',
};

const detailSearchSchema = z.object({
  tab: z.enum(TABS).optional().catch('overview'),
});

export const Route = createFileRoute('/monsters/$id')({
  validateSearch: detailSearchSchema,
  component: MonsterDetailPage,
});

function MonsterDetailPage() {
  const { id } = Route.useParams();
  const { tab = 'overview' } = Route.useSearch();
  const navigate = useNavigate({ from: '/monsters/$id' });
  const { data: monster, isLoading, error } = useMonster(id);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const setTab = (t: Tab) => navigate({ search: (prev) => ({ ...prev, tab: t }) });

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !monster) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <p className="text-stone-400">Monster not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <MonsterHeader
        monster={monster}
        onEdit={() => setEditOpen(true)}
        onDelete={() => setDeleteOpen(true)}
      />

      <div className="flex border-b border-stone-800 mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2.5 text-sm whitespace-nowrap transition-colors duration-150',
              tab === t
                ? 'text-amber-500 border-b-2 border-amber-500 -mb-px'
                : 'text-stone-400 hover:text-stone-200',
            )}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div>
        {tab === 'overview' && <OverviewTab monster={monster} />}
        {tab === 'hitzones' && <HitzonesTab monsterId={id} />}
        {tab === 'weaknesses' && <WeaknessesTab monsterId={id} />}
        {tab === 'drops' && <DropsTab monsterId={id} />}
        {tab === 'strategies' && <StrategiesTab monsterId={id} />}
      </div>

      {/* Admin modals wired in Task 12 */}
      {(editOpen || deleteOpen) && null}
    </div>
  );
}
