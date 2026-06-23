import { createContext, useContext, useState, ReactNode } from 'react';

interface LoginModalState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const LoginModalContext = createContext<LoginModalState>({
  isOpen: false,
  open: () => {},
  close: () => {},
});

export function LoginModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <LoginModalContext.Provider
      value={{ isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) }}
    >
      {children}
    </LoginModalContext.Provider>
  );
}

export const useLoginModal = () => useContext(LoginModalContext);
