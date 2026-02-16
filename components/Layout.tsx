import React from 'react';
import { LayoutDashboard, Calendar, Settings, LogOut, Menu } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: 'sport' | 'planning' | 'settings';
  onTabChange: (tab: 'sport' | 'planning' | 'settings') => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange }) => {
  const navItems = [
    { id: 'sport', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'planning', icon: Calendar, label: 'Plan' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ] as const;

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-text-primary">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-card border-r border-white/5 p-4">
        <div className="flex items-center gap-3 mb-8 px-2">
            {/* Logo: Assumes logo.png is placed in the public folder */}
            <img src="/logo.png" alt="MyDash Logo" className="w-10 h-10 object-contain" />
            <h1 className="font-bold text-xl tracking-tight">MyDash</h1>
        </div>
        
        <nav className="flex-1 space-y-1">
            {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                    <button
                        key={item.id}
                        onClick={() => onTabChange(item.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                            isActive 
                            ? 'bg-white/10 text-white' 
                            : 'text-text-secondary hover:bg-white/5 hover:text-white'
                        }`}
                    >
                        <item.icon size={20} className={isActive ? 'text-accent-green' : ''} />
                        <span className="font-medium text-sm">{item.label}</span>
                    </button>
                );
            })}
        </nav>

        <div className="mt-auto border-t border-white/5 pt-4">
             <button className="w-full flex items-center gap-3 px-3 py-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                <LogOut size={20} />
                <span className="font-medium text-sm">Sign Out</span>
             </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto no-scrollbar relative">
         {/* Mobile Header */}
        <div className="md:hidden sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-white/5 p-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
                <img src="/logo.png" alt="MyDash Logo" className="w-8 h-8 object-contain" />
                <h1 className="font-bold text-lg">MyDash</h1>
            </div>
            <button className="p-2 text-text-secondary"><Menu size={20} /></button>
        </div>

        <div className="p-4 max-w-5xl mx-auto min-h-full">
            {children}
        </div>
      </main>

      {/* Mobile Bottom Tabs */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-white/5 px-6 py-2 flex justify-between items-center z-50 safe-area-bottom">
        {navItems.map((item) => {
             const isActive = activeTab === item.id;
             return (
                 <button 
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className="flex flex-col items-center gap-1 p-2"
                 >
                    <div className={`p-1.5 rounded-full transition-colors ${isActive ? 'bg-white/10' : 'bg-transparent'}`}>
                        <item.icon size={22} className={isActive ? 'text-accent-green' : 'text-text-secondary'} />
                    </div>
                    <span className={`text-[10px] font-medium ${isActive ? 'text-white' : 'text-text-secondary'}`}>
                        {item.label}
                    </span>
                 </button>
             )
        })}
      </div>
    </div>
  );
};

export default Layout;