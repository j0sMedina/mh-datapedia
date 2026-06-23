import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useLoginModal } from '../../context/LoginModalContext';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

export function LoginModal() {
  const { isOpen, mode, close, switchMode } = useLoginModal();

  if (!isOpen) return null;

  const isLogin = mode === 'login';

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        className="mh-panel mh-panel--accent mh-glass relative w-full"
        style={{ '--mh-cut': '18px', maxWidth: 400, padding: '30px 28px' } as React.CSSProperties}
      >
        <button
          onClick={close}
          aria-label="Close"
          className="absolute top-3.5 right-4 text-stone-500 hover:text-stone-200 transition-colors"
        >
          <X size={16} />
        </button>

        <div className="mh-section-head text-sm mb-2">
          {isLogin ? 'Hunter Login' : 'Create Account'}
        </div>
        <p className="text-stone-400 text-sm mb-6">
          {isLogin
            ? 'Sign in to save favorites and write strategies.'
            : 'Join to save favorites and contribute strategies.'}
        </p>

        {isLogin
          ? <LoginForm onSuccess={close} />
          : <RegisterForm onSuccess={close} />
        }

        <p className="mt-5 text-center text-stone-500 text-sm">
          {isLogin ? (
            <>
              No account?{' '}
              <button
                onClick={() => switchMode('register')}
                className="text-accent hover:text-accent-hover transition-colors"
              >
                Register
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                onClick={() => switchMode('login')}
                className="text-accent hover:text-accent-hover transition-colors"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>,
    document.body,
  );
}
