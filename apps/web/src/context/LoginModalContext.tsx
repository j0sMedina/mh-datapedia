import { createContext, useContext, useState, ReactNode } from 'react';

type AuthMode = 'login' | 'register';

interface AuthModalState {
  isOpen: boolean;
  mode: AuthMode;
  open: (mode?: AuthMode) => void;
  close: () => void;
  switchMode: (mode: AuthMode) => void;
}

const AuthModalContext = createContext<AuthModalState>({
  isOpen: false,
  mode: 'login',
  open: () => {},
  close: () => {},
  switchMode: () => {},
});

export function LoginModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>('login');

  const open = (m: AuthMode = 'login') => { setMode(m); setIsOpen(true); };
  const close = () => setIsOpen(false);
  const switchMode = (m: AuthMode) => setMode(m);

  return (
    <AuthModalContext.Provider value={{ isOpen, mode, open, close, switchMode }}>
      {children}
    </AuthModalContext.Provider>
  );
}

export const useLoginModal = () => useContext(AuthModalContext);
