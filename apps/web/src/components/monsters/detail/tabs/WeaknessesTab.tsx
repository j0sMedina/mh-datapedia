import { useState } from 'react';
import type { Element } from '@mh-datapedia/shared';
import { useWeaknesses } from '../../../../hooks/useWeaknesses';
import { useUpdateWeaknesses } from '../../../../hooks/useUpdateWeaknesses';
import { useAuth } from '../../../../context/AuthContext';
import { Spinner } from '../../../ui/Spinner';
import { Badge } from '../../../ui/Badge';
import { Button } from '../../../ui/Button';
import { ELEMENT_COLORS } from '../../../../lib/constants';
import { cn } from '../../../../lib/utils';

const ALL_ELEMENTS: Element[] = [
  'Fire', 'Water', 'Thunder', 'Ice', 'Dragon',
  'Poison', 'Sleep', 'Paralysis', 'Blast', 'Stun',
];

type DraftEntry = { rating: 0 | 1 | 2 | 3; isImmune: boolean };
type Draft = Record<string, DraftEntry>;

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

function EditableStars({
  element,
  rating,
  isImmune,
  onStarClick,
  onImmuneChange,
}: {
  element: string;
  rating: 0 | 1 | 2 | 3;
  isImmune: boolean;
  onStarClick: (element: string, starIndex: number) => void;
  onImmuneChange: (element: string, immune: boolean) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-0.5 justify-center">
        {[1, 2, 3].map((i) => (
          <button
            key={i}
            type="button"
            aria-label={`Set ${element} weakness to ${i} star${i !== 1 ? 's' : ''}`}
            aria-pressed={i === rating}
            disabled={isImmune}
            onClick={() => onStarClick(element, i)}
            className={cn(
              'text-base transition-colors',
              isImmune
                ? 'text-stone-800 cursor-not-allowed'
                : i <= rating
                ? 'text-amber-400 hover:text-amber-300'
                : 'text-stone-700 hover:text-stone-500',
            )}
          >
            ★
          </button>
        ))}
      </div>
      <label className="flex items-center gap-1 text-xs text-stone-400 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isImmune}
          onChange={(e) => onImmuneChange(element, e.target.checked)}
          className="accent-red-500"
        />
        Immune
      </label>
    </div>
  );
}

export function WeaknessesTab({ monsterId }: { monsterId: string }) {
  const { data: weaknesses, isLoading } = useWeaknesses(monsterId);
  const updateWeaknesses = useUpdateWeaknesses(monsterId);
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>({});

  function enterEditMode() {
    const weaknessMap = Object.fromEntries((weaknesses ?? []).map((w) => [w.element, w]));
    const initialDraft: Draft = {};
    for (const el of ALL_ELEMENTS) {
      const w = weaknessMap[el];
      initialDraft[el] = {
        rating: (w?.rating ?? 0) as 0 | 1 | 2 | 3,
        isImmune: w?.isImmune ?? false,
      };
    }
    setDraft(initialDraft);
    setEditing(true);
  }

  function handleCancel() {
    setEditing(false);
  }

  function handleStarClick(element: string, starIndex: number) {
    setDraft((prev) => {
      const current = prev[element];
      const newRating = starIndex === current.rating ? starIndex - 1 : starIndex;
      return { ...prev, [element]: { ...current, rating: newRating as 0 | 1 | 2 | 3 } };
    });
  }

  function handleImmuneChange(element: string, immune: boolean) {
    setDraft((prev) => ({
      ...prev,
      [element]: { rating: immune ? 0 : prev[element].rating, isImmune: immune },
    }));
  }

  async function handleSave() {
    const payload = ALL_ELEMENTS.map((el) => ({
      element: el,
      rating: (draft[el]?.rating ?? 0) as 0 | 1 | 2 | 3,
      isImmune: draft[el]?.isImmune ?? false,
    }));
    try {
      await updateWeaknesses.mutateAsync(payload);
      setEditing(false);
    } catch {
      // updateWeaknesses.error is available for display
    }
  }

  if (isLoading) {
    return <div className="flex justify-center py-8"><Spinner /></div>;
  }

  if (editing) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {ALL_ELEMENTS.map((element) => {
            const entry = draft[element] ?? { rating: 0 as const, isImmune: false };
            return (
              <div key={element} className="bg-stone-900 border border-stone-700 rounded p-3 text-center">
                <div className={cn('font-medium text-sm mb-2', ELEMENT_COLORS[element] ?? 'text-stone-400')}>
                  {element}
                </div>
                <EditableStars
                  element={element}
                  rating={entry.rating}
                  isImmune={entry.isImmune}
                  onStarClick={handleStarClick}
                  onImmuneChange={handleImmuneChange}
                />
              </div>
            );
          })}
        </div>
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={updateWeaknesses.isPending}
          >
            {updateWeaknesses.isPending ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleCancel} disabled={updateWeaknesses.isPending}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  const weaknessMap = Object.fromEntries((weaknesses ?? []).map((w) => [w.element, w]));

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={enterEditMode}>
            Edit weaknesses
          </Button>
        </div>
      )}
      {!weaknesses?.length ? (
        <p className="text-stone-400 text-sm">No weakness data available.</p>
      ) : (
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
      )}
    </div>
  );
}
