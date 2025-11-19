import React, { useState, useEffect } from 'react';
import { KioskView } from './components/KioskView';
import { StatsTab, ReportsTab, DriversTab, SettingsTab } from './components/AdminTabs';
import { Icons } from './components/Icons';
import { requestNotificationPermission, checkDelaysAndNotify } from './services/notificationService';

type ViewMode = 'KIOSK' | 'ADMIN';
type AdminTab = 'STATS' | 'REPORTS' | 'DRIVERS' | 'SETTINGS';

function App() {
  const [view, setView] = useState<ViewMode>('KIOSK');
  const [activeTab, setActiveTab] = useState<AdminTab>('STATS');
  const [refreshKey, setRefreshKey] = useState(0);

  // Initialize notifications
  useEffect(() => {
    // Request permission initially
    requestNotificationPermission();

    // Start delay checker interval (runs every minute)
    const interval = setInterval(() => {
      checkDelaysAndNotify();
    }, 60000);

    // Initial check on load
    checkDelaysAndNotify();

    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  if (view === 'KIOSK') {
    return <KioskView onSwitch={() => setView('ADMIN')} />;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Admin Header */}
      <header className="bg-white border-b shadow-sm px-6 py-4 flex justify-between items-center sticky top-0 z-20">
        <div className="flex items-center gap-4">
           <div className="bg-brand-primary p-2 rounded-lg">
             <Icons.Settings className="w-6 h-6 text-white" />
           </div>
           <div>
             <h1 className="text-xl font-bold text-gray-800">Panneau d'Administration</h1>
             <p className="text-xs text-gray-500">Système de Pointage</p>
           </div>
        </div>
        <div className="flex gap-4 items-center">
            <button 
                onClick={requestNotificationPermission} 
                className="text-xs text-gray-400 hover:text-brand-primary underline"
                title="Activer les notifications si elles sont bloquées"
            >
                Activer Notifications
            </button>
            
            <button 
                onClick={handleRefresh}
                className="px-3 py-2 text-brand-secondary border border-brand-secondary rounded hover:bg-brand-secondary hover:text-white transition flex items-center gap-2"
                title="Actualiser les données"
            >
                <Icons.Refresh className="w-5 h-5" />
                <span className="hidden sm:inline font-bold text-sm">Actualiser</span>
            </button>

            <button 
                onClick={() => setView('KIOSK')}
                className="px-4 py-2 border-2 border-brand-primary text-brand-primary font-bold rounded hover:bg-brand-primary hover:text-white transition"
            >
                Retour à l'accueil
            </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Nav */}
        <nav className="w-64 bg-white border-r p-4 flex flex-col gap-2">
           <button 
             onClick={() => setActiveTab('STATS')}
             className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${activeTab === 'STATS' ? 'bg-brand-primary text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}
           >
             <Icons.Chart className="w-5 h-5" />
             <span className="font-medium">Statistiques</span>
           </button>
           <button 
             onClick={() => setActiveTab('REPORTS')}
             className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${activeTab === 'REPORTS' ? 'bg-brand-secondary text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}
           >
             <Icons.Document className="w-5 h-5" />
             <span className="font-medium">Rapports Retour</span>
           </button>
           <button 
             onClick={() => setActiveTab('DRIVERS')}
             className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${activeTab === 'DRIVERS' ? 'bg-brand-yellow text-gray-800 shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}
           >
             <Icons.Users className="w-5 h-5" />
             <span className="font-medium">Chauffeurs</span>
           </button>
           <button 
             onClick={() => setActiveTab('SETTINGS')}
             className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${activeTab === 'SETTINGS' ? 'bg-gray-700 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}
           >
             <Icons.Bell className="w-5 h-5" />
             <span className="font-medium">Configuration</span>
           </button>

           <div className="mt-auto pt-6 border-t text-center">
             <p className="text-xs text-gray-900 font-bold opacity-50">Développé par cviguera</p>
           </div>
        </nav>

        {/* Content Area */}
        <main className="flex-1 p-8 overflow-y-auto">
           {activeTab === 'STATS' && <StatsTab key={refreshKey} />}
           {activeTab === 'REPORTS' && <ReportsTab key={refreshKey} />}
           {activeTab === 'DRIVERS' && <DriversTab key={refreshKey} />}
           {activeTab === 'SETTINGS' && <SettingsTab key={refreshKey} />}
        </main>
      </div>
    </div>
  );
}

export default App;