import { createFileRoute, redirect } from '@tanstack/react-router';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTotpSetup } from '../../hooks/useTotpSetup';
import { useTotpEnable } from '../../hooks/useTotpEnable';
import { useTotpDisable } from '../../hooks/useTotpDisable';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ApiError } from '../../lib/api';

export const Route = createFileRoute('/account/two-factor-auth')({
  beforeLoad: ({ context }) => {
    if (!context.auth.user) {
      throw redirect({ to: '/login' });
    }
  },
  component: TwoFactorAuthPage,
});

function TwoFactorAuthPage() {
  const { user, fetchUser } = useAuth();
  const totpSetup = useTotpSetup();
  const totpEnable = useTotpEnable();
  const totpDisable = useTotpDisable();

  const [setupData, setSetupData] = useState<{ qrCodeDataUrl: string; secret: string } | null>(null);
  const [enableCode, setEnableCode] = useState('');
  const [enableError, setEnableError] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  const [disableMode, setDisableMode] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableError, setDisableError] = useState('');

  async function handleSetup() {
    try {
      const data = await totpSetup.mutateAsync();
      setSetupData(data);
      setEnableCode('');
      setEnableError('');
    } catch {
      setEnableError('Something went wrong. Please try again.');
    }
  }

  async function handleEnable() {
    setEnableError('');
    try {
      const result = await totpEnable.mutateAsync({ code: enableCode });
      setSetupData(null);
      setBackupCodes(result.backupCodes);
    } catch (err) {
      if (err instanceof ApiError && (err.body as { code?: string })?.code === 'INVALID_CODE') {
        setEnableError('Invalid code. Please try again.');
      } else {
        setEnableError('Something went wrong. Please try again.');
      }
    }
  }

  async function handleBackupCodesDone() {
    setBackupCodes(null);
    await fetchUser();
  }

  async function handleDisable() {
    setDisableError('');
    try {
      await totpDisable.mutateAsync({ password: disablePassword });
      setDisableMode(false);
      setDisablePassword('');
      await fetchUser();
    } catch (err) {
      if (err instanceof ApiError && (err.body as { code?: string })?.code === 'INVALID_PASSWORD') {
        setDisableError('Incorrect password.');
      } else {
        setDisableError('Something went wrong. Please try again.');
      }
    }
  }

  if (!user) return null;

  // One-time backup codes display after enabling
  if (backupCodes) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-stone-900 rounded-lg p-8 border border-stone-800">
            <h1 className="text-2xl font-bold text-stone-50 mb-2">Save your backup codes</h1>
            <p className="text-stone-400 text-sm mb-6">
              Store these somewhere safe. Each code can be used once if you lose access to your authenticator app.
            </p>
            <div className="bg-stone-950 rounded p-4 mb-6 font-mono text-sm space-y-1">
              {backupCodes.map((code) => (
                <div key={code} className="text-stone-200">{code}</div>
              ))}
            </div>
            <Button className="w-full" onClick={handleBackupCodesDone}>
              I've saved my backup codes
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-stone-900 rounded-lg p-8 border border-stone-800 space-y-6">
          <h1 className="text-2xl font-bold text-stone-50">Two-Factor Authentication</h1>

          {user.totpEnabled ? (
            <div className="space-y-4">
              <p className="text-green-400 text-sm">&#10003; Two-factor authentication is active.</p>
              {disableMode ? (
                <div className="space-y-3">
                  <Input
                    id="disable-password"
                    label="Current password"
                    type="password"
                    placeholder="Enter your password to confirm"
                    value={disablePassword}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setDisablePassword(e.target.value)
                    }
                  />
                  {disableError && <p className="text-red-400 text-sm">{disableError}</p>}
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setDisableMode(false);
                        setDisablePassword('');
                        setDisableError('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleDisable}
                      disabled={totpDisable.isPending || !disablePassword}
                      className="text-red-400"
                    >
                      {totpDisable.isPending ? 'Disabling…' : 'Disable 2FA'}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="ghost" onClick={() => setDisableMode(true)}>
                  Disable Two-Factor Authentication
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-stone-400 text-sm">
                Use an authenticator app (Google Authenticator, Authy) to generate time-based codes.
              </p>
              {!setupData ? (
                <Button onClick={handleSetup} disabled={totpSetup.isPending}>
                  {totpSetup.isPending ? 'Setting up…' : 'Set up Two-Factor Authentication'}
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="text-center">
                    <img src={setupData.qrCodeDataUrl} alt="TOTP QR code" className="inline-block rounded" />
                  </div>
                  <div>
                    <p className="text-stone-400 text-xs mb-1">Or enter this code manually:</p>
                    <code className="block bg-stone-950 rounded p-2 text-stone-200 text-sm font-mono break-all">
                      {setupData.secret}
                    </code>
                  </div>
                  <Input
                    id="totp-enable-code"
                    label="Enter 6-digit code to verify"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={enableCode}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setEnableCode(e.target.value)
                    }
                  />
                  {enableError && <p className="text-red-400 text-sm">{enableError}</p>}
                  <Button
                    className="w-full"
                    onClick={handleEnable}
                    disabled={totpEnable.isPending || enableCode.length !== 6}
                  >
                    {totpEnable.isPending ? 'Verifying…' : 'Verify and enable'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
