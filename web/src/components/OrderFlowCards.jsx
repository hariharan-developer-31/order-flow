import React from 'react';
import { Target, Layers, Flame, Shield, Activity } from 'lucide-react';

export default function OrderFlowCards({ symbol, orderFlowData, livePrice, activeVP, dailySD, showStandardDeviation = false }) {
  const of = orderFlowData?.find((o) => o.symbol === symbol);
  const dec = symbol === 'XAUUSD' ? 2 : 5;

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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4.5 font-sans">
      {/* 1. Point of Control Card - Pure White */}
      <div className="bg-white border border-[#0D0D0C]/12 shadow-[0_1px_4px_rgba(0,0,0,0.03)] rounded-[7px] p-4 sm:p-5 relative overflow-hidden transition-all duration-500 hover:border-[#0D0D0C]/35 group flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2 relative z-10">
            <span className="text-[15px] sm:text-[16.5px] font-medium text-[#0D0D0C] tracking-tight flex items-center gap-1.5 font-headline">
              <span className="w-5 h-5 rounded-[5px] bg-[#E9C22E]/25 border border-[#0D0D0C]/12 flex items-center justify-center shrink-0 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)]">
                <Target className="w-3.5 h-3.5 text-[#0D0D0C]" />
              </span>
              Point of Control (POC)
            </span>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-[5px] bg-[#F8F9FA] text-[#0D0D0C] border border-[#0D0D0C]/12 font-mono shrink-0">
              Magnet Node
            </span>
          </div>

          <div className="flex items-baseline justify-between mt-2 relative z-10">
            <span className="text-3xl sm:text-4xl lg:text-[54px] font-semibold font-headline text-[#0D0D0C] tracking-[-0.03em] leading-none">
              {poc ? poc.toFixed(dec) : '---'}
            </span>
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-[5px] bg-[#F8F9FA] text-[#0D0D0C] border border-[#0D0D0C]/15 shrink-0">
              {poc ? distPOCFormatted : ''}
            </span>
          </div>
        </div>

        <p className="text-[12.5px] text-[#0D0D0C]/56 mt-3 font-sans relative z-10">
          Highest transacted volume node of active auction.
        </p>
      </div>

      {/* 2. Value Area Range - 70% Volume Area */}
      <div className="bg-white border border-[#0D0D0C]/12 shadow-[0_1px_4px_rgba(0,0,0,0.03)] rounded-[7px] p-4 sm:p-5 relative overflow-hidden transition-all duration-500 hover:border-[#0D0D0C]/35 group flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2 relative z-10">
            <span className="text-[15px] sm:text-[16.5px] font-medium text-[#0D0D0C] tracking-tight flex items-center gap-1.5 font-headline">
              <span className="w-5 h-5 rounded-[5px] bg-[#C564C4]/25 border border-[#0D0D0C]/12 flex items-center justify-center shrink-0 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)]">
                <Layers className="w-3.5 h-3.5 text-[#0D0D0C]" />
              </span>
              70% Value Area (VA)
            </span>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-[5px] bg-[#F8F9FA] text-[#0D0D0C] border border-[#0D0D0C]/12 font-mono shrink-0">
              Balance Zone
            </span>
          </div>

          <div className="flex items-baseline justify-between font-mono mt-2 relative z-10">
            <div>
              <span className="text-[10px] text-[#0D0D0C]/56 block font-sans font-medium">VAL (Support)</span>
              <span className="text-base sm:text-lg font-semibold text-[#0D0D0C]">
                {val ? val.toFixed(dec) : '---'}
              </span>
            </div>
            <span className="text-[#0D0D0C]/30 font-medium px-1">→</span>
            <div className="text-right">
              <span className="text-[10px] text-[#0D0D0C]/56 block font-sans font-medium">VAH (Resistance)</span>
              <span className="text-base sm:text-lg font-semibold text-[#0D0D0C]">
                {vah ? vah.toFixed(dec) : '---'}
              </span>
            </div>
          </div>
        </div>

        {/* VA Progress Bar */}
        <div className="w-full bg-[#0D0D0C]/10 h-1.5 rounded-[5px] mt-3 overflow-hidden relative z-10">
          <div
            className="bg-[#0D0D0C] h-full rounded-[5px] transition-all duration-500"
            style={{ width: `${vaProgress}%` }}
          ></div>
        </div>
      </div>

      {/* 3. Prior Day Liquidity Range (PDH / PDL) */}
      <div className="bg-white border border-[#0D0D0C]/12 shadow-[0_1px_4px_rgba(0,0,0,0.03)] rounded-[7px] p-4 sm:p-5 relative overflow-hidden transition-all duration-500 hover:border-[#0D0D0C]/35 group flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2 relative z-10">
            <span className="text-[15px] sm:text-[16.5px] font-medium text-[#0D0D0C] tracking-tight flex items-center gap-1.5 font-headline">
              <span className="w-5 h-5 rounded-[5px] bg-[#F2772F]/25 border border-[#0D0D0C]/12 flex items-center justify-center shrink-0 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)]">
                <Flame className="w-3.5 h-3.5 text-[#0D0D0C]" />
              </span>
              Liquidity Extremes (PDH/PDL)
            </span>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-[5px] bg-[#F8F9FA] text-[#0D0D0C] border border-[#0D0D0C]/12 font-mono shrink-0">
              Stop Pools
            </span>
          </div>

          <div className="flex items-baseline justify-between font-mono mt-2 relative z-10">
            <div>
              <span className="text-[10px] text-[#0D0D0C]/56 block font-sans font-medium">Prior Low (PDL)</span>
              <span className="text-base sm:text-lg font-semibold text-[#0D0D0C]">
                {pLow ? pLow.toFixed(dec) : '---'}
              </span>
            </div>
            <span className="text-[#0D0D0C]/30 font-medium px-1">→</span>
            <div className="text-right">
              <span className="text-[10px] text-[#0D0D0C]/56 block font-sans font-medium">Prior High (PDH)</span>
              <span className="text-base sm:text-lg font-semibold text-[#0D0D0C]">
                {pHigh ? pHigh.toFixed(dec) : '---'}
              </span>
            </div>
          </div>
        </div>

        <p className="text-[12.5px] text-[#0D0D0C]/56 mt-3 font-sans relative z-10">
          Rejection wicks beyond PDH/PDL trigger A+ Liquidity Sweeps.
        </p>
      </div>

      {/* 4. Daily Standard Deviation (σ) & Expected Move Card (Active when SD is ON) */}
      {showStandardDeviation && dailySD && dailySD.stdDev ? (
        <div className="bg-white border border-[#0D0D0C]/12 shadow-[0_1px_4px_rgba(0,0,0,0.03)] rounded-[7px] p-4 sm:p-5 relative overflow-hidden transition-all duration-500 hover:border-[#0D0D0C]/35 group flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2 relative z-10">
              <span className="text-[15px] sm:text-[16.5px] font-medium text-[#0D0D0C] tracking-tight flex items-center gap-1.5 font-headline">
                <span className="w-5 h-5 rounded-[5px] bg-[#3FB874]/25 border border-[#0D0D0C]/12 flex items-center justify-center shrink-0 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)]">
                  <Activity className="w-3.5 h-3.5 text-[#0D0D0C]" />
                </span>
                Daily Std Dev (σ)
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-[5px] bg-[#F8F9FA] text-[#0D0D0C] border border-[#0D0D0C]/12 font-mono shrink-0">
                Z: {dailySD.zScore >= 0 ? `+${dailySD.zScore.toFixed(2)}` : dailySD.zScore.toFixed(2)}σ
              </span>
            </div>

            <div className="flex items-baseline justify-between font-mono mt-2 relative z-10">
              <div>
                <span className="text-[10px] text-[#0D0D0C]/56 block font-sans font-medium">-1.0σ Expected</span>
                <span className="text-base sm:text-lg font-semibold text-[#0D0D0C]">
                  {dailySD.sd1Lower ? dailySD.sd1Lower.toFixed(dec) : '---'}
                </span>
              </div>
              <div className="text-center px-1">
                <span className="text-[10px] text-[#0D0D0C]/56 block font-sans font-medium">Daily σ Move</span>
                <span className="text-sm font-bold text-[#0D0D0C] bg-[#F8F9FA] px-1.5 py-0.5 rounded border border-[#0D0D0C]/10 inline-block">
                  ±${dailySD.stdDev ? dailySD.stdDev.toFixed(dec) : '0.00'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-[#0D0D0C]/56 block font-sans font-medium">+1.0σ Expected</span>
                <span className="text-base sm:text-lg font-semibold text-[#0D0D0C]">
                  {dailySD.sd1Upper ? dailySD.sd1Upper.toFixed(dec) : '---'}
                </span>
              </div>
            </div>
          </div>

          <p className="text-[12.5px] text-[#0D0D0C]/56 mt-3 font-sans relative z-10 truncate">
            {dailySD.regime} • 68.2% normal range.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-[#0D0D0C]/12 shadow-[0_1px_4px_rgba(0,0,0,0.03)] rounded-[7px] p-4 sm:p-5 relative overflow-hidden transition-all duration-500 hover:border-[#0D0D0C]/35 group flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2 relative z-10">
              <span className="text-[15px] sm:text-[16.5px] font-medium text-[#0D0D0C] tracking-tight flex items-center gap-1.5 font-headline">
                <span className="w-5 h-5 rounded-[5px] bg-[#3FB874]/25 border border-[#0D0D0C]/12 flex items-center justify-center shrink-0 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)]">
                  <Shield className="w-3.5 h-3.5 text-[#0D0D0C]" />
                </span>
                Capital Guard & Risk
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-[5px] bg-[#F8F9FA] text-[#0D0D0C] border border-[#0D0D0C]/12 font-mono shrink-0">
                Safe: -2.5%
              </span>
            </div>

            <div className="flex items-center justify-between text-xs font-mono font-medium mt-2 gap-2 relative z-10">
              <div className="bg-[#F8F9FA] px-2.5 py-1.5 rounded-[5px] border border-[#0D0D0C]/12 flex-1">
                <span className="text-[#0D0D0C]/56 text-[10px] block font-sans font-medium">Risk Per Trade</span>
                <span className="text-base font-bold font-headline text-[#0D0D0C]">0.5% - 1.0%</span>
              </div>
              <div className="bg-[#F8F9FA] px-2.5 py-1.5 rounded-[5px] border border-[#0D0D0C]/12 flex-1 text-right">
                <span className="text-[#0D0D0C]/56 text-[10px] block font-sans font-medium">Daily Target</span>
                <span className="text-[#3FB874] text-base font-bold font-headline">+2.0% - 3.0%</span>
              </div>
            </div>
          </div>

          <p className="text-[12.5px] text-[#0D0D0C]/56 mt-3 font-sans relative z-10">
            Target: +2.0% - 3.0% • 70% scale-out moves SL to Breakeven.
          </p>
        </div>
      )}
    </div>
  );
}
