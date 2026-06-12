import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateMonsterSchema } from '@mh-datapedia/shared';
import type { CreateMonster } from '@mh-datapedia/shared';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useCreateMonster } from '../../hooks/useCreateMonster';
import { useUpdateMonster } from '../../hooks/useUpdateMonster';
import type { MonsterDetail } from '../../lib/types';

const MONSTER_TYPES = ['Large', 'ElderDragon', 'Small', 'Apex', 'Afflicted', 'Tempered'];
const GAME_IDS = [
  'MONSTER_HUNTER_WORLD',
  'MONSTER_HUNTER_WORLD_ICEBORNE',
  'MONSTER_HUNTER_RISE',
  'MONSTER_HUNTER_RISE_SUNBREAK',
  'MONSTER_HUNTER_WILDS',
];

interface MonsterFormModalProps {
  open: boolean;
  onClose: () => void;
  existing?: MonsterDetail;
}

export function MonsterFormModal({ open, onClose, existing }: MonsterFormModalProps) {
  const isEdit = !!existing;
  const createMonster = useCreateMonster();
  const updateMonster = useUpdateMonster(existing?.id ?? '');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateMonster>({ resolver: zodResolver(CreateMonsterSchema) });

  useEffect(() => {
    if (open) {
      reset(
        existing
          ? {
              name: existing.name,
              title: existing.title,
              description: existing.description,
              type: existing.type as CreateMonster['type'],
              firstGame: existing.firstGame as CreateMonster['firstGame'],
              firstYear: existing.firstYear,
              isBoss: existing.isBoss,
              habitats: existing.habitats,
              parentId: existing.parentId ?? null,
            }
          : undefined,
      );
    }
  }, [open, existing, reset]);

  const onSubmit = async (data: CreateMonster) => {
    if (isEdit) {
      await updateMonster.mutateAsync(data);
    } else {
      await createMonster.mutateAsync(data);
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? `Edit ${existing?.name}` : 'Add Monster'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <Input label="Name" error={errors.name?.message} {...register('name')} />
        <Input label="Title" error={errors.title?.message} {...register('title')} />
        <div>
          <label className="block text-stone-300 text-sm mb-1">Description</label>
          <textarea
            className="w-full bg-stone-800 border border-stone-700 rounded px-3 py-2 text-stone-50 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            {...register('description')}
          />
          {errors.description && (
            <p className="mt-1 text-red-400 text-xs">{errors.description.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-stone-300 text-sm mb-1">Type</label>
            <select
              className="w-full bg-stone-800 border border-stone-700 rounded px-3 py-2 text-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              {...register('type')}
            >
              {MONSTER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-stone-300 text-sm mb-1">First Game</label>
            <select
              className="w-full bg-stone-800 border border-stone-700 rounded px-3 py-2 text-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              {...register('firstGame')}
            >
              {GAME_IDS.map((g) => (
                <option key={g} value={g}>
                  {g.replace('MONSTER_HUNTER_', '').replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Input
          label="First Year (real-world debut)"
          type="number"
          error={errors.firstYear?.message}
          {...register('firstYear', { valueAsNumber: true })}
        />
        <Input
          label="Habitats (comma-separated)"
          placeholder="Ancient Forest, Elder Recess"
          {...register('habitats', {
            setValueAs: (v: unknown) =>
              typeof v === 'string'
                ? v.split(',').map((h) => h.trim()).filter(Boolean)
                : v,
          })}
        />

        <div className="flex items-center gap-2">
          <input type="checkbox" id="isBoss" {...register('isBoss')} className="accent-amber-500" />
          <label htmlFor="isBoss" className="text-stone-300 text-sm">Boss monster</label>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create monster'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
