import React from 'react';
import { Target, Layers, ArrowUpRight, ArrowDownRight, ShieldCheck, Flame } from 'lucide-react';

export default function OrderFlowCards({ symbol, orderFlowData, livePrice }) {
  const of = orderFlowData?.find((o) => o.symbol === symbol);
  const dec = symbol === 'XAUUSD' ? 2 : 5;

  const poc = of?.pPOC ?? 0;
  const vah = of?.pVAH ?? 0;
  const val = of?.pVAL ?? 0;
  const pHigh = of?.pHigh ?? 0;
  const pLow = of?.pLow ?? 0;

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
      {/* 1. Point of Control Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-amber-300 transition group">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Target className="w-4 h-4 text-amber-500" />
            Point of Control (POC)
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
            Institutional Magnet
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-black font-mono text-slate-900">
            {poc ? poc.toFixed(dec) : '---'}
          </span>
          <span
            className={`text-xs font-mono font-bold ${
              distPOC >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {poc ? `${distPOCFormatted}` : ''}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 mt-2">
          Highest transacted volume level of yesterday's auction.
        </p>
      </div>

      {/* 2. Value Area Range (70% Volume) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-blue-300 transition">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-blue-600" />
            70% Value Area (VA)
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            Balance Zone
          </span>
        </div>
        <div className="flex items-baseline justify-between font-mono">
          <div>
            <span className="text-[10px] text-slate-400 block font-sans">VAL</span>
            <span className="text-sm font-bold text-slate-800">
              {val ? val.toFixed(dec) : '---'}
            </span>
          </div>
          <span className="text-slate-300 font-light">—</span>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block font-sans">VAH</span>
            <span className="text-sm font-bold text-slate-800">
              {vah ? vah.toFixed(dec) : '---'}
            </span>
          </div>
        </div>
        {/* Progress Bar */}
        <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden border border-slate-200">
          <div
            className="bg-blue-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${vaProgress}%` }}
          ></div>
        </div>
      </div>

      {/* 3. Prior Day Liquidity Range */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-purple-300 transition">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-purple-600" />
            Liquidity Extremes (PDH/PDL)
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
            Stop Hunt Pools
          </span>
        </div>
        <div className="flex items-baseline justify-between font-mono">
          <div>
            <span className="text-[10px] text-slate-400 block font-sans">Prior Low (PDL)</span>
            <span className="text-sm font-bold text-rose-600">
              {pLow ? pLow.toFixed(dec) : '---'}
            </span>
          </div>
          <span className="text-slate-300 font-light">—</span>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block font-sans">Prior High (PDH)</span>
            <span className="text-sm font-bold text-emerald-600">
              {pHigh ? pHigh.toFixed(dec) : '---'}
            </span>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mt-2">
          Rejection wicks beyond these levels trigger A+ Liquidity Sweeps.
        </p>
      </div>

      {/* 4. Twin-Order Risk Model Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-emerald-300 transition">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Twin-Order Model
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            Risk: 1.0%
          </span>
        </div>
        <div className="flex items-center justify-between text-xs font-mono font-bold mt-1">
          <div className="bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
            <span className="text-slate-500 text-[10px] block">Order A (Banker)</span>
            <span className="text-emerald-700 text-sm">TP1: 1:1 RR</span>
          </div>
          <div className="bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
            <span className="text-slate-500 text-[10px] block">Order B (Target)</span>
            <span className="text-emerald-700 text-sm">TP2: 1:2 RR</span>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mt-2 font-medium">
          Once TP1 hits &rarr; Stop Loss moves to Breakeven (100% Risk-Free)!
        </p>
      </div>
    </div>
  );
}
