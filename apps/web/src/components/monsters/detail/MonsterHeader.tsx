import { MapPin, Pencil, Trash2, Heart } from 'lucide-react';
import type { MonsterDetail } from '../../../lib/types';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { TYPE_BADGE_CLASSES } from '../../../lib/constants';
import { cn, formatType } from '../../../lib/utils';
import { useAuth } from '../../../context/AuthContext';
import { useFavorites } from '../../../hooks/useFavorites';
import { useAddFavorite } from '../../../hooks/useAddFavorite';
import { useRemoveFavorite } from '../../../hooks/useRemoveFavorite';

interface MonsterHeaderProps {
  monster: MonsterDetail;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function MonsterHeader({ monster, onEdit, onDelete }: MonsterHeaderProps) {
  const { user } = useAuth();
  const isAdmin = ['HELPER', 'ADMIN', 'MASTER'].includes(user?.role ?? '');
  const { data: favorites } = useFavorites(!!user);
  const isFavorited = favorites?.some((f) => f.id === monster.id) ?? false;
  const addFavorite = useAddFavorite();
  const removeFavorite = useRemoveFavorite();

  const toggleFavorite = () => {
    if (isFavorited) {
      removeFavorite.mutate(monster.id);
    } else {
      addFavorite.mutate(monster.id);
    }
  };

  return (
    <div className="border-b border-stone-800 pb-6 mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-3xl font-bold text-stone-50">{monster.name}</h1>
            {monster.isBoss && (
              <span className="text-accent shrink-0" title="Boss">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <path d="M5 16L3 5l5.5 5L12 2l3.5 8L21 5l-2 11H5m14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
                </svg>
              </span>
            )}
          </div>
          <p className="text-stone-400 text-sm mb-3">{monster.title}</p>
          <div className="flex flex-wrap gap-2">
            <Badge className={cn(TYPE_BADGE_CLASSES[monster.type] ?? 'bg-stone-700 text-stone-400')}>
              {formatType(monster.type)}
            </Badge>
            {monster.habitats.map((h) => (
              <span key={h} className="flex items-center gap-1 text-stone-500 text-xs">
                <MapPin size={10} />
                {h}
              </span>
            ))}
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          {user && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFavorite}
              title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
              disabled={addFavorite.isPending || removeFavorite.isPending}
            >
              <Heart
                size={16}
                className={cn(
                  'transition-colors',
                  isFavorited ? 'fill-red-500 text-red-500' : 'text-stone-400',
                )}
              />
            </Button>
          )}
          {isAdmin && (
            <>
              <Button variant="ghost" size="sm" onClick={onEdit} title="Edit monster">
                <Pencil size={14} />
              </Button>
              <Button variant="ghost" size="sm" onClick={onDelete} title="Delete monster">
                <Trash2 size={14} className="text-red-400" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
