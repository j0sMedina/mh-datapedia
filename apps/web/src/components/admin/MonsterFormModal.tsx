import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateMonsterSchema, MonsterTypeSchema } from '@mh-datapedia/shared';
import type { CreateMonster, MonsterTag } from '@mh-datapedia/shared';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useCreateMonster } from '../../hooks/useCreateMonster';
import { useUpdateMonster } from '../../hooks/useUpdateMonster';
import { TAG_BADGE_CLASSES } from '../../lib/constants';
import { cn, formatType, formatTag } from '../../lib/utils';
import type { MonsterDetail } from '../../lib/types';

const ALL_TAGS: MonsterTag[] = ['Tempered', 'ArchTempered', 'Apex', 'Afflicted'];

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
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateMonster>({
    resolver: zodResolver(CreateMonsterSchema),
    defaultValues: { tags: [] },
  });

  const selectedTags = watch('tags') ?? [];

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
              tags:        (existing.tags ?? []) as MonsterTag[],
            }
          : { tags: [] },
      );
    }
  }, [open, existing, reset]);

  const toggleTag = (tag: MonsterTag) => {
    let next: MonsterTag[];
    if (selectedTags.includes(tag)) {
      next = selectedTags.filter((t) => t !== tag);
    } else {
      next = [...selectedTags, tag];
      // ArchTempered requires Apex — auto-add Apex
      if (tag === 'ArchTempered' && !next.includes('Apex')) {
        next = [...next, 'Apex'];
      }
    }
    setValue('tags', next, { shouldValidate: true });
  };

  const isTagDisabled = (tag: MonsterTag): boolean => {
    if (tag === 'Afflicted') return selectedTags.some((t) => t !== 'Afflicted');
    if (selectedTags.includes('Afflicted')) return true;
    if (tag === 'Tempered' && selectedTags.includes('ArchTempered')) return true;
    if (tag === 'ArchTempered' && selectedTags.includes('Tempered')) return true;
    return false;
  };

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
          <label className="block text-stone-300 text-sm mb-1">Biological Type</label>
          <select
            className="w-full bg-stone-800 border border-stone-700 rounded px-3 py-2 text-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            {...register('type')}
          >
            {MonsterTypeSchema.options.map((t) => (
              <option key={t} value={t}>{formatType(t)}</option>
            ))}
          </select>
          {errors.type && <p className="mt-1 text-red-400 text-xs">{errors.type.message}</p>}
        </div>

        <div>
          <label className="block text-stone-300 text-sm mb-2">Tags</label>
          <div className="flex flex-wrap gap-2">
            {ALL_TAGS.map((tag) => {
              const active = selectedTags.includes(tag);
              const disabled = !active && isTagDisabled(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => !disabled && toggleTag(tag)}
                  disabled={disabled}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs border transition-colors duration-150',
                    active
                      ? TAG_BADGE_CLASSES[tag]
                      : disabled
                        ? 'bg-stone-900 text-stone-600 border-stone-800 cursor-not-allowed'
                        : 'bg-stone-800 text-stone-400 border-stone-700 hover:bg-stone-700',
                  )}
                >
                  {formatTag(tag)}
                </button>
              );
            })}
          </div>
          {errors.tags && (
            <p className="mt-1 text-red-400 text-xs">{errors.tags.message as string}</p>
          )}
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
