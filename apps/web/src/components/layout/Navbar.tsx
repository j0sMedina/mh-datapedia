import { Link, useNavigate } from '@tanstack/react-router';
import { useAuth } from '../../context/AuthContext';
import { useLoginModal } from '../../context/LoginModalContext';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

export function Navbar() {
  const { user, logout } = useAuth();
  const { open } = useLoginModal();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate({ to: '/' });
  };

  return (
    <nav className="bg-stone-950 border-b border-stone-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <Link
              to="/"
              className="font-display font-bold text-lg tracking-wide uppercase text-stone-50 hover:text-stone-50"
            >
              <span className="text-accent">MH</span> Datapedia
            </Link>
            <Link
              to="/monsters"
              className="text-stone-400 hover:text-stone-50 transition-colors duration-150 text-sm pb-0.5"
              activeProps={{ className: 'text-stone-50 border-b border-accent pb-0.5' }}
            >
              Monsters
            </Link>
            {user && (
              <Link
                to="/favorites"
                className="text-stone-400 hover:text-stone-50 transition-colors duration-150 text-sm pb-0.5"
                activeProps={{ className: 'text-stone-50 border-b border-accent pb-0.5' }}
              >
                Favorites
              </Link>
            )}
            {user && ['HELPER', 'ADMIN', 'MASTER'].includes(user.role) && (
              <Link
                to="/admin"
                className="text-stone-400 hover:text-stone-50 transition-colors duration-150 text-sm pb-0.5"
                activeProps={{ className: 'text-stone-50 border-b border-accent pb-0.5' }}
              >
                Admin
              </Link>
            )}
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <span className="text-stone-400 text-sm hidden sm:block">{user.username}</span>
                {user.role === 'HELPER' && (
                  <Badge className="bg-transparent text-blue-400 border border-blue-800 font-mono text-[11px] hidden sm:inline-flex">
                    HELPER
                  </Badge>
                )}
                {user.role === 'ADMIN' && (
                  <Badge className="bg-transparent text-accent border border-accent font-mono text-[11px] hidden sm:inline-flex">
                    ADMIN
                  </Badge>
                )}
                {user.role === 'MASTER' && (
                  <Badge className="bg-transparent text-yellow-400 border border-yellow-700 font-mono text-[11px] hidden sm:inline-flex">
                    MASTER
                  </Badge>
                )}
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => open('login')}>Login</Button>
                <Button variant="primary" size="sm" onClick={() => open('register')}>Register</Button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
