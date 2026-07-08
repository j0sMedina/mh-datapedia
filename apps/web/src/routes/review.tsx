import { createFileRoute, redirect } from '@tanstack/react-router';
import { useState } from 'react';
import { useReviewQueue } from '../hooks/useReviewQueue';
import { useReviewStrategy } from '../hooks/useReviewStrategy';
import { Spinner } from '../components/ui/Spinner';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { GAME_NAMES, DIFFICULTY_CLASSES } from '../lib/constants';
import { cn } from '../lib/utils';
import type { Role } from '@mh-datapedia/shared';

const ROLE_RANK: Record<Role, number> = { USER: 0, HELPER: 1, ADMIN: 2, MASTER: 3 };

export const Route = createFileRoute('/review')({
  beforeLoad: ({ context }) => {
    if (!context.auth.user) throw redirect({ to: '/' });
    const role = context.auth.user.role as Role;
    if (ROLE_RANK[role] < ROLE_RANK['HELPER']) throw redirect({ to: '/' });
  },
  component: ReviewPage,
});

function ReviewPage() {
  const { data: queue, isLoading, isError } = useReviewQueue();
  const reviewStrategy = useReviewStrategy();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | null>(null);

  const handleApprove = (id: string) => {
    setMutationError(null);
    setPendingAction('approve');
    reviewStrategy.mutate(
      { id, action: 'approve' },
      {
        onSuccess: () => { setPendingAction(null); },
        onError: () => {
          setPendingAction(null);
          setMutationError('Failed to approve strategy. Please try again.');
        },
      },
    );
  };

  const handleRejectSubmit = (id: string) => {
    if (!reason.trim()) {
      setReasonError('Reason is required');
      return;
    }
    setMutationError(null);
    setPendingAction('reject');
    reviewStrategy.mutate(
      { id, action: 'reject', reason: reason.trim() },
      {
        onSuccess: () => {
          setPendingAction(null);
          setRejectingId(null);
          setReason('');
          setReasonError('');
        },
        onError: () => {
          setPendingAction(null);
          setMutationError('Failed to reject strategy. Please try again.');
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-red-400 text-sm">Failed to load the review queue. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-xl font-display font-bold text-stone-50 mb-6">
        Strategy Review Queue
        {!!queue?.length && (
          <span className="ml-3 text-sm font-normal text-stone-400">{queue.length} pending</span>
        )}
      </h1>

      {!queue?.length && (
        <p className="text-stone-500 text-sm">No strategies pending review.</p>
      )}

      <div className="space-y-4">
        {queue?.map((s) => (
          <div key={s.id} className="bg-stone-900 border border-stone-800 rounded p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5">
                <p className="text-xs text-stone-500">
                  {s.monster.name} · by {s.author.username}
                </p>
                <h3 className="font-medium text-stone-50">{s.title}</h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge className={cn(DIFFICULTY_CLASSES[s.difficulty] ?? 'bg-stone-700 text-stone-400')}>
                  {s.difficulty}
                </Badge>
                <Badge className="bg-stone-800 text-stone-400 border border-stone-700">
                  {GAME_NAMES[s.game] ?? s.game}
                </Badge>
              </div>
            </div>

            <p className="text-stone-300 text-sm leading-relaxed whitespace-pre-wrap">{s.content}</p>

            {rejectingId === s.id ? (
              <div className="space-y-2">
                <textarea
                  value={reason}
                  onChange={(e) => { setReason(e.target.value); setReasonError(''); }}
                  placeholder="Rejection reason (required)"
                  className="w-full bg-stone-800 border border-stone-700 rounded px-3 py-2 text-stone-50 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
                {reasonError && <p className="text-red-400 text-xs">{reasonError}</p>}
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => { setRejectingId(null); setReason(''); setReasonError(''); setMutationError(null); }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={reviewStrategy.isPending}
                    onClick={() => handleRejectSubmit(s.id)}
                  >
                    {reviewStrategy.isPending && pendingAction === 'reject' ? 'Rejecting…' : 'Confirm rejection'}
                  </Button>
                </div>
                {mutationError && <p className="text-red-400 text-sm">{mutationError}</p>}
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap items-center">
                <Button
                  size="sm"
                  disabled={reviewStrategy.isPending}
                  onClick={() => handleApprove(s.id)}
                >
                  {reviewStrategy.isPending && pendingAction === 'approve' ? 'Approving…' : 'Approve'}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={reviewStrategy.isPending}
                  onClick={() => { setRejectingId(s.id); setReason(''); setReasonError(''); setMutationError(null); }}
                >
                  Reject
                </Button>
                {mutationError && <p className="text-red-400 text-sm">{mutationError}</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
