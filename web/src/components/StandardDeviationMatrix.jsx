import React, { useState } from 'react';
import {
  Activity,
  Copy,
  Check,
  TrendingUp,
  TrendingDown,
  Layers,
  Shield,
  Gauge,
  ArrowUpRight,
  ArrowDownRight,
  Info,
} from 'lucide-react';

export default function StandardDeviationMatrix({
  dailySD,
  currentPrice,
  symbol = 'XAUUSD',
  decimals = 2,
}) {
  const [copiedPrice, setCopiedPrice] = useState(null);

  if (!dailySD || !dailySD.vwap) {
    return (
      <div className="bg-white border border-[#0D0D0C]/15 rounded-[7px] p-6 text-center text-[#0D0D0C]/42 shadow-xs font-sans">
        <Activity className="w-6 h-6 mx-auto mb-2 opacity-50 animate-pulse" />
        <p className="text-xs font-semibold">Calculating Daily Standard Deviation levels...</p>
      </div>
    );
  }

  const {
    vwap,
    stdDev,
    zScore = 0,
    regime = 'Fair Value Equilibrium',
    regimeColor = '#0D0D0C',
    regimeAction = 'Balance / Rotation inside ±0.5σ equilibrium',
    levels = [],
    sd3Upper,
    sd2Upper,
    sd1Upper,
    sd1Lower,
    sd2Lower,
    sd3Lower,
  } = dailySD;

  const live = Number(currentPrice != null ? currentPrice : vwap);
  const distFromVwap = Number((live - vwap).toFixed(decimals));

  // Copy helper
  const handleCopy = (price, label) => {
    try {
      navigator.clipboard.writeText(price.toFixed(decimals));
      setCopiedPrice(label);
      setTimeout(() => setCopiedPrice(null), 1800);
    } catch (err) {
      console.warn('Clipboard copy failed:', err);
    }
  };

  // Percentage placement for live price on the Gaussian [-3σ to +3σ] gauge
  // Clamped between 3% and 97% to keep the marker inside the container
  const rawGaugePercent = ((zScore + 3.0) / 6.0) * 100;
  const clampedGaugePercent = Math.min(97, Math.max(3, rawGaugePercent));

  // Projected 2-Day (sqrt(2)) and Weekly (sqrt(5)) volatility moves
  const move2Day = Number((stdDev * Math.SQRT2).toFixed(decimals));
  const moveWeekly = Number((stdDev * Math.sqrt(5)).toFixed(decimals));
  const expectedMovePct = vwap > 0 ? ((stdDev / vwap) * 100).toFixed(2) : '0.00';

  return (
    <div className="bg-white border border-[#0D0D0C]/15 rounded-[7px] shadow-[0_2px_12px_rgba(13,13,12,0.04)] overflow-hidden flex flex-col font-sans transition-all duration-300">
      {/* 1. Header with Live Z-Score & Regime Status */}
      <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-[#0D0D0C]/12 flex flex-wrap items-center justify-between gap-3 bg-white">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[6px] bg-[#0D0D0C] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-[#0D0D0C] text-sm sm:text-base tracking-tight font-headline">
                Daily Standard Deviation Matrix
              </h3>
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-[4px] bg-[#F4F4F5] text-[#0D0D0C] border border-[#0D0D0C]/15">
                {symbol} • Trailing 24H VWAP
              </span>
            </div>
            <p className="text-[12px] text-[#0D0D0C]/56 font-sans">
              Expected Moves, Statistical Probabilities & Fair Value Bands
            </p>
          </div>
        </div>

        {/* Live Metrics Group */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          {/* Daily 1-Sigma Metric */}
          <div className="bg-[#F8F9FA] px-2.5 py-1 rounded-[5px] border border-[#0D0D0C]/12 flex items-center gap-1.5">
            <span className="text-[#0D0D0C]/56 text-[10px] font-sans font-medium">Daily σ:</span>
            <span className="font-bold text-[#0D0D0C]">
              ±${stdDev.toFixed(decimals)}
            </span>
            <span className="text-[10px] text-[#0D0D0C]/42">({expectedMovePct}%)</span>
          </div>

          {/* Live Z-Score Badge */}
          <div
            className="px-2.5 py-1 rounded-[5px] border flex items-center gap-1.5 font-bold"
            style={{
              backgroundColor: Math.abs(zScore) >= 2.0 ? 'rgba(242, 119, 47, 0.12)' : 'rgba(63, 184, 116, 0.12)',
              borderColor: Math.abs(zScore) >= 2.0 ? 'rgba(242, 119, 47, 0.35)' : 'rgba(63, 184, 116, 0.35)',
              color: '#0D0D0C',
            }}
            title="Z-Score = (Current Price - Daily VWAP) / Standard Deviation"
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>Z: {zScore >= 0 ? `+${zScore.toFixed(2)}` : zScore.toFixed(2)}σ</span>
          </div>

          {/* Volatility Regime Pill */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] bg-[#F4F4F5] border border-[#0D0D0C]/12 text-[11px] font-sans font-medium text-[#0D0D0C]">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: regimeColor }}
            ></span>
            <span>{regime}</span>
          </div>
        </div>
      </div>

      {/* 2. Visual Gaussian Bell Curve Normal Distribution Spectrum Gauge */}
      <div className="p-4 sm:p-5 border-b border-[#0D0D0C]/10 bg-[#FAFAFA]">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-medium text-[#0D0D0C] font-headline flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#0D0D0C]" />
            Statistical Distribution Spectrum
          </span>
          <span className="text-[11px] text-[#0D0D0C]/56 font-sans">
            Action: <b className="text-[#0D0D0C] font-medium">{regimeAction}</b>
          </span>
        </div>

        {/* Gauge Track */}
        <div className="relative pt-6 pb-4">
          {/* Main Track Bar */}
          <div className="h-3 w-full rounded-full bg-[#E5E5E5] relative overflow-hidden flex">
            {/* -3σ to -2σ (Extreme Oversold 2.15%) */}
            <div className="w-[16.66%] h-full bg-[#F2772F]/30" title="-3σ to -2σ Extreme Floor"></div>
            {/* -2σ to -1σ (Major Support Zone 13.6%) */}
            <div className="w-[16.66%] h-full bg-[#3FB874]/30" title="-2σ to -1σ Major Support"></div>
            {/* -1σ to Mean (Value Area Lower Half 34.1%) */}
            <div className="w-[16.66%] h-full bg-[#3FB874]/55" title="-1σ to VWAP Value Area"></div>
            {/* Mean to +1σ (Value Area Upper Half 34.1%) */}
            <div className="w-[16.66%] h-full bg-[#C564C4]/55" title="VWAP to +1σ Value Area"></div>
            {/* +1σ to +2σ (Major Resistance Zone 13.6%) */}
            <div className="w-[16.66%] h-full bg-[#E9C22E]/40" title="+1σ to +2σ Major Resistance"></div>
            {/* +2σ to +3σ (Extreme Overbought 2.15%) */}
            <div className="w-[16.66%] h-full bg-[#F2772F]/30" title="+2σ to +3σ Extreme Ceiling"></div>
          </div>

          {/* 68.2% Value Area Bracket Marker */}
          <div
            className="absolute top-4 h-1 border-t-2 border-b-2 border-dashed border-[#0D0D0C]/40"
            style={{ left: '33.33%', width: '33.33%' }}
            title="68.2% Normal Volatility Range (±1.0σ)"
          ></div>

          {/* Tick Markers */}
          <div className="relative w-full flex justify-between text-[10px] font-mono text-[#0D0D0C]/56 mt-2 select-none">
            <span className="w-8 text-left">-3σ</span>
            <span className="w-8 text-center">-2σ</span>
            <span className="w-8 text-center">-1σ</span>
            <span className="w-12 text-center font-bold text-[#0D0D0C]">VWAP</span>
            <span className="w-8 text-center">+1σ</span>
            <span className="w-8 text-center">+2σ</span>
            <span className="w-8 text-right">+3σ</span>
          </div>

          {/* Live Price Pin Marker */}
          <div
            className="absolute top-0 transition-all duration-300 pointer-events-none -translate-x-1/2 flex flex-col items-center"
            style={{ left: `${clampedGaugePercent}%` }}
          >
            <div className="bg-[#0D0D0C] text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-[4px] shadow-md whitespace-nowrap flex items-center gap-1">
              <span>${live.toFixed(decimals)}</span>
              <span className="text-[9px] text-[#E9C22E]">({zScore >= 0 ? `+${zScore}` : zScore}σ)</span>
            </div>
            <div className="w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-[#0D0D0C]"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-[#0D0D0C] border-2 border-white shadow-xs -mt-0.5 animate-pulse"></div>
          </div>
        </div>
      </div>

      {/* 3. Institutional Standard Deviation Levels Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#0D0D0C]/12 bg-[#F8F9FA] text-[11px] font-medium text-[#0D0D0C]/70 uppercase tracking-wider font-mono">
              <th className="py-2.5 px-3 sm:px-4">Band (σ)</th>
              <th className="py-2.5 px-3 sm:px-4">Institutional Definition & Role</th>
              <th className="py-2.5 px-3 sm:px-4">Price Level</th>
              <th className="py-2.5 px-3 sm:px-4">Delta from Spot</th>
              <th className="py-2.5 px-3 sm:px-4 hidden sm:table-cell">Distribution Probability</th>
              <th className="py-2.5 px-3 sm:px-4 text-right">Copy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#0D0D0C]/08 font-sans">
            {levels.map((lvl) => {
              const isCurrentNear = Math.abs(live - lvl.price) <= stdDev * 0.25;
              const isCopied = copiedPrice === lvl.sigma;

              return (
                <tr
                  key={lvl.sigma}
                  className={`transition-colors duration-150 hover:bg-[#F8F9FA] ${
                    lvl.isMean
                      ? 'bg-[#F4F4F5]/60 font-semibold'
                      : isCurrentNear
                      ? 'bg-[#3FB874]/05'
                      : ''
                  }`}
                >
                  {/* Sigma Identifier */}
                  <td className="py-2 sm:py-2.5 px-3 sm:px-4 whitespace-nowrap">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-[4px] font-mono text-[11px] font-bold border"
                      style={{
                        backgroundColor: `${lvl.color}15`,
                        borderColor: `${lvl.color}40`,
                        color: lvl.color === '#0D0D0C' ? '#0D0D0C' : lvl.color,
                      }}
                    >
                      {lvl.sigma}
                    </span>
                  </td>

                  {/* Level Name */}
                  <td className="py-2 sm:py-2.5 px-3 sm:px-4">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-[#0D0D0C] text-[12px] sm:text-[13px]">
                        {lvl.name}
                      </span>
                      {lvl.isMean && (
                        <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-[#0D0D0C] text-white font-mono">
                          Equilibrium
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Price with Click-to-Copy */}
                  <td className="py-2 sm:py-2.5 px-3 sm:px-4 font-mono font-bold text-[#0D0D0C] text-[12.5px] sm:text-[13.5px] whitespace-nowrap">
                    <button
                      onClick={() => handleCopy(lvl.price, lvl.sigma)}
                      className="hover:underline cursor-pointer flex items-center gap-1.5 group text-left"
                      title="Click to copy price"
                    >
                      <span>${lvl.price.toFixed(decimals)}</span>
                    </button>
                  </td>

                  {/* Delta from Spot */}
                  <td className="py-2 sm:py-2.5 px-3 sm:px-4 font-mono text-[11.5px] whitespace-nowrap">
                    <span
                      className={
                        lvl.dist > 0
                          ? 'text-[#C564C4] font-semibold'
                          : lvl.dist < 0
                          ? 'text-[#3FB874] font-semibold'
                          : 'text-[#0D0D0C]'
                      }
                    >
                      {lvl.dist > 0 ? `+$${lvl.dist.toFixed(decimals)}` : lvl.dist < 0 ? `-$${Math.abs(lvl.dist).toFixed(decimals)}` : '$0.00'}
                    </span>
                  </td>

                  {/* Distribution Probability */}
                  <td className="py-2 sm:py-2.5 px-3 sm:px-4 text-[11.5px] text-[#0D0D0C]/70 hidden sm:table-cell">
                    <span>{lvl.probability}</span>
                  </td>

                  {/* Copy Button */}
                  <td className="py-2 sm:py-2.5 px-3 sm:px-4 text-right whitespace-nowrap">
                    <button
                      onClick={() => handleCopy(lvl.price, lvl.sigma)}
                      className="px-2 py-1 rounded-[4px] border border-[#0D0D0C]/15 bg-white hover:bg-[#0D0D0C] hover:text-white text-[#0D0D0C] transition duration-200 inline-flex items-center gap-1 text-[11px] font-mono cursor-pointer"
                      title={`Copy ${lvl.sigma} price (${lvl.price.toFixed(decimals)})`}
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3 h-3 text-[#3FB874]" />
                          <span className="text-[#3FB874] font-bold">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 opacity-60" />
                          <span className="hidden md:inline">Copy</span>
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 4. Expected Move & Multi-Day Volatility Projections */}
      <div className="p-3 sm:p-4 bg-[#F8F9FA] border-t border-[#0D0D0C]/12 grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 text-xs">
        {/* 1-Day Expected Move */}
        <div className="bg-white p-3 rounded-[6px] border border-[#0D0D0C]/10 shadow-2xs">
          <div className="flex items-center justify-between text-[#0D0D0C]/56 text-[11px] mb-1">
            <span className="font-medium font-sans">1-Day Expected Move (68.2%)</span>
            <span className="font-mono">1.0σ</span>
          </div>
          <div className="text-sm sm:text-base font-bold font-mono text-[#0D0D0C]">
            ±${stdDev.toFixed(decimals)}
          </div>
          <div className="text-[10.5px] font-mono text-[#0D0D0C]/56 mt-0.5">
            Range: ${sd1Lower.toFixed(decimals)} — ${sd1Upper.toFixed(decimals)}
          </div>
        </div>

        {/* 2-Day Volatility Expansion */}
        <div className="bg-white p-3 rounded-[6px] border border-[#0D0D0C]/10 shadow-2xs">
          <div className="flex items-center justify-between text-[#0D0D0C]/56 text-[11px] mb-1">
            <span className="font-medium font-sans">2-Day Volatility Target (95.4%)</span>
            <span className="font-mono">√2 · σ</span>
          </div>
          <div className="text-sm sm:text-base font-bold font-mono text-[#0D0D0C]">
            ±${move2Day.toFixed(decimals)}
          </div>
          <div className="text-[10.5px] font-mono text-[#0D0D0C]/56 mt-0.5">
            Range: ${(vwap - move2Day).toFixed(decimals)} — ${(vwap + move2Day).toFixed(decimals)}
          </div>
        </div>

        {/* Weekly 5-Day Benchmark */}
        <div className="bg-white p-3 rounded-[6px] border border-[#0D0D0C]/10 shadow-2xs">
          <div className="flex items-center justify-between text-[#0D0D0C]/56 text-[11px] mb-1">
            <span className="font-medium font-sans">Weekly Expected Range (5 Days)</span>
            <span className="font-mono">√5 · σ</span>
          </div>
          <div className="text-sm sm:text-base font-bold font-mono text-[#0D0D0C]">
            ±${moveWeekly.toFixed(decimals)}
          </div>
          <div className="text-[10.5px] font-mono text-[#0D0D0C]/56 mt-0.5">
            Range: ${(vwap - moveWeekly).toFixed(decimals)} — ${(vwap + moveWeekly).toFixed(decimals)}
          </div>
        </div>
      </div>
    </div>
  );
}
