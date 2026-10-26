import React from 'react';
import { BarChart3, Target, Layers } from 'lucide-react';

export default function VolumeProfileHistogram({ symbol, orderFlowData, activeVP, decimals = 2 }) {
  const of = orderFlowData?.find((o) => o.symbol === symbol);

  // Synchronize 100% with the active chart Volume Profile
  const profile = (activeVP?.bins && activeVP.bins.length > 0)
    ? activeVP.bins.map((b) => ({
        price: b.price,
        volume: b.totalVol,
        is_poc: b.isPOC,
        in_va: b.inVA,
      }))
    : (of?.profile || []);

  const pocPrice = activeVP?.pocPrice ?? of?.pPOC ?? 0;

  if (!profile || profile.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-slate-400">
        <p className="text-xs font-semibold">Volume profile histogram loading...</p>
      </div>
    );
  }

  // Find max volume to calculate percentage bar width
  const maxVol = Math.max(...profile.map((p) => p.volume), 1);
  const totalVol = profile.reduce((sum, p) => sum + p.volume, 0);

  // Reverse so highest price is at the top (standard price axis)
  const sortedProfile = [...profile].reverse();

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full">
      {/* Top Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-amber-500" />
          <h3 className="font-extrabold text-slate-900 text-xs">
            Horizontal Volume Profile (Active Auction)
          </h3>
        </div>
        <span className="text-[10px] font-mono font-bold text-slate-500">
          Total: {Math.round(totalVol).toLocaleString()} lots
        </span>
      </div>

      {/* Legend */}
      <div className="px-4 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[10px] font-semibold">
        <span className="text-amber-800 flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-amber-500"></span> POC ({pocPrice ? pocPrice.toFixed(decimals) : '---'})
        </span>
        <span className="text-blue-700 flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-blue-400"></span> 70% Value Area
        </span>
      </div>

      {/* Price Ladder with Horizontal Bars */}
      <div className="p-3 overflow-y-auto space-y-1 flex-1 max-h-[440px]">
        {sortedProfile.map((bin, idx) => {
          const widthPct = Math.max(4, Math.min(100, (bin.volume / maxVol) * 100));
          const isPOC = bin.is_poc;
          const inVA = bin.in_va;

          let barColor = 'bg-slate-200';
          let textColor = 'text-slate-600';
          let borderColor = 'border-transparent';

          if (isPOC) {
            barColor = 'bg-amber-500 text-white font-bold';
            textColor = 'text-amber-900 font-black';
            borderColor = 'border-amber-300 ring-1 ring-amber-300';
          } else if (inVA) {
            barColor = 'bg-blue-200 text-blue-900';
            textColor = 'text-blue-900 font-semibold';
          }

          return (
            <div
              key={idx}
              className={`flex items-center text-[10px] font-mono rounded px-1.5 py-0.5 border ${borderColor} hover:bg-slate-50 transition`}
            >
              {/* Price Label */}
              <div className={`w-16 font-bold ${textColor}`}>
                {bin.price?.toFixed(decimals)}
              </div>

              {/* Horizontal Volume Bar */}
              <div className="flex-1 bg-slate-100 h-4 rounded overflow-hidden mx-2 relative">
                <div
                  className={`h-full rounded transition-all duration-300 ${barColor}`}
                  style={{ width: `${widthPct}%` }}
                ></div>
                {isPOC && (
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-amber-950 uppercase tracking-wider">
                    ★ POC NODE
                  </span>
                )}
              </div>

              {/* Volume Figure */}
              <div className="w-14 text-right text-slate-500 font-medium">
                {Math.round(bin.volume).toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
