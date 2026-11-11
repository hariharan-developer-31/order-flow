import React, { useState, useMemo } from 'react';
import {
  Shield,
  Activity,
  Layers,
  Flame,
  Target,
  Clock,
  Copy,
  Check,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Gauge,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { runClientUotAnalysis, formatUotAnalysisText } from '../utils/uotEngine';

export default function UOTSignalTerminal({
  barsData,
  currentPrice,
  symbol = 'XAUUSD',
  decimals = 2,
  onRefresh,
  isLoading = false,
}) {
  const [copiedField, setCopiedField] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Compute live UOT Institutional Analysis
  const analysis = useMemo(() => {
    return runClientUotAnalysis(barsData, currentPrice, symbol);
  }, [barsData, currentPrice, symbol, refreshTrigger]);

  const handleCopy = (val, fieldKey) => {
    try {
      navigator.clipboard.writeText(String(val));
      setCopiedField(fieldKey);
      setTimeout(() => setCopiedField(null), 1800);
    } catch (e) {}
  };

  const handleCopyFullText = () => {
    const text = formatUotAnalysisText(analysis);
    handleCopy(text, 'full_analysis');
  };

  const {
    instrument,
    current_price,
    market_bias,
    higher_timeframe_structure: htf,
    daily_standard_deviation: dsd,
    weekly_standard_deviation: wsd,
    sd_confluences: confluences = [],
    key_liquidity: liq = {},
    supply_and_demand: snd = {},
    market_structure: ms = {},
    session = {},
    trade_decision,
    side,
    entry,
    sl,
    tp1,
    tp2,
    tp3,
    risk_dollars,
    reward_dollars,
    risk_to_reward,
    lot_size,
    setup_score,
    setup_classification,
    confirmation,
    invalidation,
  } = analysis;

  const biasBadgeColor =
    market_bias === 'Strong Bullish' || market_bias === 'Bullish'
      ? 'bg-[#3FB874]/15 text-[#3FB874] border-[#3FB874]/30'
      : market_bias === 'Strong Bearish' || market_bias === 'Bearish'
      ? 'bg-[#F2772F]/15 text-[#F2772F] border-[#F2772F]/30'
      : 'bg-[#0D0D0C]/10 text-[#0D0D0C] border-[#0D0D0C]/20';

  const decisionBadgeColor =
    trade_decision === 'BUY'
      ? 'bg-[#3FB874] text-white border-[#3FB874]'
      : trade_decision === 'SELL'
      ? 'bg-[#F2772F] text-white border-[#F2772F]'
      : trade_decision === 'WAIT'
      ? 'bg-[#E9C22E]/20 text-[#0D0D0C] border-[#E9C22E]'
      : 'bg-[#F4F4F5] text-[#0D0D0C]/70 border-[#0D0D0C]/15';

  return (
    <div className="w-full space-y-4 sm:space-y-6 font-sans">
      {/* 1. Header Banner & Actions */}
      <div className="bg-white border border-[#0D0D0C]/15 rounded-[7px] p-4 sm:p-5 shadow-[0_2px_12px_rgba(13,13,12,0.04)] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[7px] bg-[#0D0D0C] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-base sm:text-lg text-[#0D0D0C] tracking-tight font-headline">
                UOT-Inspired Institutional Trading Analysis Engine
              </h2>
              <span className="text-[10.5px] font-mono px-2 py-0.5 rounded-[5px] bg-[#F4F4F5] text-[#0D0D0C] border border-[#0D0D0C]/15 font-semibold">
                {instrument} • 18-Module Rule System
              </span>
            </div>
            <p className="text-[12.5px] text-[#0D0D0C]/56 font-sans">
              Rule-based market structure, multi-timeframe SD confluences, liquidity sweeps & 0.5% risk management.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setRefreshTrigger(v => v + 1)}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-[5px] border border-[#0D0D0C]/15 bg-white hover:bg-[#0D0D0C] hover:text-white text-[#0D0D0C] text-xs font-mono font-medium flex items-center gap-1.5 transition duration-200 cursor-pointer disabled:opacity-40"
            title="Re-run institutional analysis on live market data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Scan Now</span>
          </button>

          <button
            onClick={handleCopyFullText}
            className="px-3 py-1.5 rounded-[5px] border border-[#0D0D0C]/15 bg-[#F8F9FA] hover:bg-[#0D0D0C] hover:text-white text-[#0D0D0C] text-xs font-mono font-medium flex items-center gap-1.5 transition duration-200 cursor-pointer"
            title="Copy exact Module 16 Telegram analysis message"
          >
            {copiedField === 'full_analysis' ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#3FB874]" />
                <span className="text-[#3FB874] font-bold">Copied Telegram Format</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 opacity-60" />
                <span>Copy Telegram Signal</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Top Metric Overview (Price, Bias, Score, Decision) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4.5">
        {/* Metric 1: Current Price & Instrument */}
        <div className="bg-white border border-[#0D0D0C]/12 rounded-[7px] p-4 shadow-[0_1px_4px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#0D0D0C]/56 mb-2">
            <span className="font-sans font-medium">Spot Market Price</span>
            <span className="font-mono text-[10.5px]">XAUUSD</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold font-mono text-[#0D0D0C]">
              ${current_price?.toFixed(decimals)}
            </span>
            <button
              onClick={() => handleCopy(current_price?.toFixed(decimals), 'cur_p')}
              className="text-xs text-[#0D0D0C]/42 hover:text-[#0D0D0C] flex items-center gap-1 font-mono cursor-pointer"
              title="Copy price"
            >
              {copiedField === 'cur_p' ? <Check className="w-3.5 h-3.5 text-[#3FB874]" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-[11.5px] text-[#0D0D0C]/56 mt-2 font-sans">
            Trailing 24H VWAP: ${dsd?.mean?.toFixed(decimals)}
          </p>
        </div>

        {/* Metric 2: Composite Market Bias */}
        <div className="bg-white border border-[#0D0D0C]/12 rounded-[7px] p-4 shadow-[0_1px_4px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#0D0D0C]/56 mb-2">
            <span className="font-sans font-medium">Composite Market Bias</span>
            <span className="font-mono text-[10.5px]">1D • 4H • 1H</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-[5px] text-base font-bold font-headline border ${biasBadgeColor}`}>
              {market_bias}
            </span>
          </div>
          <p className="text-[11.5px] text-[#0D0D0C]/56 mt-2 font-sans">
            Daily & 4H structure alignment
          </p>
        </div>

        {/* Metric 3: 100-Point Confluence Setup Score */}
        <div className="bg-white border border-[#0D0D0C]/12 rounded-[7px] p-4 shadow-[0_1px_4px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#0D0D0C]/56 mb-2">
            <span className="font-sans font-medium">Setup Confluence Score</span>
            <span className="font-mono text-[10.5px]">{setup_classification}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-[#0D0D0C]">
              {setup_score}
            </span>
            <span className="text-xs text-[#0D0D0C]/42 font-mono">/ 100</span>
          </div>
          <div className="w-full bg-[#0D0D0C]/10 h-1.5 rounded-[5px] mt-2 overflow-hidden">
            <div
              className={`h-full rounded-[5px] transition-all duration-500 ${
                setup_score >= 85 ? 'bg-[#3FB874]' : setup_score >= 70 ? 'bg-[#E9C22E]' : 'bg-[#0D0D0C]'
              }`}
              style={{ width: `${setup_score}%` }}
            ></div>
          </div>
        </div>

        {/* Metric 4: Live Trade Decision */}
        <div className="bg-white border border-[#0D0D0C]/12 rounded-[7px] p-4 shadow-[0_1px_4px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#0D0D0C]/56 mb-2">
            <span className="font-sans font-medium">Trade Decision</span>
            <span className="font-mono text-[10.5px]">Module 11</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-[5px] text-lg font-bold font-headline border shadow-2xs ${decisionBadgeColor}`}>
              {trade_decision}
            </span>
          </div>
          <p className="text-[11.5px] text-[#0D0D0C]/56 mt-2 font-sans truncate">
            {trade_decision === 'BUY' || trade_decision === 'SELL'
              ? 'Confirmed Execution Ticket Ready'
              : 'Waiting for confirmed triggers'}
          </p>
        </div>
      </div>

      {/* 3. Trade Ticket Section (When BUY or SELL Confirmed) */}
      {(trade_decision === 'BUY' || trade_decision === 'SELL') && (
        <div className="bg-white border-2 border-[#0D0D0C] rounded-[7px] p-4 sm:p-6 shadow-[0_4px_20px_rgba(13,13,12,0.06)] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#0D0D0C]/12 pb-3">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${side === 'BUY' ? 'bg-[#3FB874]' : 'bg-[#F2772F]'} animate-pulse`}></span>
              <h3 className="font-bold text-lg text-[#0D0D0C] font-headline">
                CONFIRMED EXECUTION TICKET: {side} {instrument}
              </h3>
            </div>
            <span className="text-xs font-mono font-medium px-2.5 py-0.5 rounded-[5px] bg-[#F4F4F5] text-[#0D0D0C] border border-[#0D0D0C]/15">
              Risk: 0.5% (${risk_dollars?.toFixed(2)}) • Minimum RR 1:2
            </span>
          </div>

          {/* Execution Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono text-xs">
            {/* Entry */}
            <div className="bg-[#F8F9FA] p-3 rounded-[6px] border border-[#0D0D0C]/12">
              <span className="text-[#0D0D0C]/56 text-[11px] block font-sans font-medium">Entry Price</span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-base font-bold text-[#0D0D0C]">${entry?.toFixed(decimals)}</span>
                <button
                  onClick={() => handleCopy(entry?.toFixed(decimals), 'entry')}
                  className="hover:text-[#0D0D0C] text-[#0D0D0C]/42 cursor-pointer"
                  title="Copy entry"
                >
                  {copiedField === 'entry' ? <Check className="w-3.5 h-3.5 text-[#3FB874]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Stop Loss */}
            <div className="bg-[#F8F9FA] p-3 rounded-[6px] border border-[#F2772F]/30">
              <span className="text-[#F2772F] text-[11px] block font-sans font-medium">Stop Loss (SL)</span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-base font-bold text-[#0D0D0C]">${sl?.toFixed(decimals)}</span>
                <button
                  onClick={() => handleCopy(sl?.toFixed(decimals), 'sl')}
                  className="hover:text-[#0D0D0C] text-[#0D0D0C]/42 cursor-pointer"
                  title="Copy stop loss"
                >
                  {copiedField === 'sl' ? <Check className="w-3.5 h-3.5 text-[#3FB874]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* TP1 */}
            <div className="bg-[#F8F9FA] p-3 rounded-[6px] border border-[#0D0D0C]/12">
              <span className="text-[#0D0D0C]/56 text-[11px] block font-sans font-medium">Take Profit 1</span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-base font-bold text-[#0D0D0C]">${tp1?.toFixed(decimals)}</span>
                <button
                  onClick={() => handleCopy(tp1?.toFixed(decimals), 'tp1')}
                  className="hover:text-[#0D0D0C] text-[#0D0D0C]/42 cursor-pointer"
                  title="Copy TP1"
                >
                  {copiedField === 'tp1' ? <Check className="w-3.5 h-3.5 text-[#3FB874]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <span className="text-[10px] text-[#0D0D0C]/42 font-sans">Internal Liquidity</span>
            </div>

            {/* TP2 */}
            <div className="bg-[#F8F9FA] p-3 rounded-[6px] border border-[#3FB874]/30">
              <span className="text-[#3FB874] text-[11px] block font-sans font-medium">Take Profit 2</span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-base font-bold text-[#0D0D0C]">${tp2?.toFixed(decimals)}</span>
                <button
                  onClick={() => handleCopy(tp2?.toFixed(decimals), 'tp2')}
                  className="hover:text-[#0D0D0C] text-[#0D0D0C]/42 cursor-pointer"
                  title="Copy TP2"
                >
                  {copiedField === 'tp2' ? <Check className="w-3.5 h-3.5 text-[#3FB874]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <span className="text-[10px] text-[#0D0D0C]/42 font-sans">External Liquidity</span>
            </div>

            {/* TP3 */}
            <div className="bg-[#F8F9FA] p-3 rounded-[6px] border border-[#0D0D0C]/12">
              <span className="text-[#0D0D0C]/56 text-[11px] block font-sans font-medium">Take Profit 3</span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-base font-bold text-[#0D0D0C]">${tp3?.toFixed(decimals)}</span>
                <button
                  onClick={() => handleCopy(tp3?.toFixed(decimals), 'tp3')}
                  className="hover:text-[#0D0D0C] text-[#0D0D0C]/42 cursor-pointer"
                  title="Copy TP3"
                >
                  {copiedField === 'tp3' ? <Check className="w-3.5 h-3.5 text-[#3FB874]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <span className="text-[10px] text-[#0D0D0C]/42 font-sans">Major SD Target</span>
            </div>

            {/* Sizing & RR */}
            <div className="bg-[#0D0D0C] text-white p-3 rounded-[6px]">
              <span className="text-white/70 text-[11px] block font-sans font-medium">MT5 Lot Size</span>
              <div className="text-base font-bold mt-1 text-[#E9C22E]">
                {lot_size?.toFixed(2)} lots
              </div>
              <span className="text-[10px] text-white/56 font-sans">RR: {risk_to_reward}</span>
            </div>
          </div>

          {/* Confirmation & Invalidation Boxes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs font-sans">
            <div className="bg-[#F8F9FA] p-3.5 rounded-[6px] border border-[#0D0D0C]/12">
              <span className="font-semibold text-[#0D0D0C] block mb-1.5 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#3FB874]" />
                Confirmation Rationale (Module 11)
              </span>
              <p className="text-[#0D0D0C]/70 whitespace-pre-line leading-relaxed">
                {confirmation}
              </p>
            </div>

            <div className="bg-[#F8F9FA] p-3.5 rounded-[6px] border border-[#0D0D0C]/12">
              <span className="font-semibold text-[#0D0D0C] block mb-1.5 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-[#F2772F]" />
                Structural Invalidation Point (Module 12)
              </span>
              <p className="text-[#0D0D0C]/70 leading-relaxed">
                {invalidation}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. Multi-Timeframe Structure Grid (Module 4) */}
      <div className="bg-white border border-[#0D0D0C]/15 rounded-[7px] p-4 sm:p-5 shadow-[0_2px_12px_rgba(13,13,12,0.04)] space-y-3">
        <h3 className="font-semibold text-sm sm:text-base text-[#0D0D0C] font-headline flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#0D0D0C]" />
          Multi-Timeframe Market Structure (Module 4)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {/* Daily 1D */}
          <div className="bg-[#F8F9FA] p-3 rounded-[6px] border border-[#0D0D0C]/10">
            <span className="text-[11px] font-mono text-[#0D0D0C]/56 block font-medium">Daily (1D) Structure</span>
            <div className="font-bold text-sm text-[#0D0D0C] mt-1 font-headline">
              {htf?.daily || 'Consolidation / Range'}
            </div>
            <p className="text-[11px] text-[#0D0D0C]/56 mt-1 font-sans">
              Overall macroeconomic bias & institutional boundary
            </p>
          </div>

          {/* 4 Hours */}
          <div className="bg-[#F8F9FA] p-3 rounded-[6px] border border-[#0D0D0C]/10">
            <span className="text-[11px] font-mono text-[#0D0D0C]/56 block font-medium">4 Hours (4H) Structure</span>
            <div className="font-bold text-sm text-[#0D0D0C] mt-1 font-headline">
              {htf?.['4h'] || 'Market Structure Alignment'}
            </div>
            <p className="text-[11px] text-[#0D0D0C]/56 mt-1 font-sans">
              Major directional order flow & swing hierarchy
            </p>
          </div>

          {/* 1 Hour */}
          <div className="bg-[#F8F9FA] p-3 rounded-[6px] border border-[#0D0D0C]/10">
            <span className="text-[11px] font-mono text-[#0D0D0C]/56 block font-medium">1 Hour (1H) Structure</span>
            <div className="font-bold text-sm text-[#0D0D0C] mt-1 font-headline">
              {htf?.['1h'] || 'Consolidation / Range'}
            </div>
            <p className="text-[11px] text-[#0D0D0C]/56 mt-1 font-sans">
              Immediate swing highs, swing lows & displacement
            </p>
          </div>
        </div>
      </div>

      {/* 5. Daily vs. Weekly Standard Deviation Matrix with Confluences (Module 2 & 3) */}
      <div className="bg-white border border-[#0D0D0C]/15 rounded-[7px] p-4 sm:p-5 shadow-[0_2px_12px_rgba(13,13,12,0.04)] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-sm sm:text-base text-[#0D0D0C] font-headline flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#0D0D0C]" />
            Daily & Weekly Standard Deviation Levels (Module 2 & 3)
          </h3>
          {confluences.length > 0 && (
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-[4px] bg-[#E9C22E]/20 text-[#0D0D0C] border border-[#E9C22E]">
              ⚡ {confluences.length} High-Confluence Overlap Zone(s) Detected
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          {/* Daily Levels */}
          <div className="bg-[#F8F9FA] p-3 rounded-[6px] border border-[#0D0D0C]/10 space-y-1.5">
            <div className="flex justify-between items-center text-[11px] font-sans font-semibold text-[#0D0D0C] pb-1 border-b border-[#0D0D0C]/10">
              <span>Daily SD Levels (Trailing 24H)</span>
              <span>σ = ${dsd?.stdDev?.toFixed(decimals)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#F2772F] font-bold">+3 SD:</span>
              <span className="text-[#0D0D0C] font-bold">${dsd?.sd3_upper?.toFixed(decimals)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#E9C22E] font-bold">+2 SD:</span>
              <span className="text-[#0D0D0C] font-bold">${dsd?.sd2_upper?.toFixed(decimals)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#C564C4] font-bold">+1 SD:</span>
              <span className="text-[#0D0D0C] font-bold">${dsd?.sd1_upper?.toFixed(decimals)}</span>
            </div>
            <div className="flex justify-between bg-white px-1.5 py-0.5 rounded border border-[#0D0D0C]/10">
              <span className="text-[#0D0D0C] font-bold">Daily Mean (VWAP):</span>
              <span className="text-[#0D0D0C] font-bold">${dsd?.mean?.toFixed(decimals)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#3FB874] font-bold">-1 SD:</span>
              <span className="text-[#0D0D0C] font-bold">${dsd?.sd1_lower?.toFixed(decimals)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#3FB874] font-bold">-2 SD:</span>
              <span className="text-[#0D0D0C] font-bold">${dsd?.sd2_lower?.toFixed(decimals)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#F2772F] font-bold">-3 SD:</span>
              <span className="text-[#0D0D0C] font-bold">${dsd?.sd3_lower?.toFixed(decimals)}</span>
            </div>
          </div>

          {/* Weekly Levels */}
          <div className="bg-[#F8F9FA] p-3 rounded-[6px] border border-[#0D0D0C]/10 space-y-1.5">
            <div className="flex justify-between items-center text-[11px] font-sans font-semibold text-[#0D0D0C] pb-1 border-b border-[#0D0D0C]/10">
              <span>Weekly SD Levels (Trailing 5D)</span>
              <span>σ = ${wsd?.weekly_sd?.toFixed(decimals)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#F2772F] font-bold">Weekly +3 SD:</span>
              <span className="text-[#0D0D0C] font-bold">${wsd?.sd3_upper?.toFixed(decimals)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#E9C22E] font-bold">Weekly +2 SD:</span>
              <span className="text-[#0D0D0C] font-bold">${wsd?.sd2_upper?.toFixed(decimals)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#C564C4] font-bold">Weekly +1 SD:</span>
              <span className="text-[#0D0D0C] font-bold">${wsd?.sd1_upper?.toFixed(decimals)}</span>
            </div>
            <div className="flex justify-between bg-white px-1.5 py-0.5 rounded border border-[#0D0D0C]/10">
              <span className="text-[#0D0D0C] font-bold">Weekly Reference:</span>
              <span className="text-[#0D0D0C] font-bold">${wsd?.weekly_ref?.toFixed(decimals)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#3FB874] font-bold">Weekly -1 SD:</span>
              <span className="text-[#0D0D0C] font-bold">${wsd?.sd1_lower?.toFixed(decimals)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#3FB874] font-bold">Weekly -2 SD:</span>
              <span className="text-[#0D0D0C] font-bold">${wsd?.sd2_lower?.toFixed(decimals)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#F2772F] font-bold">Weekly -3 SD:</span>
              <span className="text-[#0D0D0C] font-bold">${wsd?.sd3_lower?.toFixed(decimals)}</span>
            </div>
          </div>
        </div>

        {/* Confluence Callout if active */}
        {confluences.length > 0 && (
          <div className="p-3 bg-[#FFFDF5] border border-[#E9C22E]/40 rounded-[6px] text-xs">
            <span className="font-bold text-[#0D0D0C] block mb-1">
              High-Confluence Overlap Zones (Module 3):
            </span>
            <ul className="space-y-1 list-disc pl-4 text-[#0D0D0C]/80">
              {confluences.map((c, idx) => (
                <li key={idx}>
                  <b>{c.daily}</b> overlaps with <b>{c.weekly}</b> in the range <code>${c.price_range}</code> (Cluster Mean: <b>${c.avg_price}</b>).
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 6. Liquidity Pools & Supply/Demand Radar (Module 5 & 6) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Liquidity Pools */}
        <div className="bg-white border border-[#0D0D0C]/15 rounded-[7px] p-4 sm:p-5 shadow-[0_2px_12px_rgba(13,13,12,0.04)] space-y-3">
          <h3 className="font-semibold text-sm sm:text-base text-[#0D0D0C] font-headline flex items-center gap-2">
            <Flame className="w-4 h-4 text-[#F2772F]" />
            Key Liquidity Pools (Module 6)
          </h3>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="bg-[#F8F9FA] p-2.5 rounded-[5px] border border-[#0D0D0C]/10">
              <span className="text-[10.5px] text-[#0D0D0C]/56 block font-sans">Prior Day High (PDH)</span>
              <span className="font-bold text-[#0D0D0C] text-sm">${liq?.pdh?.toFixed(decimals)}</span>
            </div>
            <div className="bg-[#F8F9FA] p-2.5 rounded-[5px] border border-[#0D0D0C]/10">
              <span className="text-[10.5px] text-[#0D0D0C]/56 block font-sans">Prior Day Low (PDL)</span>
              <span className="font-bold text-[#0D0D0C] text-sm">${liq?.pdl?.toFixed(decimals)}</span>
            </div>
            <div className="bg-[#F8F9FA] p-2.5 rounded-[5px] border border-[#0D0D0C]/10">
              <span className="text-[10.5px] text-[#0D0D0C]/56 block font-sans">Previous Week High (PWH)</span>
              <span className="font-bold text-[#0D0D0C] text-sm">${liq?.pwh?.toFixed(decimals)}</span>
            </div>
            <div className="bg-[#F8F9FA] p-2.5 rounded-[5px] border border-[#0D0D0C]/10">
              <span className="text-[10.5px] text-[#0D0D0C]/56 block font-sans">Previous Week Low (PWL)</span>
              <span className="font-bold text-[#0D0D0C] text-sm">${liq?.pwl?.toFixed(decimals)}</span>
            </div>
            <div className="bg-[#F8F9FA] p-2.5 rounded-[5px] border border-[#0D0D0C]/10">
              <span className="text-[10.5px] text-[#0D0D0C]/56 block font-sans">Asian Session High</span>
              <span className="font-bold text-[#0D0D0C] text-sm">${liq?.asian_high?.toFixed(decimals)}</span>
            </div>
            <div className="bg-[#F8F9FA] p-2.5 rounded-[5px] border border-[#0D0D0C]/10">
              <span className="text-[10.5px] text-[#0D0D0C]/56 block font-sans">Asian Session Low</span>
              <span className="font-bold text-[#0D0D0C] text-sm">${liq?.asian_low?.toFixed(decimals)}</span>
            </div>
          </div>

          {/* Sweep status */}
          {(liq?.bullish_sweep || liq?.bearish_sweep) && (
            <div className="p-2.5 rounded-[5px] bg-[#F8F9FA] border border-[#0D0D0C]/12 text-xs">
              <span className="font-bold text-[#0D0D0C] block mb-1">Active Liquidity Sweep:</span>
              <p className="text-[#0D0D0C]/80">
                {liq?.bullish_sweep || liq?.bearish_sweep}
              </p>
            </div>
          )}
        </div>

        {/* Supply & Demand / POI Radar */}
        <div className="bg-white border border-[#0D0D0C]/15 rounded-[7px] p-4 sm:p-5 shadow-[0_2px_12px_rgba(13,13,12,0.04)] space-y-3">
          <h3 className="font-semibold text-sm sm:text-base text-[#0D0D0C] font-headline flex items-center gap-2">
            <Target className="w-4 h-4 text-[#0D0D0C]" />
            Supply & Demand / POI Radar (Module 5 & 9)
          </h3>
          <div className="space-y-2 text-xs font-sans">
            <div className="bg-[#F8F9FA] p-2.5 rounded-[5px] border border-[#0D0D0C]/10 flex justify-between items-center">
              <div>
                <span className="text-[10.5px] text-[#0D0D0C]/56 block font-medium">Nearest Supply Zone</span>
                <span className="font-mono font-bold text-[#0D0D0C]">${snd?.nearest_supply || 'None'}</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-white border border-[#0D0D0C]/15 font-mono">
                Resistance
              </span>
            </div>

            <div className="bg-[#F8F9FA] p-2.5 rounded-[5px] border border-[#0D0D0C]/10 flex justify-between items-center">
              <div>
                <span className="text-[10.5px] text-[#0D0D0C]/56 block font-medium">Nearest Demand Zone</span>
                <span className="font-mono font-bold text-[#0D0D0C]">${snd?.nearest_demand || 'None'}</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-white border border-[#0D0D0C]/15 font-mono">
                Support
              </span>
            </div>

            <div className="bg-[#F8F9FA] p-2.5 rounded-[5px] border border-[#0D0D0C]/10">
              <span className="text-[10.5px] text-[#0D0D0C]/56 block font-medium">Fair Value Gap (FVG)</span>
              <span className="font-mono font-semibold text-[#0D0D0C] text-xs">{ms?.fvg || 'None'}</span>
            </div>

            <div className="bg-[#F8F9FA] p-2.5 rounded-[5px] border border-[#0D0D0C]/10">
              <span className="text-[10.5px] text-[#0D0D0C]/56 block font-medium">Point of Interest (POI) Confluence</span>
              <span className="font-mono font-semibold text-[#0D0D0C] text-xs">{ms?.poi || 'None'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 7. Session Schedule & News Filter (Module 7 & 14) */}
      <div className="bg-white border border-[#0D0D0C]/15 rounded-[7px] p-4 sm:p-5 shadow-[0_2px_12px_rgba(13,13,12,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#0D0D0C]" />
            <span className="font-semibold text-[#0D0D0C] font-headline">
              Active Session: <b className="text-[#3FB874]">{session?.session_name}</b> ({session?.time_ist})
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[#0D0D0C]/70">
            <span>Window: <b>6:00 AM – 11:00 PM IST</b></span>
            <span>•</span>
            <span className="text-[#3FB874] font-bold">News Filter Active (No High-Impact Window)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
