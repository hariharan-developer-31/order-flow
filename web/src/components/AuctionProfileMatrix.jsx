import React, { useState, useEffect, useMemo } from 'react';
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

  // Lock background body scroll on fullscreen
  useEffect(() => {
    if (isFullscreen) {
      const origOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = origOverflow;
      };
    }
  }, [isFullscreen]);

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
      <div className="bg-white border border-[#0D0D0C]/10 rounded-[8px] p-6 text-center text-[#0D0D0C]/60 font-sans shadow-xs">
        <Columns3 className="w-6 h-6 mx-auto mb-2 text-[#0D0D0C]/40 animate-pulse" />
        <p className="text-xs font-mono font-medium">Computing Volume, Delta & TPO Profile Matrix...</p>
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

  const livePriceNum = currentPrice != null ? Number(currentPrice) : null;
  const distFromPoc = livePriceNum != null ? (livePriceNum - pocPrice) : null;

  // Find the single closest price row to current live spot price
  const closestRowIndex = useMemo(() => {
    if (livePriceNum == null || !rows || rows.length === 0) return -1;
    let minDiff = Infinity;
    let closestIdx = -1;
    rows.forEach((r) => {
      const diff = Math.abs(livePriceNum - r.price);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = r.index;
      }
    });
    return closestIdx;
  }, [livePriceNum, rows]);

  return (
    <div
      className={`bg-white border border-[#0D0D0C]/10 rounded-[8px] text-[#0D0D0C] shadow-[0_2px_12px_rgba(13,13,12,0.05)] overflow-hidden flex flex-col font-sans transition-all duration-300 ${
        isFullscreen ? 'fixed inset-0 z-[99999] rounded-none p-0 m-0 w-screen h-screen overflow-y-auto bg-white overscroll-none' : 'relative'
      }`}
    >
      {/* 1. Header Toolbar (Pure White Theme) */}
      <div className="px-4 py-3 border-b border-[#0D0D0C]/10 flex flex-wrap items-center justify-between gap-3 bg-[#F8F9FA]">
        {/* Title & Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-[5px] bg-[#0D0D0C] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Columns3 className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-bold tracking-tight text-[#0D0D0C] font-headline uppercase">
                AUCTION PROFILE MATRIX
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white text-[#0D0D0C] border border-[#0D0D0C]/15 font-semibold shadow-2xs">
                {symbol} • {viewScope === 'session' ? 'Active Session' : '24H Auction'}
              </span>
            </div>
            <p className="text-[11px] text-[#0D0D0C]/60 font-mono">
              Volume at Price • Bid/Ask Delta Divergence • Time Price Opportunity (TPO)
            </p>
          </div>
        </div>

        {/* Live Spot Price & Institutional Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          {/* Prominent Live Price Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-white border border-[#3FB874]/40 shadow-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-[#3FB874] animate-pulse"></span>
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-1.5 leading-none">
              <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-[#0D0D0C]/50">
                LIVE PRICE
              </span>
              <span className="text-xs sm:text-sm font-mono font-black text-[#0D0D0C]">
                ${livePriceNum != null ? livePriceNum.toFixed(decimals) : '—'}
              </span>
            </div>
          </div>

          {/* POC Badge */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] bg-[#E024B7]/10 border border-[#E024B7]/30 text-[#A21CAF] font-bold"
            title={`Point of Control: High-Volume Acceptance Node (${distFromPoc != null ? `${distFromPoc >= 0 ? '+' : ''}${distFromPoc.toFixed(decimals)} from Live Price` : ''})`}
          >
            <span className="w-2 h-2 rounded-full bg-[#E024B7]"></span>
            <span>POC: ${pocPrice.toFixed(decimals)}</span>
          </div>

          {/* Outlier Delta Badge */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] bg-[#16A34A]/10 border border-[#16A34A]/30 text-[#15803D] font-bold"
            title="Outlier Delta: Concentrated Aggressive Order Flow"
          >
            <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse"></span>
            <span>OUTLIER: ${outlierPrice.toFixed(decimals)}</span>
          </div>

          {/* Single Prints / LVN Badge */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] bg-[#0D0D0C]/06 border border-[#0D0D0C]/15 text-[#0D0D0C] font-semibold"
            title="Low Volume Node: Rejection & Rapid Price Travel Pocket"
          >
            <span className="w-2 h-2 rounded-full bg-[#0D0D0C]"></span>
            <span>LVN: ${lvnPrice.toFixed(decimals)}</span>
          </div>

          {/* Scope Selector */}
          <div className="flex items-center bg-[#F4F4F5] p-0.5 rounded-[5px] border border-[#0D0D0C]/10">
            <button
              onClick={() => setViewScope('session')}
              className={`px-2 py-0.5 rounded-[4px] text-[11px] font-medium transition cursor-pointer ${
                viewScope === 'session' ? 'bg-[#0D0D0C] text-white font-bold shadow-xs' : 'text-[#0D0D0C]/60 hover:text-[#0D0D0C]'
              }`}
            >
              Session
            </button>
            <button
              onClick={() => setViewScope('daily')}
              className={`px-2 py-0.5 rounded-[4px] text-[11px] font-medium transition cursor-pointer ${
                viewScope === 'daily' ? 'bg-[#0D0D0C] text-white font-bold shadow-xs' : 'text-[#0D0D0C]/60 hover:text-[#0D0D0C]'
              }`}
            >
              24H Day
            </button>
          </div>

          {/* Fullscreen Expand */}
          <button
            onClick={() => setIsFullscreen((prev) => !prev)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Profile Matrix'}
            className="w-7 h-7 flex items-center justify-center rounded-[5px] bg-white border border-[#0D0D0C]/15 hover:bg-[#F4F4F5] text-[#0D0D0C] transition cursor-pointer shadow-xs"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 2. Three-Column Headers (Matching Reference: VOLUME | DELTA | TPO) */}
      <div className="grid grid-cols-12 border-b border-[#0D0D0C]/10 bg-[#F4F4F5] text-xs font-mono font-bold uppercase tracking-wider text-[#0D0D0C]/70 py-2.5 px-3 sm:px-4">
        {/* Price Tag Column */}
        <div className="col-span-2 text-left pl-1">PRICE</div>
        {/* Column 1: VOLUME */}
        <div className="col-span-4 text-left pl-3 flex items-center gap-1.5 text-[#0D0D0C]">
          <span>VOLUME</span>
          <span className="text-[10px] text-[#0D0D0C]/50 font-normal">({totalSessionVol.toLocaleString()} lots)</span>
        </div>
        {/* Column 2: DELTA */}
        <div className="col-span-3 text-center flex items-center justify-center gap-1.5 text-[#0D0D0C]">
          <span>DELTA</span>
          <span className={`text-[10px] font-normal ${netCvd >= 0 ? 'text-[#16A34A]' : 'text-[#7C3AED]'}`}>
            ({netCvd >= 0 ? `+${netCvd}` : netCvd})
          </span>
        </div>
        {/* Column 3: TPO */}
        <div className="col-span-3 text-left pl-4 text-[#0D0D0C] flex items-center gap-1.5">
          <span>TPO</span>
          <span className="text-[10px] text-[#0D0D0C]/50 font-normal">(Steidlmayer Profile)</span>
        </div>
      </div>

      {/* 3. Main Synchronized Profile Grid Rows (Pure White Theme) */}
      <div className="divide-y divide-[#0D0D0C]/06 bg-white overflow-x-auto select-none">
        {rows.map((row) => {
          const isHovered = hoveredRow === row.index;
          // Exact single closest row to live spot price
          const isClosestLive = row.index === closestRowIndex;

          // Bar width calculations (percentage)
          const volWidthPct = Math.max(3, (row.volume / maxVolume) * 100);
          const deltaWidthPct = Math.max(2, (Math.abs(row.delta) / maxAbsDelta) * 100);

          // Volume Bar Color Theme (matching uploaded reference in pure white theme):
          // Upper distribution: Slate Teal (#386B7A)
          // Lower distribution: Terracotta Orange (#C25E2E)
          // POC: Vivid Magenta (#E024B7)
          let volBarColor = row.distribution === 'upper' ? 'bg-[#386B7A]' : 'bg-[#C25E2E]';
          if (row.isPoc) {
            volBarColor = 'bg-[#E024B7] shadow-sm';
          }

          return (
            <div
              key={row.index}
              onMouseEnter={() => setHoveredRow(row.index)}
              onMouseLeave={() => setHoveredRow(null)}
              className={`grid grid-cols-12 items-center py-1 sm:py-1.5 px-3 sm:px-4 text-xs font-mono transition-colors duration-150 relative ${
                isClosestLive
                  ? 'bg-[#2563EB]/08 ring-1 ring-[#2563EB]/40 font-semibold shadow-2xs'
                  : isHovered
                  ? 'bg-[#F4F4F5]'
                  : row.isPoc
                  ? 'bg-[#E024B7]/05'
                  : 'bg-white hover:bg-[#F8F9FA]'
              }`}
            >
              {/* Price Ladder Level */}
              <div className="col-span-2 flex items-center gap-1.5">
                <span
                  className={`text-[11px] sm:text-xs font-mono font-bold ${
                    isClosestLive
                      ? 'text-[#1D4ED8] font-black'
                      : row.isPoc
                      ? 'text-[#A21CAF] font-black'
                      : row.isOutlier
                      ? 'text-[#15803D]'
                      : 'text-[#0D0D0C]/80'
                  }`}
                >
                  ${row.price.toFixed(decimals)}
                </span>
                {isClosestLive && (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-[4px] bg-[#2563EB] text-white font-mono font-black text-[9px] shadow-sm tracking-wide"
                    title={`Live Spot Price: $${livePriceNum?.toFixed(decimals)}`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                    LIVE
                  </span>
                )}
              </div>

              {/* COLUMN 1: VOLUME PROFILE */}
              <div className="col-span-4 pl-3 relative flex items-center pr-2">
                {/* Horizontal Volume Bar */}
                <div className="w-full bg-[#0D0D0C]/05 h-3.5 sm:h-4 rounded-[2px] overflow-visible relative flex items-center">
                  <div
                    className={`h-full rounded-[2px] transition-all duration-300 relative ${volBarColor}`}
                    style={{ width: `${volWidthPct}%` }}
                  >
                    {/* Horizontal tick mark pointer for POC bar (matching reference image) */}
                    {row.isPoc && (
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-0.5 bg-[#0D0D0C] translate-x-full"></div>
                    )}
                  </div>

                  {/* Volume Number */}
                  <span
                    className={`absolute left-1.5 text-[9px] font-bold ${
                      volWidthPct > 28 ? 'text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]' : 'text-[#0D0D0C]/75'
                    }`}
                  >
                    {Math.round(row.volume).toLocaleString()}
                  </span>
                </div>

                {/* LVN Badge (Low Volume Node) positioned on the waist */}
                {row.isLvn && (
                  <div className="absolute left-20 z-20">
                    <span className="bg-[#0D0D0C] text-white font-black text-[9px] px-2 py-0.5 rounded-[4px] shadow-sm tracking-wide border border-[#0D0D0C]">
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
                  <div className="w-1/2 h-full flex justify-end items-center pr-0.5 border-r border-[#0D0D0C]/20 bg-[#0D0D0C]/02">
                    {row.delta < 0 && (
                      <div
                        className="h-full bg-[#7C3AED] rounded-l-[2px] transition-all duration-300"
                        style={{ width: `${deltaWidthPct}%` }}
                        title={`Negative Delta: ${row.delta}`}
                      />
                    )}
                  </div>

                  {/* Right Half: Positive Delta (Emerald Green) */}
                  <div className="w-1/2 h-full flex justify-start items-center pl-0.5 bg-[#0D0D0C]/02">
                    {row.delta > 0 && (
                      <div
                        className="h-full bg-[#16A34A] rounded-r-[2px] transition-all duration-300"
                        style={{ width: `${deltaWidthPct}%` }}
                        title={`Positive Delta: +${row.delta}`}
                      />
                    )}
                  </div>

                  {/* Delta Number on Hover or Outlier */}
                  {(isHovered || row.isOutlier) && (
                    <span
                      className={`absolute inset-0 flex items-center justify-center text-[9px] font-extrabold drop-shadow-xs ${
                        row.delta >= 0 ? 'text-[#15803D]' : 'text-[#7C3AED]'
                      }`}
                    >
                      {row.delta >= 0 ? `+${Math.round(row.delta).toLocaleString()}` : Math.round(row.delta).toLocaleString()}
                    </span>
                  )}
                </div>

                {/* OUTLIER Pill Badge (Emerald Pill attached to outlier peak) */}
                {row.isOutlier && (
                  <div className="absolute right-1 z-20">
                    <span className="bg-[#16A34A] text-white font-black text-[9px] px-2 py-0.5 rounded-full shadow-[0_2px_8px_rgba(22,163,74,0.35)] tracking-wider flex items-center gap-1 border border-white">
                      <span className="w-1 h-1 rounded-full bg-white animate-ping"></span>
                      OUTLIER
                    </span>
                  </div>
                )}
              </div>

              {/* COLUMN 3: TPO (Time Price Opportunity Blocks) */}
              <div className="col-span-3 pl-4 relative flex items-center gap-1 border-l border-[#0D0D0C]/10">
                {/* Modular TPO Blocks Grid (Warm Camel/Wheat #D4A373) */}
                <div className="flex items-center gap-0.5 overflow-hidden flex-wrap max-w-full">
                  {row.tpoLetters.slice(0, 16).map((letter, lIdx) => (
                    <div
                      key={lIdx}
                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-[2px] bg-[#D4A373] text-[#1E1B18] font-bold text-[8.5px] sm:text-[9px] flex items-center justify-center border border-[#B08968]/30 shadow-xs select-none"
                      title={`TPO Bracket: ${letter} at $${row.price.toFixed(decimals)}`}
                    >
                      {letter}
                    </div>
                  ))}
                  {row.tpoLetters.length > 16 && (
                    <span className="text-[8px] text-[#0D0D0C]/50 font-bold pl-0.5">
                      +{row.tpoLetters.length - 16}
                    </span>
                  )}
                </div>

                {/* SINGLE PRINTS Pill Badge (Attached to single print corridor) */}
                {row.isSinglePrint && (
                  <div className="absolute left-10 z-20">
                    <span className="bg-[#0D0D0C] text-white font-black text-[9px] px-2 py-0.5 rounded-[4px] shadow-sm tracking-wide border border-[#0D0D0C] whitespace-nowrap">
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
      <div className="px-4 py-2.5 bg-[#F8F9FA] border-t border-[#0D0D0C]/10 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-[#0D0D0C]/70">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[#0D0D0C] font-semibold">
            <span className="w-2 h-2 rounded-full bg-[#E024B7]"></span>
            POC: Maximum Accepted Volume Node
          </span>
          <span className="text-[#0D0D0C]/25 hidden sm:inline">•</span>
          <span className="flex items-center gap-1.5 text-[#15803D] font-semibold hidden md:inline-flex">
            <span className="w-2 h-2 rounded-full bg-[#16A34A]"></span>
            Outlier Delta: Buyer Aggression
          </span>
          <span className="text-[#0D0D0C]/25 hidden md:inline">•</span>
          <span className="flex items-center gap-1.5 text-[#0D0D0C] font-semibold hidden lg:inline-flex">
            <span className="w-2 h-2 rounded-full bg-[#0D0D0C]"></span>
            Single Prints: Fast Displacement Zone
          </span>
          <span className="text-[#0D0D0C]/25 hidden lg:inline">•</span>
          <span className="flex items-center gap-1.5 text-[#1D4ED8] font-bold">
            <span className="w-2 h-2 rounded-full bg-[#2563EB] animate-pulse"></span>
            Live Spot: ${livePriceNum != null ? livePriceNum.toFixed(decimals) : '—'}
          </span>
        </div>

        <div className="text-[#0D0D0C]/50 text-[10px]">
          Auction Market Theory • J. Peter Steidlmayer TPO Standard
        </div>
      </div>
    </div>
  );
}
