// src/components/layout/Sidebar.jsx
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, CheckSquare, Calendar,
  BarChart2, Settings, LogOut, Zap
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { logout } from '../../services/auth.service';

const links = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/tasks',     icon: CheckSquare,     label: 'Tasks' },
  { to: '/sprint',    icon: Calendar,        label: 'Sprint' },
  { to: '/analytics', icon: BarChart2,       label: 'Analytics' },
  { to: '/settings',  icon: Settings,        label: 'Settings' },
];

const Sidebar = () => {
  const { user, logoutUser } = useAuth();

  const handleLogout = async () => {
    try { await logout(); } catch {}
    logoutUser();
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-1.5 rounded-lg">
            <Zap className="text-white w-5 h-5" />
          </div>
          <span className="font-bold text-xl text-gray-900">StepWise</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
              transition-colors
              ${isActive
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
            `}
          >
            <Icon className="w-5 h-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-gray-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
            <span className="text-indigo-700 font-semibold text-sm">
              {user?.full_name?.charAt(0) || user?.fullName?.charAt(0) || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.full_name || user?.fullName}
            </p>
            <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600
            hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;