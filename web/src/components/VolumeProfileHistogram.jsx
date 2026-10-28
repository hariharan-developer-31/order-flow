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
      <div className="bg-[#FBF6EF] border border-[#0D0D0C]/15 rounded-[7px] p-6 text-center text-[#0D0D0C]/42 shadow-xs">
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
    <div className="bg-[#FBF6EF] border border-[#0D0D0C]/15 rounded-[7px] shadow-[0_2px_12px_rgba(13,13,12,0.04)] overflow-hidden flex flex-col h-full font-sans">
      {/* Top Header */}
      <div className="px-4 py-3 border-b border-[#0D0D0C]/12 flex items-center justify-between bg-[#FBF6EF]">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[#0D0D0C]" />
          <h3 className="font-semibold text-[#0D0D0C] text-xs sm:text-sm tracking-tight font-headline">
            Horizontal Volume Profile (Active Auction)
          </h3>
        </div>
        <span className="text-[10.5px] font-mono font-medium text-[#0D0D0C]/70 bg-[#F4EFE6] px-2 py-0.5 rounded-[5px] border border-[#0D0D0C]/12">
          Total: {Math.round(totalVol).toLocaleString()} lots
        </span>
      </div>

      {/* Legend */}
      <div className="px-4 py-2 bg-[#F4EFE6] border-b border-[#0D0D0C]/12 flex items-center justify-between text-[11px] font-medium">
        <span className="text-[#0D0D0C] flex items-center gap-1.5 font-mono">
          <span className="w-2.5 h-2.5 rounded-[3px] bg-[#E9C22E] border border-[#0D0D0C]/20"></span> POC ({pocPrice ? pocPrice.toFixed(decimals) : '---'})
        </span>
        <span className="text-[#0D0D0C] flex items-center gap-1.5 font-mono">
          <span className="w-2.5 h-2.5 rounded-[3px] bg-[#C564C4] border border-[#0D0D0C]/20"></span> 70% Value Area
        </span>
      </div>

      {/* Price Ladder with Horizontal Bars */}
      <div className="p-3 overflow-y-auto space-y-1 flex-1 max-h-[460px]">
        {sortedProfile.map((bin, idx) => {
          const widthPct = Math.max(5, Math.min(100, (bin.volume / maxVol) * 100));
          const isPOC = bin.is_poc;
          const inVA = bin.in_va;

          let barColor = 'bg-[#0D0D0C]/15';
          let textColor = 'text-[#0D0D0C]/70';
          let borderColor = 'border-transparent';

          if (isPOC) {
            barColor = 'bg-[#0D0D0C] text-[#FBF6EF] font-bold';
            textColor = 'text-[#0D0D0C] font-bold';
            borderColor = 'border-[#0D0D0C]/35 ring-1 ring-[#0D0D0C]/20';
          } else if (inVA) {
            barColor = 'bg-[#ECD6E2] text-[#0D0D0C]';
            textColor = 'text-[#0D0D0C] font-medium';
          }

          return (
            <div
              key={idx}
              className={`flex items-center text-[10px] font-mono rounded-[5px] px-2 py-1 border ${borderColor} hover:bg-[#F4EFE6] transition`}
            >
              {/* Price Label */}
              <div className={`w-16 font-semibold ${textColor}`}>
                {bin.price?.toFixed(decimals)}
              </div>

              {/* Horizontal Volume Bar */}
              <div className="flex-1 bg-[#0D0D0C]/8 h-3.5 rounded-[4px] overflow-hidden mx-2 relative">
                <div
                  className={`h-full rounded-[4px] transition-all duration-300 ${barColor}`}
                  style={{ width: `${widthPct}%` }}
                ></div>
                {isPOC && (
                  <span className="absolute inset-0 flex items-center justify-center text-[8.5px] font-black text-[#FBF6EF] uppercase tracking-wider">
                    ★ POC NODE
                  </span>
                )}
              </div>

              {/* Volume Figure */}
              <div className="w-14 text-right text-[#0D0D0C]/56 font-medium">
                {Math.round(bin.volume).toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
