import { Outlet, Link, useLocation } from 'react-router';
import { useAuth, useLogout } from '../hooks/useAuth';

interface NavItem {
  path: string;
  label: string;
}

const publisherNav: NavItem[] = [
  { path: '/', label: 'Dashboard' },
  { path: '/newsletters', label: 'Newsletters' },
  { path: '/settings', label: 'Settings' },
];

const advertiserNav: NavItem[] = [
  { path: '/', label: 'Dashboard' },
  { path: '/campaigns', label: 'Campaigns' },
  { path: '/settings', label: 'Settings' },
];

export function DashboardLayout() {
  const { user } = useAuth();
  const logout = useLogout();
  const location = useLocation();

  const navItems = user?.role === 'advertiser' ? advertiserNav : publisherNav;

  function isActive(path: string) {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r border-border bg-card">
        <div className="border-b border-border p-4">
          <h1 className="text-lg font-bold text-foreground">AdStack</h1>
          <p className="text-xs text-muted-foreground">{user?.role} dashboard</p>
        </div>

        <nav className="flex-1 p-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                isActive(item.path)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-muted'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-border p-4">
          <div className="text-sm font-medium text-foreground">{user?.name}</div>
          <div className="text-xs text-muted-foreground">{user?.email}</div>
          <button
            type="button"
            onClick={() => logout.mutate()}
            className="mt-2 text-xs text-destructive hover:underline"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-background p-6">
        <Outlet />
      </main>
    </div>
  );
}
