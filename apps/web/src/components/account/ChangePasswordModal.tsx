import { useState, FormEvent } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useChangePassword } from '../../hooks/useChangePassword';
import { ApiError } from '../../lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ChangePasswordModal({ open, onClose }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [clientError, setClientError] = useState('');
  const changePassword = useChangePassword();

  function resetForm() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setClientError('');
    changePassword.reset();
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setClientError('');
    if (newPassword !== confirmPassword) {
      setClientError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setClientError('New password must be at least 8 characters.');
      return;
    }
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      handleClose();
    } catch {
      // error displayed below
    }
  }

  const serverError =
    changePassword.error instanceof ApiError &&
    (changePassword.error.body as { code?: string })?.code === 'INVALID_PASSWORD'
      ? 'Current password is incorrect.'
      : changePassword.isError
        ? 'Something went wrong. Please try again.'
        : '';

  const error = clientError || serverError;

  return (
    <Modal open={open} onClose={handleClose} title="Change Password">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-stone-400 text-sm mb-1">Current Password</label>
          <Input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        <div>
          <label className="block text-stone-400 text-sm mb-1">New Password</label>
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="block text-stone-400 text-sm mb-1">Confirm New Password</label>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={changePassword.isPending}>
            {changePassword.isPending ? 'Updating…' : 'Update Password'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
