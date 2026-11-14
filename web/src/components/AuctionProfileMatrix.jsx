import React, { useState, useMemo } from 'react';
import {
  Columns3,
  BarChart2,
  TrendingUp,
  Activity,
  Layers,
  Info,
  Maximize2,
  Minimize2,
  Target,
  Flame,
  Check,
} from 'lucide-react';
import { calculateAuctionProfile } from '../utils/auctionProfile';

export default function AuctionProfileMatrix({
  symbol = 'XAUUSD',
  barsData = [],
  footprintData = [],
  currentPrice,
  decimals = 2,
}) {
  const [hoveredRow, setHoveredRow] = useState(null);
  const [viewScope, setViewScope] = useState('session'); // 'session' | 'daily'
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Slice bars according to selected scope
  const targetBars = useMemo(() => {
    if (!barsData || barsData.length === 0) return [];
    if (viewScope === 'session') return barsData.slice(-32); // active session
    return barsData.slice(-64); // full day auction
  }, [barsData, viewScope]);

  // Compute synchronized Volume, Delta, and TPO profile
  const profile = useMemo(() => {
    return calculateAuctionProfile(targetBars, footprintData, 26);
  }, [targetBars, footprintData]);

  if (!profile || !profile.rows || profile.rows.length === 0) {
    return (
      <div className="bg-[#0B0D11] border border-[#1E2430] rounded-[8px] p-6 text-center text-slate-400 font-sans">
        <Columns3 className="w-6 h-6 mx-auto mb-2 text-slate-500 animate-pulse" />
        <p className="text-xs font-mono">Computing Volume, Delta & TPO Profile Matrix...</p>
      </div>
    );
  }

  const {
    rows,
    pocPrice,
    lvnPrice,
    outlierPrice,
    vahPrice,
    valPrice,
    maxVolume,
    maxAbsDelta,
    maxTpoCount,
    netCvd,
    totalSessionVol,
  } = profile;

  return (
    <div
      className={`bg-[#0A0C10] border border-[#1E2430] rounded-[8px] text-[#E2E8F0] shadow-[0_4px_24px_rgba(0,0,0,0.35)] overflow-hidden flex flex-col font-sans transition-all duration-300 ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none p-3 sm:p-5 overflow-y-auto' : 'relative'
      }`}
    >
      {/* 1. Header Toolbar */}
      <div className="px-4 py-3 border-b border-[#1E2430] flex flex-wrap items-center justify-between gap-3 bg-[#0E1117]">
        {/* Title & Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-[5px] bg-[#1E2430] border border-slate-700/60 flex items-center justify-center shrink-0">
            <Columns3 className="w-4 h-4 text-[#C564C4]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-bold tracking-tight text-white font-headline uppercase">
                AUCTION PROFILE MATRIX
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#161B22] text-[#38BDF8] border border-[#1E2430]">
                {symbol} • {viewScope === 'session' ? 'Active Session' : '24H Auction'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Volume at Price • Bid/Ask Delta Divergence • Time Price Opportunity (TPO)
            </p>
          </div>
        </div>

        {/* Live Metrics & Legend Tags */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          {/* POC Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] bg-[#E024B7]/15 border border-[#E024B7]/40 text-[#FF2E93] font-bold">
            <span className="w-2 h-2 rounded-full bg-[#E024B7]"></span>
            <span>POC: ${pocPrice.toFixed(decimals)}</span>
          </div>

          {/* Outlier Delta Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] bg-[#00E676]/15 border border-[#00E676]/40 text-[#00E676] font-bold">
            <span className="w-2 h-2 rounded-full bg-[#00E676] animate-pulse"></span>
            <span>OUTLIER: ${outlierPrice.toFixed(decimals)}</span>
          </div>

          {/* Single Prints / LVN Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] bg-white/10 border border-white/20 text-white font-semibold">
            <span className="w-2 h-2 rounded-full bg-white"></span>
            <span>LVN: ${lvnPrice.toFixed(decimals)}</span>
          </div>

          {/* Scope Selector */}
          <div className="flex items-center bg-[#161B22] p-0.5 rounded-[5px] border border-[#1E2430]">
            <button
              onClick={() => setViewScope('session')}
              className={`px-2 py-0.5 rounded-[4px] text-[11px] font-medium transition cursor-pointer ${
                viewScope === 'session' ? 'bg-[#2563EB] text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Session
            </button>
            <button
              onClick={() => setViewScope('daily')}
              className={`px-2 py-0.5 rounded-[4px] text-[11px] font-medium transition cursor-pointer ${
                viewScope === 'daily' ? 'bg-[#2563EB] text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              24H Day
            </button>
          </div>

          {/* Fullscreen Expand */}
          <button
            onClick={() => setIsFullscreen((prev) => !prev)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Profile Matrix'}
            className="w-7 h-7 flex items-center justify-center rounded-[5px] bg-[#161B22] border border-[#1E2430] hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 2. Three-Column Headers (Matching Reference: VOLUME | DELTA | TPO) */}
      <div className="grid grid-cols-12 border-b border-[#1E2430] bg-[#0E1117] text-xs font-mono font-bold uppercase tracking-wider text-slate-400 py-2 px-3 sm:px-4">
        {/* Price Tag Column */}
        <div className="col-span-2 text-left pl-1">PRICE</div>
        {/* Column 1: VOLUME */}
        <div className="col-span-4 text-left pl-3 flex items-center gap-1.5 text-slate-300">
          <span>VOLUME</span>
          <span className="text-[10px] text-slate-500 font-normal">({totalSessionVol.toLocaleString()} lots)</span>
        </div>
        {/* Column 2: DELTA */}
        <div className="col-span-3 text-center flex items-center justify-center gap-1.5 text-slate-300">
          <span>DELTA</span>
          <span className={`text-[10px] font-normal ${netCvd >= 0 ? 'text-[#00E676]' : 'text-[#8B5CF6]'}`}>
            ({netCvd >= 0 ? `+${netCvd}` : netCvd})
          </span>
        </div>
        {/* Column 3: TPO */}
        <div className="col-span-3 text-left pl-4 text-slate-300">
          <span>TPO</span>
        </div>
      </div>

      {/* 3. Main Synchronized Profile Grid Rows */}
      <div className="divide-y divide-[#161B22] bg-[#08090C] overflow-x-auto select-none">
        {rows.map((row) => {
          const isHovered = hoveredRow === row.index;
          const isNearCurrent = currentPrice != null && Math.abs(currentPrice - row.price) <= profile.binStep * 0.5;

          // Bar width calculations (percentage)
          const volWidthPct = Math.max(3, (row.volume / maxVolume) * 100);
          const deltaWidthPct = Math.max(2, (Math.abs(row.delta) / maxAbsDelta) * 100);

          // Volume Bar Color Theme (matching uploaded reference):
          // Upper distribution: Slate Teal (#4A6B74)
          // Lower distribution: Terracotta Orange (#C25E2E)
          // POC: Vivid Magenta (#E024B7)
          let volBarColor = row.distribution === 'upper' ? 'bg-[#43646F]' : 'bg-[#C25E2E]';
          if (row.isPoc) {
            volBarColor = 'bg-[#E024B7] shadow-[0_0_12px_rgba(224,36,183,0.6)]';
          }

          return (
            <div
              key={row.index}
              onMouseEnter={() => setHoveredRow(row.index)}
              onMouseLeave={() => setHoveredRow(null)}
              className={`grid grid-cols-12 items-center py-1 sm:py-1.5 px-3 sm:px-4 text-xs font-mono transition-colors duration-150 relative ${
                isHovered
                  ? 'bg-white/10'
                  : isNearCurrent
                  ? 'bg-blue-500/10'
                  : row.isPoc
                  ? 'bg-[#E024B7]/08'
                  : 'hover:bg-white/5'
              }`}
            >
              {/* Price Ladder Level */}
              <div className="col-span-2 flex items-center gap-1.5">
                <span
                  className={`text-[11px] sm:text-xs font-bold ${
                    row.isPoc
                      ? 'text-[#FF2E93]'
                      : row.isOutlier
                      ? 'text-[#00E676]'
                      : isNearCurrent
                      ? 'text-[#38BDF8]'
                      : 'text-slate-400'
                  }`}
                >
                  ${row.price.toFixed(decimals)}
                </span>
                {isNearCurrent && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] animate-ping" title="Live Spot Price"></span>
                )}
              </div>

              {/* COLUMN 1: VOLUME PROFILE */}
              <div className="col-span-4 pl-3 relative flex items-center pr-2">
                {/* Horizontal Volume Bar */}
                <div className="w-full bg-slate-800/40 h-3.5 sm:h-4 rounded-[2px] overflow-visible relative flex items-center">
                  <div
                    className={`h-full rounded-[2px] transition-all duration-300 relative ${volBarColor}`}
                    style={{ width: `${volWidthPct}%` }}
                  >
                    {/* Horizontal tick mark pointer for POC bar (just like reference image) */}
                    {row.isPoc && (
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-0.5 bg-white translate-x-full"></div>
                    )}
                  </div>

                  {/* Volume Number on Hover */}
                  <span className="absolute left-1 text-[9px] font-bold text-white/90 drop-shadow">
                    {Math.round(row.volume).toLocaleString()}
                  </span>
                </div>

                {/* LVN Badge (Low Volume Node) positioned on the waist */}
                {row.isLvn && (
                  <div className="absolute left-20 z-20">
                    <span className="bg-white text-black font-extrabold text-[9px] px-2 py-0.5 rounded-[4px] shadow-[0_2px_8px_rgba(255,255,255,0.3)] tracking-wide border border-black/20">
                      LVN
                    </span>
                  </div>
                )}
              </div>

              {/* COLUMN 2: DELTA PROFILE (Divergent Purple Left vs Green Right) */}
              <div className="col-span-3 px-2 relative flex items-center justify-center">
                {/* Zero Center-Line Layout */}
                <div className="w-full flex items-center h-3.5 sm:h-4 relative">
                  {/* Left Half: Negative Delta (Purple/Violet) */}
                  <div className="w-1/2 h-full flex justify-end items-center pr-0.5 border-r border-slate-700">
                    {row.delta < 0 && (
                      <div
                        className="h-full bg-[#8B5CF6] rounded-l-[2px] transition-all duration-300"
                        style={{ width: `${deltaWidthPct}%` }}
                        title={`Negative Delta: ${row.delta}`}
                      />
                    )}
                  </div>

                  {/* Right Half: Positive Delta (Neon Green) */}
                  <div className="w-1/2 h-full flex justify-start items-center pl-0.5">
                    {row.delta > 0 && (
                      <div
                        className="h-full bg-[#00E676] rounded-r-[2px] transition-all duration-300"
                        style={{ width: `${deltaWidthPct}%` }}
                        title={`Positive Delta: +${row.delta}`}
                      />
                    )}
                  </div>

                  {/* Delta Number on Hover */}
                  {isHovered && (
                    <span
                      className={`absolute inset-0 flex items-center justify-center text-[9px] font-bold ${
                        row.delta >= 0 ? 'text-[#00E676]' : 'text-[#C084FC]'
                      }`}
                    >
                      {row.delta >= 0 ? `+${row.delta}` : row.delta}
                    </span>
                  )}
                </div>

                {/* OUTLIER Pill Badge (Glowing Neon Green attached to outlier peak) */}
                {row.isOutlier && (
                  <div className="absolute right-1 z-20">
                    <span className="bg-[#00E676] text-black font-black text-[9px] px-2 py-0.5 rounded-full shadow-[0_0_12px_#00E676] border border-black/30 tracking-wider flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-black animate-ping"></span>
                      OUTLIER
                    </span>
                  </div>
                )}
              </div>

              {/* COLUMN 3: TPO (Time Price Opportunity Blocks) */}
              <div className="col-span-3 pl-4 relative flex items-center gap-1 border-l border-slate-800">
                {/* Modular TPO Blocks Grid (Warm Camel/Wheat #D4A373) */}
                <div className="flex items-center gap-0.5 overflow-hidden flex-wrap max-w-full">
                  {row.tpoLetters.slice(0, 16).map((letter, lIdx) => (
                    <div
                      key={lIdx}
                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-[2px] bg-[#D4A373] text-[#1E1B18] font-bold text-[8.5px] sm:text-[9px] flex items-center justify-center shadow-xs select-none"
                      title={`TPO Bracket: ${letter} at $${row.price.toFixed(decimals)}`}
                    >
                      {letter}
                    </div>
                  ))}
                  {row.tpoLetters.length > 16 && (
                    <span className="text-[8px] text-slate-500 font-bold pl-0.5">
                      +{row.tpoLetters.length - 16}
                    </span>
                  )}
                </div>

                {/* SINGLE PRINTS Pill Badge (White pill attached to single print corridor) */}
                {row.isSinglePrint && (
                  <div className="absolute left-10 z-20">
                    <span className="bg-white text-black font-extrabold text-[9px] px-2 py-0.5 rounded-[4px] shadow-[0_2px_8px_rgba(255,255,255,0.35)] tracking-wide border border-black/20 whitespace-nowrap">
                      SINGLE PRINTS
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Institutional Takeaways Footer */}
      <div className="px-4 py-2.5 bg-[#0E1117] border-t border-[#1E2430] flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-white font-semibold">
            <span className="w-2 h-2 rounded-full bg-[#E024B7]"></span>
            POC: Maximum Accepted Auction Node
          </span>
          <span className="text-slate-600 hidden sm:inline">•</span>
          <span className="flex items-center gap-1.5 text-[#00E676] font-semibold hidden md:inline-flex">
            <span className="w-2 h-2 rounded-full bg-[#00E676]"></span>
            Outlier Delta: Institutional Aggression
          </span>
          <span className="text-slate-600 hidden md:inline">•</span>
          <span className="flex items-center gap-1.5 text-white font-semibold hidden lg:inline-flex">
            <span className="w-2 h-2 rounded-full bg-white"></span>
            Single Prints: Fast Displacement Zone (Support/Resistance)
          </span>
        </div>

        <div className="text-slate-500 text-[10px]">
          Auction Market Theory • J. Peter Steidlmayer TPO Standard
        </div>
      </div>
    </div>
  );
}
