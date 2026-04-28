import { useState } from 'react';
import { ServicesProvider } from './context/ServicesContext';
import { ThemeProvider } from './context/ThemeContext';
import { BackgroundJobsProvider } from './context/BackgroundJobsContext';
import { Sidebar } from './components/Navigation/Sidebar';
import { GlobalDashboard } from './components/GlobalView/GlobalDashboard';
import { ServiceView } from './components/ServiceView/ServiceView';
import { AddServiceModal } from './components/Config/AddServiceModal';
import { useHealthCheck } from './hooks/useHealthCheck';
import './App.css';

function Dashboard() {
  const [activeView, setActiveView] = useState('global');
  const [showAddModal, setShowAddModal] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Initialize health checking
  useHealthCheck();

  const handleServiceAdded = (serviceId) => {
    setActiveView(serviceId);
  };

  return (
    <div className={`app-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar
        activeView={activeView}
        onSelectView={setActiveView}
        onAddService={() => setShowAddModal(true)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <main className="main-content">
        {activeView === 'global' ? (
          <GlobalDashboard
            onSelectService={setActiveView}
            onAddService={() => setShowAddModal(true)}
          />
        ) : (
          <ServiceView serviceId={activeView} />
        )}
      </main>

      {showAddModal && (
        <AddServiceModal
          onClose={() => setShowAddModal(false)}
          onServiceAdded={handleServiceAdded}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <ServicesProvider>
        <BackgroundJobsProvider>
          <Dashboard />
        </BackgroundJobsProvider>
      </ServicesProvider>
    </ThemeProvider>
  );
}

export default App;
