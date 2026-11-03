import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { 
  Home, 
  Briefcase, 
  BookOpen, 
  Calendar, 
  Database, 
  LogOut,
  Menu,
  X
} from 'lucide-react'
import { useState } from 'react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Jobs', href: '/jobs', icon: Briefcase },
  { name: 'Learning', href: '/learn', icon: BookOpen },
  { name: 'Schedule', href: '/schedule', icon: Calendar },
  { name: 'Knowledge', href: '/knowledge', icon: Database },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { user, signOut } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-mist">
      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-line bg-paper px-4 sm:px-6">
          {/* Wordmark */}
          <div className="flex h-14 sm:h-16 shrink-0 items-center">
            <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">ropi.</h1>
          </div>
          
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-6">
              <li>
                <ul role="list" className="-mx-2 space-y-0.5">
                  {navigation.map((item) => {
                    const isActive = location.pathname === item.href
                    return (
                      <li key={item.name}>
                        <Link
                          to={item.href}
                          className={`
                            group flex items-center gap-x-3 rounded-md px-2 py-2 text-sm font-medium transition-all touch-manipulation min-h-[44px]
                            ${isActive
                              ? 'bg-ultramarine/10 text-ultramarine'
                              : 'text-slate hover:text-ink hover:bg-mist'
                            }
                          `}
                        >
                          <item.icon className="h-5 w-5 shrink-0" strokeWidth={1.5} />
                          {item.name}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </li>
              
              {/* User Section */}
              <li className="mt-auto">
                <div className="px-2 py-3 border-t border-line">
                  <p className="text-xs text-slate mb-0.5">Signed in as</p>
                  <p className="text-sm font-medium text-ink mb-3 truncate">
                    {user?.email}
                  </p>
                  <button
                    onClick={() => signOut()}
                    className="flex w-full items-center gap-x-2 rounded-md px-2 py-2 text-sm font-medium text-slate hover:bg-mist hover:text-ink transition-all touch-manipulation min-h-[44px]"
                  >
                    <LogOut className="h-5 w-5" strokeWidth={1.5} />
                    Sign Out
                  </button>
                </div>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden">
        <div className="sticky top-0 z-40 flex h-14 sm:h-16 shrink-0 items-center gap-x-3 sm:gap-x-4 border-b border-line bg-paper px-3 sm:px-4 shadow-sm">
          <button
            type="button"
            className="p-2 text-slate hover:text-ink transition-colors touch-manipulation"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.5} />
          </button>
          <h1 className="text-lg sm:text-xl font-bold text-ink tracking-tight">ropi.</h1>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40 bg-ink/60 backdrop-blur-sm" 
            onClick={() => setMobileMenuOpen(false)} 
          />
          
          {/* Sidebar */}
          <div className="fixed inset-y-0 left-0 z-50 w-64 sm:w-72 bg-paper border-r border-line">
            {/* Header */}
            <div className="flex h-14 sm:h-16 items-center justify-between px-4 sm:px-6 border-b border-line">
              <h1 className="text-lg sm:text-xl font-bold text-ink tracking-tight">ropi.</h1>
              <button
                type="button"
                className="p-2 text-slate hover:text-ink transition-colors touch-manipulation"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="h-5 w-5" strokeWidth={1.5} />
              </button>
            </div>
            
            {/* Navigation */}
            <nav className="px-4 sm:px-6 py-4">
              <ul role="list" className="space-y-0.5">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href
                  return (
                    <li key={item.name}>
                      <Link
                        to={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`
                          group flex items-center gap-x-3 rounded-md px-2 py-2.5 text-sm font-medium transition-all touch-manipulation min-h-[44px]
                          ${isActive
                            ? 'bg-ultramarine/10 text-ultramarine'
                            : 'text-slate hover:text-ink hover:bg-mist'
                          }
                        `}
                      >
                        <item.icon className="h-5 w-5 shrink-0" strokeWidth={1.5} />
                        {item.name}
                      </Link>
                    </li>
                  )
                })}
              </ul>
              
              {/* User Section */}
              <div className="mt-6 pt-6 border-t border-line">
                <p className="text-xs text-slate mb-0.5">Signed in as</p>
                <p className="text-sm font-medium text-ink mb-3 truncate">
                  {user?.email}
                </p>
                <button
                  onClick={() => {
                    signOut()
                    setMobileMenuOpen(false)
                  }}
                  className="flex w-full items-center gap-x-2 rounded-md px-2 py-2.5 text-sm font-medium text-slate hover:bg-mist hover:text-ink transition-all touch-manipulation min-h-[44px]"
                >
                  <LogOut className="h-5 w-5" strokeWidth={1.5} />
                  Sign Out
                </button>
              </div>
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="lg:pl-64">
        <div className="px-3 py-4 sm:px-4 sm:py-6 lg:px-6 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
