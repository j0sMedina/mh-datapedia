import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useAuth } from '../../context/AuthContext';
import { useLoginModal } from '../../context/LoginModalContext';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ChangePasswordModal } from '../account/ChangePasswordModal';

export function Navbar() {
  const { user, logout } = useAuth();
  const { open } = useLoginModal();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [dropdownOpen]);

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
    navigate({ to: '/' });
  };

  return (
    <>
      <nav className="bg-stone-950 border-b border-stone-800 sticky top-0 z-40">
        <div className="px-4 sm:px-6">
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
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setDropdownOpen((v) => !v)}
                      className="flex items-center gap-1 text-stone-400 hover:text-stone-50 transition-colors duration-150 text-sm hidden sm:flex"
                    >
                      {user.username}
                      <span className="text-xs leading-none">▾</span>
                    </button>
                    {dropdownOpen && (
                      <div className="absolute right-0 mt-2 w-44 bg-stone-900 border border-stone-700 rounded-md shadow-lg z-50">
                        <Link
                          to="/account/sessions"
                          onClick={() => setDropdownOpen(false)}
                          className="block px-4 py-2 text-sm text-stone-300 hover:bg-stone-800 hover:text-stone-50 transition-colors"
                        >
                          Sessions
                        </Link>
                        <Link
                          to="/account/two-factor-auth"
                          onClick={() => setDropdownOpen(false)}
                          className="block px-4 py-2 text-sm text-stone-300 hover:bg-stone-800 hover:text-stone-50 transition-colors"
                        >
                          Two-Factor Auth
                        </Link>
                        <button
                          onClick={() => {
                            setDropdownOpen(false);
                            setChangePasswordOpen(true);
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-stone-300 hover:bg-stone-800 hover:text-stone-50 transition-colors"
                        >
                          Change Password
                        </button>
                        <div className="border-t border-stone-700" />
                        <button
                          onClick={handleLogout}
                          className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-stone-800 hover:text-red-300 transition-colors"
                        >
                          Logout
                        </button>
                      </div>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" className="sm:hidden" onClick={handleLogout}>
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
      <ChangePasswordModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </>
  );
}
