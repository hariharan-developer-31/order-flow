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
  Flame,
  Zap,
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
  signalsData,
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
      return 'bg-[#DFE9D4] text-[#0D0D0C] border-[#0D0D0C]/20';
    }
    if (state.includes('BELOW')) {
      return 'bg-[#F8DCC7] text-[#0D0D0C] border-[#0D0D0C]/20';
    }
    return 'bg-[#F4F4F5] text-[#0D0D0C] border-[#0D0D0C]/20';
  };

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-[#0D0D0C]/12 sticky top-0 z-30 w-full max-w-full overflow-x-hidden">
      <div className="max-w-full 2xl:max-w-[2100px] 3xl:max-w-[3200px] 4k:max-w-[3600px] mx-auto px-2.5 sm:px-6 3xl:px-10 py-2.5 sm:py-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-4">
          {/* Logo & Brand (Editorial Inter Tight Typography) */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
            {/* Glossy 3D inflated brand accent */}
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[7px] bg-[#0D0D0C] text-white flex items-center justify-center font-bold text-sm sm:text-base shrink-0 border border-[#0D0D0C] shadow-[inset_0_1px_2px_rgba(255,255,255,0.22),0_2px_8px_rgba(13,13,12,0.14)] relative overflow-hidden group">
              <span className="relative z-10 tracking-tight font-headline font-semibold">TB</span>
              <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-transparent pointer-events-none"></div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-[25px] font-semibold tracking-[-0.025em] text-[#0D0D0C] font-headline leading-tight">
                  TRADING BOY
                </h1>
                <span className="text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-[7px] bg-[#F4F4F5] text-[#0D0D0C] border border-[#0D0D0C]/15 font-sans">
                  Order Flow Pro
                </span>
              </div>
              <p className="text-[12.5px] text-[#0D0D0C]/56 font-sans font-normal hidden md:block">
                Institutional Volume Profile & Footprint Terminal
              </p>
            </div>
          </div>

          {/* Dedicated Institutional Gold (XAUUSD) Asset Badge */}
          <div className="flex items-center gap-2 bg-[#F8F9FA] border border-[#0D0D0C]/15 px-3 py-1.5 rounded-[7px] shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#E9C22E] animate-pulse"></span>
            <span className="text-xs font-semibold text-[#0D0D0C] tracking-tight font-sans">
              XAUUSD • Gold Spot
            </span>
            <span className="text-[10px] font-medium text-[#0D0D0C]/80 bg-[#F4F4F5] px-1.5 py-0.5 rounded-[5px] font-mono border border-[#0D0D0C]/10 hidden xs:inline">
              COMEX GC
            </span>
          </div>

          {/* Live Indian Standard Time & Active Institutional Session */}
          <div className="hidden md:flex items-center gap-2.5 bg-white border border-[#0D0D0C]/15 px-3 py-1.5 rounded-[7px]">
            <div className="flex items-center gap-1.5 font-mono text-xs font-medium text-[#0D0D0C]">
              <span className="w-2 h-2 rounded-full bg-[#3FB874] animate-pulse"></span>
              <span>{istClock || 'Loading...'} IST</span>
            </div>
            <span className="text-[#0D0D0C]/25">|</span>
            <span className="text-[11px] font-medium text-[#0D0D0C] bg-[#DFE9D4] px-2 py-0.5 rounded-[5px] border border-[#0D0D0C]/10 font-sans">
              {activeSession}
            </span>
          </div>

          {/* Current Asset Live Stats & Controls */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3.5 bg-white border border-[#0D0D0C]/15 px-3 py-1.5 rounded-[7px]">
              <div>
                <span className="text-[10px] uppercase font-medium text-[#0D0D0C]/56 block font-sans">
                  {activeSymbol} Spot
                </span>
                <span className="text-sm sm:text-base font-semibold text-[#0D0D0C] font-mono tracking-tight">
                  {currentPrice
                    ? currentPrice.toFixed(activeSymbol === 'XAUUSD' ? 2 : 5)
                    : '---'}
                </span>
              </div>

              {currentOF?.state && (
                <div
                  className={`text-[10px] sm:text-[11px] font-medium px-2 py-0.5 rounded-[7px] border ${getBadgeClass(
                    currentOF.state
                  )} flex items-center gap-1.5 font-sans`}
                >
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-current"></span>
                  <span className="hidden xs:inline">{currentOF.state.split('(')[0].trim()}</span>
                  <span className="xs:hidden">{currentOF.state.includes('ABOVE') ? 'Bullish' : currentOF.state.includes('BELOW') ? 'Bearish' : 'Balance'}</span>
                </div>
              )}
            </div>

            {/* Live Today's Net P&L % Badge */}
            {signalsData?.today_pnl && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] bg-white border border-[#0D0D0C]/15 text-xs font-mono font-medium">
                <span className="text-[11px] text-[#0D0D0C]/56 font-sans">Today:</span>
                <span className={signalsData.today_pnl.startsWith('+') ? 'text-[#3FB874] font-bold' : 'text-[#F2772F] font-bold'}>
                  {signalsData.today_pnl}
                </span>
                <span className="text-[11px] text-[#0D0D0C]/42 font-sans">({signalsData.trades_count ?? 0}/3)</span>
              </div>
            )}

            {/* View Switcher: Chart & VP vs Footprint vs VP Depth vs Signals vs Combined */}
            <div className="hidden lg:flex items-center bg-[#F4F4F5] p-1 rounded-[7px] border border-[#0D0D0C]/12 text-[14px] font-sans font-medium">
              <button
                onClick={() => onChangeView('candles')}
                className={`px-3 py-1 rounded-[5px] transition-all duration-300 ${
                  activeView === 'candles'
                    ? 'bg-[#0D0D0C] text-white font-semibold'
                    : 'text-[#0D0D0C]/70 hover:text-[#0D0D0C] hover:bg-[#0D0D0C]/5'
                }`}
              >
                Chart & VP
              </button>
              <button
                onClick={() => onChangeView('footprint')}
                className={`px-3 py-1 rounded-[5px] transition-all duration-300 ${
                  activeView === 'footprint'
                    ? 'bg-[#0D0D0C] text-white font-semibold'
                    : 'text-[#0D0D0C]/70 hover:text-[#0D0D0C] hover:bg-[#0D0D0C]/5'
                }`}
              >
                Footprint
              </button>
              <button
                onClick={() => onChangeView('volume-profile')}
                className={`px-3 py-1 rounded-[5px] transition-all duration-300 ${
                  activeView === 'volume-profile'
                    ? 'bg-[#0D0D0C] text-white font-semibold'
                    : 'text-[#0D0D0C]/70 hover:text-[#0D0D0C] hover:bg-[#0D0D0C]/5'
                }`}
              >
                VP Depth
              </button>
              <button
                onClick={() => onChangeView('signals')}
                className={`px-3 py-1 rounded-[5px] transition-all duration-300 ${
                  activeView === 'signals'
                    ? 'bg-[#0D0D0C] text-white font-semibold'
                    : 'text-[#0D0D0C]/70 hover:text-[#0D0D0C] hover:bg-[#0D0D0C]/5'
                }`}
              >
                MT5 Signals
              </button>
              <button
                onClick={() => onChangeView('all')}
                className={`px-3 py-1 rounded-[5px] transition-all duration-300 ${
                  activeView === 'all'
                    ? 'bg-[#0D0D0C] text-white font-semibold'
                    : 'text-[#0D0D0C]/70 hover:text-[#0D0D0C] hover:bg-[#0D0D0C]/5'
                }`}
              >
                Combined
              </button>
            </div>

            {/* Action Buttons (Refined 7px radii, thin near-black outlines) */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={onToggleSound}
                title={soundEnabled ? 'Mute Alert Sound' : 'Enable Alert Sound'}
                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-[7px] border border-[#0D0D0C]/15 bg-white hover:bg-[#0D0D0C] hover:text-white text-[#0D0D0C] transition-all duration-300"
              >
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4" />
                ) : (
                  <VolumeX className="w-4 h-4 opacity-40" />
                )}
              </button>

              <button
                onClick={onRefresh}
                disabled={isLoading}
                title="Refresh Live Data"
                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-[7px] border border-[#0D0D0C]/15 bg-white hover:bg-[#0D0D0C] hover:text-white text-[#0D0D0C] transition-all duration-300 disabled:opacity-40"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
                />
              </button>

              <button
                onClick={onOpenSettings}
                title="Configure Backend API URL"
                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-[7px] border border-[#0D0D0C]/15 bg-white hover:bg-[#0D0D0C] hover:text-white text-[#0D0D0C] transition-all duration-300"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>

            {/* Connection Indicator - 24/7 API Live */}
            <div
              className="flex items-center gap-1.5 pl-2 sm:pl-3 py-1 pr-1 border-l border-[#0D0D0C]/15 shrink-0"
              title="24/7 Global Live Financial Market Feed Active"
            >
              <span className="w-2 h-2 rounded-full bg-[#3FB874] animate-pulse"></span>
              <span className="text-[12px] font-medium text-[#0D0D0C] font-sans hidden xl:inline">
                API Live
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
