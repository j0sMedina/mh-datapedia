import { createPortal } from 'react-dom';
import { Link } from '@tanstack/react-router';
import { X } from 'lucide-react';
import { useLoginModal } from '../../context/LoginModalContext';
import { LoginForm } from './LoginForm';

export function LoginModal() {
  const { isOpen, close } = useLoginModal();

  if (!isOpen) return null;

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
      {/* Glassmorphism panel with MH beveled corners */}
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

        <div className="mh-section-head text-sm mb-2" style={{ letterSpacing: '0.12em' }}>
          Hunter Login
        </div>
        <p className="text-stone-400 text-sm mb-6">
          Sign in to save favorites and write strategies.
        </p>

        <LoginForm onSuccess={close} />

        <p className="mt-5 text-center text-stone-500 text-sm">
          No account?{' '}
          <Link to="/register" onClick={close} className="text-accent hover:text-accent-hover transition-colors">
            Register
          </Link>
        </p>
      </div>
    </div>,
    document.body,
  );
}
