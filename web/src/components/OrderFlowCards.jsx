import React from 'react';
import { Target, Layers, ArrowUpRight, ArrowDownRight, ShieldCheck, Flame, Shield } from 'lucide-react';

export default function OrderFlowCards({ symbol, orderFlowData, livePrice, activeVP, signalsData }) {
  const of = orderFlowData?.find((o) => o.symbol === symbol);
  const dec = symbol === 'XAUUSD' ? 2 : 5;

  const todayPnl = signalsData?.today_pnl || '+0.00%';
  const tradesCount = signalsData?.trades_count ?? 0;

  // Synchronized directly with the chart auction so the above data box and chart match 100% perfectly
  const poc = activeVP?.pocPrice ?? of?.pPOC ?? 0;
  const vah = activeVP?.vahPrice ?? of?.pVAH ?? 0;
  const val = activeVP?.valPrice ?? of?.pVAL ?? 0;
  const pHigh = activeVP?.pdh ?? of?.pHigh ?? 0;
  const pLow = activeVP?.pdl ?? of?.pLow ?? 0;

  // Calculate distance to POC
  const distPOC = livePrice && poc ? livePrice - poc : 0;
  const distPOCFormatted = (distPOC >= 0 ? '+' : '') + distPOC.toFixed(dec);

  // Calculate percentage inside Value Area
  let vaProgress = 50;
  if (vah > val && livePrice) {
    vaProgress = Math.max(0, Math.min(100, ((livePrice - val) / (vah - val)) * 100));
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Point of Control Card (White Theme) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-md hover:border-amber-300 transition-all group">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 font-sans">
            <Target className="w-4 h-4 text-amber-500" />
            Point of Control (POC)
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-mono">
            Institutional Magnet
          </span>
        </div>
        <div className="flex items-baseline justify-between mt-1">
          <span className="text-2xl font-black font-mono text-slate-900 tracking-tight">
            {poc ? poc.toFixed(dec) : '---'}
          </span>
          <span
            className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${
              distPOC >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}
          >
            {poc ? `${distPOCFormatted}` : ''}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 mt-2 font-medium">
          Highest transacted volume node of active auction.
        </p>
      </div>

      {/* 2. Value Area Range (70% Volume) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-md hover:border-blue-300 transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 font-sans">
            <Layers className="w-4 h-4 text-blue-600" />
            70% Value Area (VA)
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-mono">
            Balance Zone
          </span>
        </div>
        <div className="flex items-baseline justify-between font-mono mt-1">
          <div>
            <span className="text-[10px] text-slate-400 block font-sans">VAL (Support)</span>
            <span className="text-sm font-extrabold text-slate-800">
              {val ? val.toFixed(dec) : '---'}
            </span>
          </div>
          <span className="text-slate-300 font-bold px-1">→</span>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block font-sans">VAH (Resistance)</span>
            <span className="text-sm font-extrabold text-slate-800">
              {vah ? vah.toFixed(dec) : '---'}
            </span>
          </div>
        </div>
        {/* Modern VA Gradient Progress Bar */}
        <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden border border-slate-200">
          <div
            className="bg-gradient-to-r from-blue-400 to-blue-600 h-full rounded-full transition-all duration-500"
            style={{ width: `${vaProgress}%` }}
          ></div>
        </div>
      </div>

      {/* 3. Prior Day Liquidity Range (PDH / PDL) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-md hover:border-purple-300 transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 font-sans">
            <Flame className="w-4 h-4 text-purple-600" />
            Liquidity Extremes (PDH/PDL)
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-mono">
            Stop Hunt Pools
          </span>
        </div>
        <div className="flex items-baseline justify-between font-mono mt-1">
          <div>
            <span className="text-[10px] text-slate-400 block font-sans">Prior Low (PDL)</span>
            <span className="text-sm font-extrabold text-rose-600">
              {pLow ? pLow.toFixed(dec) : '---'}
            </span>
          </div>
          <span className="text-slate-300 font-bold px-1">→</span>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block font-sans">Prior High (PDH)</span>
            <span className="text-sm font-extrabold text-emerald-600">
              {pHigh ? pHigh.toFixed(dec) : '---'}
            </span>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mt-2 font-medium">
          Rejection wicks beyond PDH/PDL trigger A+ Liquidity Sweeps.
        </p>
      </div>

      {/* 4. Capital Guard & Daily Pacing Card (Percentage Mode, White Theme) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-md hover:border-emerald-300 transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 font-sans">
            <Shield className="w-4 h-4 text-emerald-600" />
            Capital Guard & Risk
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
            Safe: -2.5% Limit
          </span>
        </div>
        <div className="flex items-center justify-between text-xs font-mono font-bold mt-1 gap-2">
          <div className="bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 flex-1">
            <span className="text-slate-400 text-[10px] block font-sans">Today's Net P&L</span>
            <span className={`text-sm font-black ${todayPnl.startsWith('+') ? 'text-emerald-700' : 'text-rose-600'}`}>
              {todayPnl}
            </span>
          </div>
          <div className="bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 flex-1 text-right">
            <span className="text-slate-400 text-[10px] block font-sans">Trades Pacing</span>
            <span className="text-slate-800 text-sm font-black">{tradesCount} / 3 Max</span>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mt-2 font-medium">
          Target: +2.0% - 3.0% • 70% scale-out at POC moves SL to Breakeven.
        </p>
      </div>
    </div>
  );
}
