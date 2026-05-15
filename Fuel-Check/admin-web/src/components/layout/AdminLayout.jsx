import { NavLink, Outlet } from 'react-router-dom';
import { getAdminSession } from '../../utils/session';

const navItems = [
  { path: '/admin/overview', label: 'Overview' },
  { path: '/admin/fuel-stations', label: 'Fuel Stations' },
  { path: '/admin/reports', label: 'Reports' },
];

export default function AdminLayout() {
  const session = getAdminSession();
  const username = session?.username || 'Admin';

  return (
    <div className="app-shell">
      <header className="top-bar">
        <h1>Admin Dashboard</h1>
        <span className="top-session">Signed in: {username}</span>
      </header>

      <div className="dashboard-main">
        <aside className="sidebar" aria-label="Admin pages">
          <nav className="sidebar-nav">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  isActive ? 'sidebar-link active' : 'sidebar-link'
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <section className="content-wrap">
          <Outlet />
        </section>
      </div>
    </div>
  );
}
