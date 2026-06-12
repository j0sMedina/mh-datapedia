import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useDeleteMonster } from '../../hooks/useDeleteMonster';

interface DeleteConfirmModalProps {
  open: boolean;
  onClose: () => void;
  monsterId: string;
  monsterName: string;
}

export function DeleteConfirmModal({
  open,
  onClose,
  monsterId,
  monsterName,
}: DeleteConfirmModalProps) {
  const deleteMonster = useDeleteMonster();

  const handleDelete = async () => {
    await deleteMonster.mutateAsync(monsterId);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Delete Monster">
      <div className="space-y-4">
        <p className="text-stone-300 text-sm">
          Are you sure you want to delete{' '}
          <span className="text-stone-50 font-medium">{monsterName}</span>? This also deletes all
          associated hitzones, weaknesses, drops, and strategies.
        </p>
        <p className="text-red-400 text-xs">This action cannot be undone.</p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={handleDelete}
            disabled={deleteMonster.isPending}
          >
            {deleteMonster.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
