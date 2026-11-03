import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Briefcase,
  GraduationCap,
  Calendar,
  BookOpen,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { useState } from 'react';

interface DashboardLayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Jobs', href: '/jobs', icon: Briefcase },
  { name: 'Learn', href: '/learn', icon: GraduationCap },
  { name: 'Schedule', href: '/schedule', icon: Calendar },
  { name: 'Knowledge', href: '/knowledge', icon: BookOpen },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar - Precision Minimalism */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-56 lg:flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--canvas))]">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto px-4 py-6">
          {/* Logo */}
          <div className="flex h-8 shrink-0 items-center">
            <span className="text-sm font-semibold tracking-tight text-[hsl(var(--ink))]">ROPI</span>
          </div>

          {/* Navigation */}
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <li key={item.name}>
                    <button
                      onClick={() => navigate(item.href)}
                      className={`
                        group flex gap-x-3 rounded-lg p-2 text-sm font-medium leading-6 w-full text-left
                        transition-all duration-150
                        ${
                          isActive
                            ? 'bg-[hsl(var(--accent)_/_0.1)] text-[hsl(var(--accent))]'
                            : 'text-[hsl(var(--secondary))] hover:text-[hsl(var(--ink))] hover:bg-[hsl(var(--surface))]'
                        }
                      `}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {item.name}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* User menu - Bottom */}
          <div className="border-t border-[hsl(var(--border))] pt-4">
            <div className="flex items-center gap-x-3 px-2 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[hsl(var(--ink))] truncate">
                  {user?.email}
                </p>
              </div>
              <button
                onClick={signOut}
                className="p-2 text-[hsl(var(--secondary))] hover:text-[hsl(var(--ink))] transition-colors"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="sticky top-0 z-40 flex items-center gap-x-6 bg-background px-4 py-4 border-b border-border lg:hidden">
        <button
          type="button"
          className="text-muted-foreground"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <div className="flex-1 text-sm font-semibold tracking-tight">ROPI</div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-background">
          <nav className="flex flex-col gap-y-1 px-4 pt-20">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <button
                  key={item.name}
                  onClick={() => {
                    navigate(item.href);
                    setMobileMenuOpen(false);
                  }}
                  className={`
                    flex gap-x-3 rounded-md p-3 text-sm font-medium w-full text-left
                    ${
                      isActive
                        ? 'bg-secondary text-foreground'
                        : 'text-muted-foreground'
                    }
                  `}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {item.name}
                </button>
              );
            })}
            <button
              onClick={() => {
                signOut();
                setMobileMenuOpen(false);
              }}
              className="flex gap-x-3 rounded-md p-3 text-sm font-medium w-full text-left text-muted-foreground mt-4 border-t border-border"
            >
              <LogOut className="h-5 w-5 shrink-0" />
              Sign out
            </button>
          </nav>
        </div>
      )}

      {/* Main content */}
      <main className="lg:pl-56">
        <div className="px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
