import React, { useState, useEffect } from 'react';
import {
  Activity,
  Volume2,
  VolumeX,
  RefreshCw,
  Settings,
  TrendingUp,
  Layers,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';

export default function Header({
  activeSymbol,
  onSelectSymbol,
  symbols,
  orderFlowData,
  currentPrice,
  isConnected,
  isLoading,
  onRefresh,
  soundEnabled,
  onToggleSound,
  onOpenSettings,
  activeView,
  onChangeView,
}) {
  const currentOF = orderFlowData?.find((o) => o.symbol === activeSymbol);

  // Live Indian Standard Time (IST - UTC+05:30) & Active Session
  const [istClock, setIstClock] = useState('');
  const [activeSession, setActiveSession] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      setIstClock(timeStr);

      const utcMins = now.getUTCHours() * 60 + now.getUTCMinutes();
      const istMins = (utcMins + 330) % 1440;
      if (istMins >= 330 && istMins < 810) {
        setActiveSession('Asian Session (05:30 - 13:30 IST)');
      } else if (istMins >= 810 && istMins < 1110) {
        setActiveSession('London Session (13:30 - 21:30 IST)');
      } else {
        setActiveSession('New York Session (18:30 - 03:30 IST)');
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const getBadgeClass = (state = '') => {
    if (state.includes('ABOVE')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-300';
    }
    if (state.includes('BELOW')) {
      return 'bg-rose-50 text-rose-700 border-rose-300';
    }
    return 'bg-amber-50 text-amber-800 border-amber-300';
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-full 2xl:max-w-[2100px] 3xl:max-w-[3200px] 4k:max-w-[3600px] mx-auto px-3 sm:px-6 3xl:px-10 py-2 sm:py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-extrabold text-base sm:text-lg shadow-md shadow-blue-500/20 shrink-0">
              TB
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-sm sm:text-base font-black tracking-tight text-slate-900">
                  TRADING BOY
                </h1>
                <span className="text-[9px] sm:text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Order Flow Pro
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden md:block">
                Institutional Volume Profile & Footprint Terminal
              </p>
            </div>
          </div>

          {/* Asset Switcher Tabs (Horizontally scrollable on mobile) */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto max-w-full no-scrollbar shrink-0">
            {symbols.map((sym) => {
              const active = sym === activeSymbol;
              return (
                <button
                  key={sym}
                  onClick={() => onSelectSymbol(sym)}
                  className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                    active
                      ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {sym === 'XAUUSD' ? 'XAUUSD (Gold)' : sym}
                </button>
              );
            })}
          </div>

          {/* Live Indian Standard Time & Active Institutional Session */}
          <div className="hidden md:flex items-center gap-2.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{istClock || 'Loading...'} IST</span>
            </div>
            <span className="text-slate-300">|</span>
            <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              {activeSession}
            </span>
          </div>

          {/* Current Asset Live Stats */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-xl">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  {activeSymbol} Spot
                </span>
                <span className="text-base font-extrabold text-slate-900 font-mono">
                  {currentPrice
                    ? currentPrice.toFixed(activeSymbol === 'XAUUSD' ? 2 : 5)
                    : '---'}
                </span>
              </div>

              {currentOF?.state && (
                <div
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${getBadgeClass(
                    currentOF.state
                  )} flex items-center gap-1.5`}
                >
                  <span className="w-2 h-2 rounded-full animate-pulse bg-current"></span>
                  {currentOF.state.split('(')[0].trim()}
                </div>
              )}
            </div>

            {/* View Switcher: Chart vs Footprint vs All */}
            <div className="hidden lg:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                onClick={() => onChangeView('all')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  activeView === 'all'
                    ? 'bg-white text-slate-900 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Combined View
              </button>
              <button
                onClick={() => onChangeView('candles')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  activeView === 'candles'
                    ? 'bg-white text-slate-900 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Volume Profile
              </button>
              <button
                onClick={() => onChangeView('footprint')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  activeView === 'footprint'
                    ? 'bg-white text-slate-900 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Footprint Delta
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={onToggleSound}
                title={soundEnabled ? 'Mute Alert Sound' : 'Enable Alert Sound'}
                className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
              >
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-blue-600" />
                ) : (
                  <VolumeX className="w-4 h-4 text-slate-400" />
                )}
              </button>

              <button
                onClick={onRefresh}
                disabled={isLoading}
                title="Refresh Live Data"
                className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`}
                />
              </button>

              <button
                onClick={onOpenSettings}
                title="Configure Backend API URL"
                className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>

            {/* Connection Indicator */}
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 pl-2.5 py-1 pr-1.5 border-l border-slate-200 hover:bg-slate-50 rounded-lg transition"
              title={isConnected ? 'Connected to TRADING BOY Backend API' : 'Simulation Mode (Click to connect Live Backend)'}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isConnected ? 'bg-emerald-500 ring-2 ring-emerald-200 animate-pulse' : 'bg-amber-400 ring-2 ring-amber-100'
                }`}
              ></span>
              <span className="text-[11px] font-semibold text-slate-600 hidden xl:inline">
                {isConnected ? 'API Live' : 'Simulation Mode'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
