import { ReactNode, useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from './Logo';
import { AskRopi, useAskShortcut } from './AskRopi';
import {
  LayoutDashboard,
  Briefcase,
  GraduationCap,
  CalendarDays,
  CheckSquare,
  LogOut,
  Menu,
  X,
  Clock,
  Search,
  Mic,
} from '@/components/icons';

interface DashboardLayoutProps {
  children: ReactNode;
}

// `match` lists every route that belongs to the section, so the right item stays
// highlighted on sub-pages (e.g. a quiz or the reviews page lights up "Learn").
const navigation = [
  { name: 'Today', href: '/dashboard', icon: LayoutDashboard, match: ['/dashboard'] },
  { name: 'Talk', href: '/talk', icon: Mic, match: ['/talk'] },
  { name: 'LifeShift', href: '/schedule', icon: CalendarDays, match: ['/schedule'] },
  { name: 'Learn', href: '/learning', icon: GraduationCap, match: ['/learn', '/study-guide', '/quiz', '/voice-quiz', '/reviews'] },
  { name: 'Jobs', href: '/jobs', icon: Briefcase, match: ['/jobs'] },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare, match: ['/tasks'] },
  { name: 'History', href: '/history', icon: Clock, match: ['/history', '/activity'] },
];

const isActiveRoute = (pathname: string, match: string[]) =>
  match.some((prefix) => pathname === prefix || pathname.startsWith(prefix));

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'G';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <ul role="list" className="flex flex-col gap-0.5">
      {navigation.map((item) => {
        const isActive = isActiveRoute(location.pathname, item.match);
        return (
          <li key={item.name} className="relative">
            {isActive && (
              <motion.span
                layoutId="nav-active"
                className="absolute inset-0 rounded-lg bg-card border border-border shadow-[0_1px_2px_hsl(225_20%_8%/0.05)]"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <button
              onClick={() => {
                navigate(item.href);
                onNavigate?.();
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex w-full items-center gap-2.5 rounded-lg px-2.5 h-9 text-[13.5px] font-medium transition-colors ${
                isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <item.icon
                className={`h-[18px] w-[18px] shrink-0 transition-colors ${isActive ? 'text-primary' : ''}`}
                weight={isActive ? 'duotone' : 'regular'}
              />
              {item.name}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { displayName, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const openAsk = useCallback(() => setAskOpen(true), []);
  useAskShortcut(openAsk);
  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);

  // Close the mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-60 lg:flex-col">
        <div className="flex grow flex-col overflow-y-auto px-3 pt-5 pb-4">
          <button onClick={() => navigate('/dashboard')} className="flex h-9 items-center px-2.5 mb-6 rounded-lg w-fit" aria-label="Ropi home">
            <Logo size={22} />
          </button>

          <button
            onClick={openAsk}
            className="mb-4 flex h-9 items-center gap-2 rounded-lg border bg-card px-2.5 text-left text-[13px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1">Ask Ropi</span>
            <kbd aria-hidden="true" className="num rounded border bg-background px-1.5 text-[10.5px]">{isMac ? '⌘' : 'Ctrl'} K</kbd>
          </button>

          <nav className="flex flex-1 flex-col" aria-label="Main">
            <NavList />
          </nav>

          {/* Account */}
          <div className="mt-6 flex items-center gap-2.5 rounded-lg px-2 py-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background">
              {initials(displayName)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium leading-tight">{displayName}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Private account</p>
            </div>
            <button
              onClick={signOut}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-md lg:hidden">
        <button
          type="button"
          className="-ml-1 rounded-md p-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <Logo size={19} />
        <button onClick={openAsk} aria-label="Ask Ropi" className="ml-auto flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 text-[12.5px] text-muted-foreground">
          <Search className="h-3.5 w-3.5" />
          Ask
        </button>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 top-14 z-30 bg-background px-3 pt-3 lg:hidden">
          <NavList onNavigate={() => setMobileMenuOpen(false)} />
          <button
            onClick={() => {
              signOut();
              setMobileMenuOpen(false);
            }}
            className="mt-4 flex w-full items-center gap-2.5 rounded-lg border-t px-2.5 pt-4 text-[13.5px] font-medium text-muted-foreground"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Sign out
          </button>
        </div>
      )}

      {/* Main content: a raised sheet beside the sidebar */}
      <main className="lg:pl-60 lg:pr-2 lg:py-2">
        <div className="min-h-[calc(100vh-1rem)] lg:rounded-2xl lg:border lg:bg-[hsl(60_8%_98.6%)]">
          <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-10 lg:py-9">{children}</div>
        </div>
      </main>

      {/* Phones: Talk is one tap away from anywhere (hands busy, on the move) */}
      {!['/talk', '/voice-quiz'].some((p) => location.pathname.startsWith(p)) && (
        <button
          onClick={() => navigate('/talk')}
          aria-label="Talk to Ropi"
          className="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-float transition-transform active:scale-95 lg:hidden"
        >
          <Mic className="h-6 w-6" />
        </button>
      )}

      <AskRopi open={askOpen} onOpenChange={setAskOpen} />
    </div>
  );
}
