import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import { useAuth } from '../context/AuthContext';
import type { AuthState } from '../context/AuthContext';
import { LoginModalProvider } from '../context/LoginModalContext';
import { Navbar } from '../components/layout/Navbar';
import { LoginModal } from '../components/auth/LoginModal';
import { Spinner } from '../components/ui/Spinner';

export const Route = createRootRouteWithContext<{ auth: AuthState }>()({
  component: RootLayout,
});

function RootLayout() {
  const auth = useAuth();

  if (auth.isLoading) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <LoginModalProvider>
      <div className="min-h-screen bg-stone-950 text-stone-50 flex flex-col">
        <Navbar />
        <main className="flex-1">
          <Outlet />
        </main>
        {import.meta.env.DEV && <TanStackRouterDevtools />}
      </div>
      <LoginModal />
    </LoginModalProvider>
  );
}
