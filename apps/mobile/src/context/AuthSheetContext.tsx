import { createContext, useCallback, useContext, useRef } from 'react';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { LoginSheet } from '../components/auth/LoginSheet';
import { RegisterSheet } from '../components/auth/RegisterSheet';

interface AuthSheetContextValue {
  openLoginSheet: () => void;
  openRegisterSheet: () => void;
}

const AuthSheetContext = createContext<AuthSheetContextValue>({
  openLoginSheet: () => {},
  openRegisterSheet: () => {},
});

export function AuthSheetProvider({ children }: { children: React.ReactNode }) {
  const loginRef = useRef<BottomSheetModal>(null);
  const registerRef = useRef<BottomSheetModal>(null);

  const openLoginSheet = useCallback(() => {
    registerRef.current?.dismiss();
    loginRef.current?.present();
  }, []);

  const openRegisterSheet = useCallback(() => {
    loginRef.current?.dismiss();
    registerRef.current?.present();
  }, []);

  return (
    <AuthSheetContext.Provider value={{ openLoginSheet, openRegisterSheet }}>
      {children}
      <LoginSheet ref={loginRef} />
      <RegisterSheet ref={registerRef} onSwitchToLogin={openLoginSheet} />
    </AuthSheetContext.Provider>
  );
}

export function useAuthSheet() {
  return useContext(AuthSheetContext);
}
