import { ReactNode, useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from './Logo';
import { AskRopi, useAskShortcut } from './AskRopi';
import { cn } from '@/lib/utils';
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
  PanelLeft,
  IdCard,
} from '@/components/icons';

interface DashboardLayoutProps {
  children: ReactNode;
}

type NavItem = { name: string; href: string; icon: typeof LayoutDashboard; match: string[] };

// The order follows a day: start with today (or talk, when your hands are busy),
// grow (learn, jobs, your CV), plan around life (what changed, what's on your plate),
// then look back at what you did. `match` keeps the item lit on its sub-pages.
const groups: { label: string | null; items: NavItem[] }[] = [
  {
    label: null,
    items: [
      { name: 'Today', href: '/dashboard', icon: LayoutDashboard, match: ['/dashboard'] },
      { name: 'Talk', href: '/talk', icon: Mic, match: ['/talk'] },
    ],
  },
  {
    label: 'Grow',
    items: [
      { name: 'Learn', href: '/learning', icon: GraduationCap, match: ['/learn', '/study-guide', '/quiz', '/voice-quiz', '/reviews'] },
      { name: 'Jobs', href: '/jobs', icon: Briefcase, match: ['/jobs'] },
      { name: 'CV', href: '/cv', icon: IdCard, match: ['/cv'] },
    ],
  },
  {
    label: 'Plan',
    items: [
      { name: 'LifeShift', href: '/schedule', icon: CalendarDays, match: ['/schedule'] },
      { name: 'Tasks', href: '/tasks', icon: CheckSquare, match: ['/tasks'] },
    ],
  },
  {
    label: 'Look back',
    items: [{ name: 'History', href: '/history', icon: Clock, match: ['/history', '/activity'] }],
  },
];

const isActiveRoute = (pathname: string, match: string[]) =>
  match.some((prefix) => pathname === prefix || pathname.startsWith(prefix));

/** Sidebar open or folded to icons, remembered across pages and visits */
export const useSidebar = create<{ collapsed: boolean; toggle: () => void }>()(
  persist((set) => ({ collapsed: false, toggle: () => set((s) => ({ collapsed: !s.collapsed })) }), { name: 'ropi-sidebar-v1' })
);

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'G';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function NavList({ onNavigate, compact = false }: { onNavigate?: () => void; compact?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="flex flex-col gap-4">
      {groups.map((g, gi) => (
        <div key={gi}>
          {g.label &&
            (compact ? (
              <div className="mx-auto mb-2 h-px w-6 bg-border" aria-hidden="true" />
            ) : (
              <div className="mb-1 px-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground/80">{g.label}</div>
            ))}
          <ul role="list" className="flex flex-col gap-0.5">
            {g.items.map((item) => {
              const isActive = isActiveRoute(location.pathname, item.match);
              return (
                <li key={item.name} className="relative">
                  {isActive && (
                    <motion.span
                      layoutId={compact ? 'nav-active-compact' : 'nav-active'}
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
                    aria-label={compact ? item.name : undefined}
                    title={compact ? item.name : undefined}
                    className={cn(
                      'relative flex w-full items-center rounded-lg h-9 text-[13.5px] font-medium transition-colors',
                      compact ? 'justify-center' : 'gap-2.5 px-2.5',
                      isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <item.icon
                      className={`h-[18px] w-[18px] shrink-0 transition-colors ${isActive ? 'text-primary' : ''}`}
                      weight={isActive ? 'duotone' : 'regular'}
                    />
                    {!compact && item.name}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { displayName, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const { collapsed, toggle } = useSidebar();
  const openAsk = useCallback(() => setAskOpen(true), []);
  useAskShortcut(openAsk);
  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);
  const mod = isMac ? '⌘' : 'Ctrl';

  // Close the mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Ctrl/Cmd + B folds the sidebar, like most editors
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'b') {
        const el = e.target as HTMLElement | null;
        if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar: full, or folded to an icon rail */}
      <aside
        className={cn(
          'hidden lg:fixed lg:inset-y-0 lg:flex lg:flex-col transition-[width] duration-200 ease-out',
          collapsed ? 'lg:w-[60px]' : 'lg:w-60'
        )}
        data-collapsed={collapsed || undefined}
      >
        <div className={cn('flex grow flex-col overflow-y-auto overflow-x-hidden pt-5 pb-4', collapsed ? 'px-2' : 'px-3')}>
          <div className={cn('mb-6 flex items-center', collapsed ? 'flex-col gap-3' : 'justify-between')}>
            <button onClick={() => navigate('/dashboard')} className={cn('flex h-9 items-center rounded-lg', collapsed ? 'justify-center' : 'px-2.5')} aria-label="Ropi home">
              <Logo size={22} withWordmark={!collapsed} />
            </button>
            <button
              onClick={toggle}
              aria-label={collapsed ? 'Open sidebar' : 'Close sidebar'}
              title={`${collapsed ? 'Open' : 'Close'} sidebar (${mod} B)`}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <PanelLeft className="h-[18px] w-[18px]" />
            </button>
          </div>

          {collapsed ? (
            <button onClick={openAsk} aria-label="Ask Ropi" title={`Ask Ropi (${mod} K)`} className="mb-4 flex h-9 items-center justify-center rounded-lg border bg-card text-muted-foreground hover:text-foreground">
              <Search className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={openAsk}
              className="mb-4 flex h-9 items-center gap-2 rounded-lg border bg-card px-2.5 text-left text-[13px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <Search className="h-4 w-4" />
              <span className="flex-1">Ask Ropi</span>
              <kbd aria-hidden="true" className="num rounded border bg-background px-1.5 text-[10.5px]">{mod} K</kbd>
            </button>
          )}

          <nav className="flex flex-1 flex-col" aria-label="Main">
            <NavList compact={collapsed} />
          </nav>

          {/* Account */}
          {collapsed ? (
            <div className="mt-6 flex flex-col items-center gap-2">
              <span title={displayName} className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background">
                {initials(displayName)}
              </span>
              <button onClick={signOut} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Sign out" aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
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
          )}
        </div>
      </aside>

      {/* Mobile header */}
      <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-md lg:hidden print:hidden">
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
        <div className="fixed inset-0 top-14 z-30 overflow-y-auto bg-background px-3 pt-3 lg:hidden">
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

      {/* Main content: a raised sheet beside the sidebar. Folding the sidebar gives the page the room. */}
      <main className={cn('lg:pr-2 lg:py-2 transition-[padding] duration-200 ease-out', collapsed ? 'lg:pl-[60px]' : 'lg:pl-60')}>
        <div className="min-h-[calc(100vh-1rem)] lg:rounded-2xl lg:border lg:bg-[hsl(60_8%_98.6%)]">
          <div className={cn('mx-auto px-4 py-6 sm:px-6 lg:px-10 lg:py-9', collapsed ? 'max-w-[1560px]' : 'max-w-[1200px]')}>{children}</div>
        </div>
      </main>

      {/* Phones: Talk is one tap away from anywhere (hands busy, on the move) */}
      {!['/talk', '/voice-quiz', '/cv'].some((p) => location.pathname.startsWith(p)) && (
        <button
          onClick={() => navigate('/talk')}
          aria-label="Talk to Ropi"
          className="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-float transition-transform active:scale-95 lg:hidden print:hidden"
        >
          <Mic className="h-6 w-6" />
        </button>
      )}

      <AskRopi open={askOpen} onOpenChange={setAskOpen} />
    </div>
  );
}
