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
    <div className="min-h-screen bg-neutral-50">
      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-neutral-200 bg-white px-6">
          <div className="flex h-16 shrink-0 items-center">
            <h1 className="text-2xl font-bold text-primary-600">ROPI</h1>
          </div>
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => {
                    const isActive = location.pathname === item.href
                    return (
                      <li key={item.name}>
                        <Link
                          to={item.href}
                          className={`
                            group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 transition-colors
                            ${isActive
                              ? 'bg-primary-50 text-primary-600'
                              : 'text-neutral-700 hover:text-primary-600 hover:bg-neutral-50'
                            }
                          `}
                        >
                          <item.icon className="h-6 w-6 shrink-0" />
                          {item.name}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </li>
              <li className="mt-auto">
                <div className="px-2 py-3 border-t border-neutral-200">
                  <p className="text-xs text-neutral-500 mb-1">Signed in as</p>
                  <p className="text-sm font-medium text-neutral-900 mb-3 truncate">
                    {user?.email}
                  </p>
                  <button
                    onClick={() => signOut()}
                    className="flex w-full items-center gap-x-2 rounded-md px-2 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 hover:text-error-600 transition-colors"
                  >
                    <LogOut className="h-5 w-5" />
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
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-neutral-200 bg-white px-4 shadow-sm">
          <button
            type="button"
            className="-m-2.5 p-2.5 text-neutral-700 lg:hidden"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold text-primary-600">ROPI</h1>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden">
          <div className="fixed inset-0 z-50 bg-neutral-900/80" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white">
            <div className="flex h-16 items-center justify-between px-6 border-b border-neutral-200">
              <h1 className="text-xl font-bold text-primary-600">ROPI</h1>
              <button
                type="button"
                className="-m-2.5 p-2.5 text-neutral-700"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <nav className="px-6 py-4">
              <ul role="list" className="space-y-1">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href
                  return (
                    <li key={item.name}>
                      <Link
                        to={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`
                          group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6
                          ${isActive
                            ? 'bg-primary-50 text-primary-600'
                            : 'text-neutral-700 hover:text-primary-600 hover:bg-neutral-50'
                          }
                        `}
                      >
                        <item.icon className="h-6 w-6 shrink-0" />
                        {item.name}
                      </Link>
                    </li>
                  )
                })}
              </ul>
              <div className="mt-6 pt-6 border-t border-neutral-200">
                <p className="text-xs text-neutral-500 mb-1">Signed in as</p>
                <p className="text-sm font-medium text-neutral-900 mb-3 truncate">
                  {user?.email}
                </p>
                <button
                  onClick={() => signOut()}
                  className="flex w-full items-center gap-x-2 rounded-md px-2 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 hover:text-error-600"
                >
                  <LogOut className="h-5 w-5" />
                  Sign Out
                </button>
              </div>
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="lg:pl-64">
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  )
}
