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
      isActive: activeView === 'candles' || activeView === 'all',
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
        const el = document.getElementById('volume-profile-section');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          onChangeView('all');
        }
      },
      isActive: false,
    },
    {
      id: 'signals',
      label: 'MT5 Signals',
      icon: Zap,
      action: () => {
        const el = document.getElementById('signals-section');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      },
      badge: signalsCount > 0 ? signalsCount : null,
      isActive: false,
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
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 pt-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom))]"
    >
      {/* Optional PWA One-Tap Install Pill for Mobile & Tablet */}
      {deferredPrompt && !isInstalled && (
        <div className="max-w-md mx-auto mb-1 px-2">
          <button
            onClick={handleInstallClick}
            className="w-full bg-gradient-to-r from-blue-600 to-sky-600 text-white rounded-lg py-1 px-2.5 text-[11px] font-bold flex items-center justify-between shadow-sm active:scale-[0.99] transition"
          >
            <span className="flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5 animate-bounce" />
              Install Trading Boy App on Home Screen
            </span>
            <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
              + ADD
            </span>
          </button>
        </div>
      )}

      {/* Main Tabs */}
      <div className="max-w-md mx-auto grid grid-cols-5 gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.isActive;

          return (
            <button
              key={item.id}
              onClick={item.action}
              className={`relative flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all ${
                active
                  ? 'text-blue-700 font-bold bg-blue-50/80'
                  : 'text-slate-500 hover:text-slate-900 active:bg-slate-100'
              }`}
            >
              {/* Active Indicator Top Dot */}
              {active && (
                <span className="absolute top-1 w-1 h-1 rounded-full bg-blue-600"></span>
              )}

              {/* Icon Container */}
              <div className="relative mt-0.5">
                <Icon className={`w-5 h-5 ${active ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
                {item.badge && (
                  <span className="absolute -top-1 -right-2 bg-emerald-500 text-white text-[9px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white animate-pulse">
                    {item.badge}
                  </span>
                )}
              </div>

              {/* Label */}
              <span className="text-[10px] tracking-tight mt-1 truncate max-w-full">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
