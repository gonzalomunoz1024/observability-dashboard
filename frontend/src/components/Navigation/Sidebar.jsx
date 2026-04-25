import { memo } from 'react';
import { useServices } from '../../context/ServicesContext';
import { useTheme } from '../../context/ThemeContext';
import { ServiceItem } from './ServiceItem';
import './Sidebar.css';

/**
 * Sidebar - Minimal Navigation
 * Clean hierarchy with subtle interactions
 */
export const Sidebar = memo(function Sidebar({
  activeView,
  onSelectView,
  onAddService,
  collapsed,
  onToggleCollapse
}) {
  const { services, statuses } = useServices();
  const { theme, toggleTheme } = useTheme();

  const restServices = services.filter(s => s.type === 'rest');
  const cliServices = services.filter(s => s.type === 'cli');

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <h1 className="sidebar-logo">
          <span className="logo-icon">OF</span>
          {!collapsed && (
            <span className="logo-text">
              Observability
              <strong>Forge</strong>
            </span>
          )}
        </h1>
      </div>

      <nav className="sidebar-nav">
        <button
          className={`nav-item global-nav ${activeView === 'global' ? 'active' : ''}`}
          onClick={() => onSelectView('global')}
          title="Dashboard"
        >
          <span className="nav-icon">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1.5L1.5 6.5V14.5H6V10.5C6 10 6.5 9.5 7 9.5H9C9.5 9.5 10 10 10 10.5V14.5H14.5V6.5L8 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          {!collapsed && 'Dashboard'}
        </button>

        <div className="nav-section">
          {!collapsed && (
            <div className="nav-section-header">
              <span>Services</span>
              <button
                className="add-service-btn"
                onClick={onAddService}
                title="Add service"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          )}

          {services.length === 0 ? (
            !collapsed && (
              <div className="no-services">
                No services configured
              </div>
            )
          ) : (
            <div className="services-list">
              {restServices.length > 0 && (
                <div className="service-group">
                  {!collapsed && <span className="group-label">REST</span>}
                  {restServices.map(service => (
                    <ServiceItem
                      key={service.id}
                      service={service}
                      status={statuses[service.id]}
                      isActive={activeView === service.id}
                      onClick={() => onSelectView(service.id)}
                      collapsed={collapsed}
                    />
                  ))}
                </div>
              )}

              {cliServices.length > 0 && (
                <div className="service-group">
                  {!collapsed && <span className="group-label">CLI</span>}
                  {cliServices.map(service => (
                    <ServiceItem
                      key={service.id}
                      service={service}
                      status={statuses[service.id]}
                      isActive={activeView === service.id}
                      onClick={() => onSelectView(service.id)}
                      collapsed={collapsed}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </nav>

      <div className="sidebar-footer">
        <button
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1v1M8 14v1M14 8h1M1 8h1M12.2 3.8l.7-.7M3.1 12.9l.7-.7M12.2 12.2l.7.7M3.1 3.1l.7.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M14 10.5A6.5 6.5 0 015.5 2 6.5 6.5 0 1014 10.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          {!collapsed && (theme === 'light' ? 'Dark' : 'Light')}
        </button>

        <button
          className="collapse-btn"
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            {collapsed ? (
              <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            ) : (
              <path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            )}
          </svg>
        </button>
      </div>
    </aside>
  );
});
