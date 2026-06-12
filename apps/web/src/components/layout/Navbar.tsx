import { Link, useNavigate } from '@tanstack/react-router';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate({ to: '/monsters' });
  };

  return (
    <nav className="bg-stone-950 border-b border-stone-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-amber-500 font-bold text-lg tracking-wide">
              MH Datapedia
            </Link>
            <Link
              to="/monsters"
              className="text-stone-400 hover:text-stone-50 transition-colors duration-150 text-sm pb-0.5"
              activeProps={{ className: 'text-stone-50 border-b border-amber-500 pb-0.5' }}
            >
              Monsters
            </Link>
            {user && (
              <Link
                to="/favorites"
                className="text-stone-400 hover:text-stone-50 transition-colors duration-150 text-sm pb-0.5"
                activeProps={{ className: 'text-stone-50 border-b border-amber-500 pb-0.5' }}
              >
                Favorites
              </Link>
            )}
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <span className="text-stone-400 text-sm hidden sm:block">{user.username}</span>
                {user.role === 'ADMIN' && (
                  <Badge className="bg-amber-500/10 text-amber-500 hidden sm:inline-flex">Admin</Badge>
                )}
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">Login</Button>
                </Link>
                <Link to="/register">
                  <Button variant="primary" size="sm">Register</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
