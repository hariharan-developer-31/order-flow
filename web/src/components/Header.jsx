import React from 'react';
import {
  Activity,
  Volume2,
  VolumeX,
  RefreshCw,
} from 'lucide-react';

const TIMEFRAMES = [
  { id: '5m', label: '5m' },
  { id: '15m', label: '15m' },
  { id: '1h', label: '1H' },
  { id: '4h', label: '4H' },
];

export default function Header({
  activeSymbol = 'XAUUSD',
  currentPrice,
  timeframe = '1h',
  onSelectTimeframe,
  showStandardDeviation = false,
  onToggleStandardDeviation,
  isConnected = true,
  isLoading = false,
  onRefresh,
  soundEnabled = true,
  onToggleSound,
}) {
  const decimals = activeSymbol === 'XAUUSD' ? 2 : 5;

  return (
    <header className="bg-white border-b border-[#0D0D0C]/10 sticky top-0 z-30 w-full">
      <div className="max-w-full 2xl:max-w-[2100px] mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        {/* Brand & Symbol */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-[5px] bg-[#0D0D0C] text-white flex items-center justify-center font-bold text-xs shrink-0">
            TB
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm sm:text-base tracking-tight text-[#0D0D0C] font-headline">
              TRADING BOY
            </span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-[#F4F4F5] text-[#0D0D0C] text-[11px] font-mono font-medium border border-[#0D0D0C]/10">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3FB874] animate-pulse"></span>
              {activeSymbol}
            </span>
          </div>
        </div>

        {/* Center: Timeframe Selector */}
        <div className="flex items-center bg-[#F4F4F5] p-0.5 rounded-[5px] border border-[#0D0D0C]/10 text-xs font-mono">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.id}
              onClick={() => onSelectTimeframe && onSelectTimeframe(tf.id)}
              className={`px-2.5 py-1 rounded-[4px] font-medium transition-all duration-200 cursor-pointer ${
                timeframe === tf.id
                  ? 'bg-[#0D0D0C] text-white font-semibold shadow-xs'
                  : 'text-[#0D0D0C]/60 hover:text-[#0D0D0C]'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* Right: Live Price, Daily SD Toggle & Minimal Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Live Price Tag */}
          <div className="hidden sm:flex items-center gap-1.5 bg-[#F8F9FA] border border-[#0D0D0C]/10 px-2.5 py-1 rounded-[5px]">
            <span className="text-[10px] uppercase font-sans text-[#0D0D0C]/50 font-medium">SPOT:</span>
            <span className="text-sm font-bold font-mono text-[#0D0D0C]">
              {currentPrice != null ? currentPrice.toFixed(decimals) : '---'}
            </span>
          </div>

          {/* Daily Standard Deviation Toggle (Default: OFF) */}
          <button
            onClick={onToggleStandardDeviation}
            title={showStandardDeviation ? 'Daily Standard Deviation: ON' : 'Daily Standard Deviation: OFF'}
            className={`h-8 px-2.5 sm:px-3 flex items-center gap-1.5 rounded-[5px] border text-xs font-mono font-medium transition-all duration-200 cursor-pointer ${
              showStandardDeviation
                ? 'bg-[#0D0D0C] text-white border-[#0D0D0C] shadow-xs'
                : 'bg-white text-[#0D0D0C]/60 border-[#0D0D0C]/15 hover:text-[#0D0D0C] hover:border-[#0D0D0C]/35'
            }`}
          >
            <Activity className={`w-3.5 h-3.5 ${showStandardDeviation ? 'text-[#3FB874]' : 'text-[#0D0D0C]/60'}`} />
            <span className="hidden xs:inline">SD:</span>
            <span className={`font-bold ${showStandardDeviation ? 'text-white' : 'text-[#0D0D0C]/60'}`}>
              {showStandardDeviation ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={onToggleSound}
            title={soundEnabled ? 'Mute Alerts' : 'Enable Alerts'}
            className="w-8 h-8 flex items-center justify-center rounded-[5px] border border-[#0D0D0C]/15 bg-white hover:bg-[#F4F4F5] text-[#0D0D0C] transition duration-200 cursor-pointer"
          >
            {soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 opacity-40" />
            )}
          </button>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            title="Refresh Market Feed"
            className="w-8 h-8 flex items-center justify-center rounded-[5px] border border-[#0D0D0C]/15 bg-white hover:bg-[#F4F4F5] text-[#0D0D0C] transition duration-200 disabled:opacity-40 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {/* Live Status Indicator */}
          <div className="flex items-center gap-1.5 pl-1.5">
            <span className="w-2 h-2 rounded-full bg-[#3FB874] animate-pulse"></span>
            <span className="text-[11px] font-mono text-[#0D0D0C]/70 hidden md:inline">LIVE</span>
          </div>
        </div>
      </div>
    </header>
  );
}
