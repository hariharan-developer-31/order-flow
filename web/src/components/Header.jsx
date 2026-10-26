import React from 'react';
import {
  Activity,
  Volume2,
  VolumeX,
  RefreshCw,
  Settings,
  TrendingUp,
  Layers,
  CheckCircle2,
  AlertCircle
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
      <div className="max-w-[1720px] mx-auto px-4 sm:px-6 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-extrabold text-lg shadow-md shadow-blue-500/20">
              TB
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-slate-900">
                  TRADING BOY
                </h1>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Order Flow Pro
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium hidden sm:block">
                Institutional Volume Profile & Footprint Terminal
              </p>
            </div>
          </div>

          {/* Asset Switcher Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            {symbols.map((sym) => {
              const active = sym === activeSymbol;
              return (
                <button
                  key={sym}
                  onClick={() => onSelectSymbol(sym)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
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
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isConnected ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-rose-500 ring-2 ring-rose-200'
                }`}
              ></span>
              <span className="text-[11px] font-semibold text-slate-500 hidden xl:inline">
                {isConnected ? 'API Live' : 'Connecting'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
