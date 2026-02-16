import { Link, useLocation } from 'react-router-dom'
import { ScanLine, ClipboardCheck, GraduationCap, HelpCircle, LogOut } from 'lucide-react'
import { useAuthContext } from '../context/AuthContext'

const navItems = [
  { to: '/classes', label: 'Classes', icon: GraduationCap },
  { to: '/', label: 'Scan', icon: ScanLine },
  { to: '/answer-keys', label: 'Answer Keys', icon: ClipboardCheck },
  { to: '/instructions', label: 'Instructions', icon: HelpCircle },
]

export default function Navbar() {
  const location = useLocation()
  const { user, signOut } = useAuthContext()

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <ScanLine className="h-7 w-7 text-indigo-600" />
            <span className="text-xl font-bold text-gray-900">OMR Scanner</span>
          </Link>
          <div className="flex items-center gap-1">
            {navItems.map(({ to, label, icon: Icon }) => {
              const active = location.pathname === to || (to !== '/' && location.pathname.startsWith(to))
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              )
            })}
          </div>
          {/* User area */}
          <div className="flex items-center gap-3">
            {user && (
              <>
                <div className="flex items-center gap-2">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt=""
                      className="h-8 w-8 rounded-full border border-gray-200"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                      {user.email?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm text-gray-700 hidden sm:block max-w-[150px] truncate">
                    {user.full_name || user.email}
                  </span>
                </div>
                <button
                  onClick={signOut}
                  className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
