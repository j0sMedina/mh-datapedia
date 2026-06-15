import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import { useAuth } from '../context/AuthContext';
import type { AuthState } from '../context/AuthContext';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { Spinner } from '../components/ui/Spinner';

export const Route = createRootRouteWithContext<{ auth: AuthState }>()({
  component: RootLayout,
});

function RootLayout() {
  // Read auth directly from React context so isLoading re-renders reactively.
  // Route.useRouteContext() snapshots context at route-load time and may not
  // update when auth state changes asynchronously.
  const auth = useAuth();

  if (auth.isLoading) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-50 flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      {import.meta.env.DEV && <TanStackRouterDevtools />}
    </div>
  );
}
