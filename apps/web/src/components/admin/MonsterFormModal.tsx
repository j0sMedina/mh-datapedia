import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateMonsterSchema, MonsterTypeSchema } from '@mh-datapedia/shared';
import type { CreateMonster } from '@mh-datapedia/shared';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useCreateMonster } from '../../hooks/useCreateMonster';
import { useUpdateMonster } from '../../hooks/useUpdateMonster';
import type { MonsterDetail } from '../../lib/types';

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
              name:        existing.name,
              title:       existing.title,
              description: existing.description,
              type:        existing.type as CreateMonster['type'],
              isBoss:      existing.isBoss,
              habitats:    existing.habitats,
              parentId:    existing.parentId ?? null,
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
            className="w-full bg-stone-800 border border-stone-700 rounded px-3 py-2 text-stone-50 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
            {...register('description')}
          />
          {errors.description && (
            <p className="mt-1 text-red-400 text-xs">{errors.description.message}</p>
          )}
        </div>

        <div>
          <label className="block text-stone-300 text-sm mb-1">Type</label>
          <select
            className="w-full bg-stone-800 border border-stone-700 rounded px-3 py-2 text-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            {...register('type')}
          >
            {MonsterTypeSchema.options.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <Input
          label="Habitats (comma-separated)"
          placeholder="Windward Plains, Scarlet Forest"
          {...register('habitats', {
            setValueAs: (v: unknown) =>
              typeof v === 'string'
                ? v.split(',').map((h) => h.trim()).filter(Boolean)
                : v,
          })}
        />

        <div className="flex items-center gap-2">
          <input type="checkbox" id="isBoss" {...register('isBoss')} className="accent-accent" />
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
