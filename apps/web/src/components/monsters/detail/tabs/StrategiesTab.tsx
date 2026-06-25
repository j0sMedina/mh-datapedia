import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateStrategySchema } from '@mh-datapedia/shared';
import type { CreateStrategy } from '@mh-datapedia/shared';
import { useStrategies } from '../../../../hooks/useStrategies';
import { useCreateStrategy } from '../../../../hooks/useCreateStrategy';
import { useUpdateStrategy } from '../../../../hooks/useUpdateStrategy';
import { useDeleteStrategy } from '../../../../hooks/useDeleteStrategy';
import { Spinner } from '../../../ui/Spinner';
import { Badge } from '../../../ui/Badge';
import { Button } from '../../../ui/Button';
import { Modal } from '../../../ui/Modal';
import { Input } from '../../../ui/Input';
import { GAME_NAMES, DIFFICULTY_CLASSES } from '../../../../lib/constants';
import { cn } from '../../../../lib/utils';
import { useAuth } from '../../../../context/AuthContext';
import type { Strategy } from '../../../../lib/types';
import { Pencil, Trash2 } from 'lucide-react';

const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'] as const;
const GAME_IDS = ['MONSTER_HUNTER_WILDS'] as const;

function StrategyForm({
  monsterId,
  initial,
  onSave,
  onCancel,
}: {
  monsterId: string;
  initial?: Strategy;
  onSave: (data: CreateStrategy) => Promise<void>;
  onCancel: () => void;
}) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CreateStrategy>({
    resolver: zodResolver(CreateStrategySchema),
    defaultValues: initial
      ? {
          monsterId,
          title: initial.title,
          content: initial.content,
          difficulty: initial.difficulty as CreateStrategy['difficulty'],
          game: initial.game as CreateStrategy['game'],
        }
      : { monsterId },
  });

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-3 bg-stone-900 border border-stone-800 rounded p-4">
      <input type="hidden" value={monsterId} {...register('monsterId')} />
      <Input label="Title" error={errors.title?.message} {...register('title')} />
      <div>
        <label className="block text-stone-300 text-sm mb-1">Content</label>
        <textarea
          className="w-full bg-stone-800 border border-stone-700 rounded px-3 py-2 text-stone-50 text-sm resize-none h-32 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
          {...register('content')}
        />
        {errors.content && <p className="mt-1 text-red-400 text-xs">{errors.content.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-stone-300 text-sm mb-1">Difficulty</label>
          <select className="w-full bg-stone-800 border border-stone-700 rounded px-3 py-2 text-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-accent" {...register('difficulty')}>
            {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-stone-300 text-sm mb-1">Game</label>
          <select className="w-full bg-stone-800 border border-stone-700 rounded px-3 py-2 text-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-accent" {...register('game')}>
            {GAME_IDS.map((g) => <option key={g} value={g}>{GAME_NAMES[g]}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : initial ? 'Save changes' : 'Post strategy'}
        </Button>
      </div>
    </form>
  );
}

export function StrategiesTab({ monsterId }: { monsterId: string }) {
  const { data: strategies, isLoading } = useStrategies(monsterId);
  const { user } = useAuth();
  const createStrategy = useCreateStrategy(monsterId);
  const updateStrategy = useUpdateStrategy(monsterId);
  const deleteStrategy = useDeleteStrategy(monsterId);

  const [writing, setWriting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>;

  const canManage = (s: Strategy) =>
    user && (['ADMIN', 'MASTER'].includes(user.role) || user.id === s.authorId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-stone-400 text-sm">{strategies?.length ?? 0} strategies</h3>
        {user && !writing && (
          <button
            onClick={() => setWriting(true)}
            className="text-sm text-accent hover:text-accent-hover transition-colors duration-150"
          >
            + Write strategy
          </button>
        )}
      </div>

      {writing && (
        <StrategyForm
          monsterId={monsterId}
          onSave={async (data) => {
            await createStrategy.mutateAsync(data);
            setWriting(false);
          }}
          onCancel={() => setWriting(false)}
        />
      )}

      {!strategies?.length && !writing && (
        <p className="text-stone-500 text-sm py-4">No strategies yet. Be the first to contribute!</p>
      )}

      {strategies?.map((s) =>
        editingId === s.id ? (
          <StrategyForm
            key={s.id}
            monsterId={monsterId}
            initial={s}
            onSave={async (data) => {
              const { monsterId: _mid, ...rest } = data;
              await updateStrategy.mutateAsync({ id: s.id, data: rest });
              setEditingId(null);
            }}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <div key={s.id} className="bg-stone-900 border border-stone-800 rounded p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-medium text-stone-50">{s.title}</h4>
              <div className="flex items-center gap-2 shrink-0">
                <Badge className={cn(DIFFICULTY_CLASSES[s.difficulty] ?? 'bg-stone-700 text-stone-400')}>
                  {s.difficulty}
                </Badge>
                {canManage(s) && (
                  <>
                    <button
                      onClick={() => setEditingId(s.id)}
                      className="text-stone-500 hover:text-stone-300 transition-colors"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setDeletingId(s.id)}
                      className="text-stone-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            </div>
            <p className="text-stone-400 text-sm leading-relaxed">{s.content}</p>
            <div className="flex items-center gap-2 text-xs text-stone-600">
              <span>by {s.author.username}</span>
              <span>·</span>
              <span>{GAME_NAMES[s.game] ?? s.game}</span>
            </div>
          </div>
        )
      )}

      <Modal open={!!deletingId} onClose={() => setDeletingId(null)} title="Delete Strategy">
        <div className="space-y-4">
          <p className="text-stone-300 text-sm">Delete this strategy? This cannot be undone.</p>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setDeletingId(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              disabled={deleteStrategy.isPending}
              onClick={async () => {
                if (deletingId) {
                  await deleteStrategy.mutateAsync(deletingId);
                  setDeletingId(null);
                }
              }}
            >
              {deleteStrategy.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
