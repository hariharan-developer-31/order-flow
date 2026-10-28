import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Flame,
  BarChart3,
  Zap,
  Settings,
  Download,
} from 'lucide-react';

export default function BottomNav({
  activeView,
  onChangeView,
  onOpenSettings,
  signalsCount = 0,
}) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  // Capture PWA beforeinstallprompt event for mobile/tablet install
  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }
  };

  const navItems = [
    {
      id: 'candles',
      label: 'Chart & VP',
      icon: TrendingUp,
      action: () => {
        onChangeView('candles');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      isActive: activeView === 'candles',
    },
    {
      id: 'footprint',
      label: 'Footprint',
      icon: Flame,
      action: () => {
        onChangeView('footprint');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      isActive: activeView === 'footprint',
    },
    {
      id: 'volume-profile',
      label: 'VP Depth',
      icon: BarChart3,
      action: () => {
        onChangeView('volume-profile');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      isActive: activeView === 'volume-profile',
    },
    {
      id: 'signals',
      label: 'MT5 Signals',
      icon: Zap,
      action: () => {
        onChangeView('signals');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      badge: signalsCount > 0 ? signalsCount : null,
      isActive: activeView === 'signals',
    },
    {
      id: 'settings',
      label: 'API Settings',
      icon: Settings,
      action: onOpenSettings,
      isActive: false,
    },
  ];

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FBF6EF]/95 backdrop-blur-md border-t border-[#0D0D0C]/12 shadow-[0_-4px_20px_rgba(13,13,12,0.04)] px-2 pt-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] w-full max-w-full overflow-hidden"
    >
      {/* Optional PWA One-Tap Install Pill for Mobile & Tablet */}
      {deferredPrompt && !isInstalled && (
        <div className="max-w-md mx-auto mb-1.5 px-2">
          <button
            onClick={handleInstallClick}
            className="w-full bg-[#0D0D0C] text-[#FBF6EF] rounded-[7px] py-1 px-3 text-[11px] font-medium flex items-center justify-between transition border border-[#0D0D0C]"
          >
            <span className="flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" />
              Install Trading Boy App on Home Screen
            </span>
            <span className="bg-[#FBF6EF]/20 text-[#FBF6EF] text-[10px] px-1.5 py-0.5 rounded-[5px] font-mono">
              + ADD
            </span>
          </button>
        </div>
      )}

      {/* Main Tabs */}
      <div className="max-w-md mx-auto grid grid-cols-5 gap-1 w-full">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.isActive;

          return (
            <button
              key={item.id}
              onClick={item.action}
              className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-[7px] transition-all duration-300 ${
                active
                  ? 'text-[#FBF6EF] bg-[#0D0D0C] font-semibold'
                  : 'text-[#0D0D0C]/60 hover:text-[#0D0D0C] active:bg-[#F4EFE6]'
              }`}
            >
              {/* Icon Container */}
              <div className="relative mt-0.5">
                <Icon className={`w-4 h-4 ${active ? 'stroke-[2.2]' : 'stroke-[1.75]'}`} />
                {item.badge && (
                  <span className="absolute -top-1.5 -right-2 bg-[#3FB874] text-[#0D0D0C] text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-[#FBF6EF]">
                    {item.badge}
                  </span>
                )}
              </div>

              {/* Label */}
              <span className="text-[10px] tracking-tight mt-1 truncate max-w-full font-headline">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
