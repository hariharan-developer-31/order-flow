import React from 'react';
import { Target, Layers, Flame, Shield, Activity } from 'lucide-react';

export default function OrderFlowCards({
  symbol = 'XAUUSD',
  orderFlowData,
  livePrice,
  activeVP,
  dailySD,
  showStandardDeviation = false,
}) {
  const of = orderFlowData?.find((o) => o.symbol === symbol);
  const dec = symbol === 'XAUUSD' ? 2 : 5;

  const poc = activeVP?.pocPrice ?? of?.pPOC ?? 0;
  const vah = activeVP?.vahPrice ?? of?.pVAH ?? 0;
  const val = activeVP?.valPrice ?? of?.pVAL ?? 0;
  const pHigh = activeVP?.pdh ?? of?.pHigh ?? 0;
  const pLow = activeVP?.pdl ?? of?.pLow ?? 0;

  const distPOC = livePrice && poc ? livePrice - poc : 0;
  const distPOCFormatted = (distPOC >= 0 ? '+' : '') + distPOC.toFixed(dec);

  let vaProgress = 50;
  if (vah > val && livePrice) {
    vaProgress = Math.max(0, Math.min(100, ((livePrice - val) / (vah - val)) * 100));
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 font-sans">
      {/* 1. Point of Control (POC) */}
      <div className="bg-white border border-[#0D0D0C]/10 rounded-[6px] p-3 sm:p-3.5 flex flex-col justify-between hover:border-[#0D0D0C]/25 transition">
        <div className="flex items-center justify-between gap-1 mb-1">
          <span className="text-xs font-semibold text-[#0D0D0C]/70 flex items-center gap-1.5 uppercase tracking-wider font-mono">
            <Target className="w-3.5 h-3.5 text-[#E9C22E]" />
            POC
          </span>
          <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-[#F8F9FA] text-[#0D0D0C]/70 border border-[#0D0D0C]/08">
            {poc ? distPOCFormatted : '---'}
          </span>
        </div>
        <div className="flex items-baseline justify-between mt-1">
          <span className="text-xl sm:text-2xl font-bold font-mono text-[#0D0D0C] tracking-tight">
            {poc ? poc.toFixed(dec) : '---'}
          </span>
          <span className="text-[11px] font-mono text-[#0D0D0C]/50">Magnet</span>
        </div>
      </div>

      {/* 2. Value Area Range (70% VA) */}
      <div className="bg-white border border-[#0D0D0C]/10 rounded-[6px] p-3 sm:p-3.5 flex flex-col justify-between hover:border-[#0D0D0C]/25 transition">
        <div className="flex items-center justify-between gap-1 mb-1">
          <span className="text-xs font-semibold text-[#0D0D0C]/70 flex items-center gap-1.5 uppercase tracking-wider font-mono">
            <Layers className="w-3.5 h-3.5 text-[#C564C4]" />
            70% Value Area
          </span>
          <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-[#F8F9FA] text-[#0D0D0C]/70 border border-[#0D0D0C]/08">
            Balance
          </span>
        </div>
        <div className="flex items-baseline justify-between font-mono mt-1 text-xs sm:text-sm">
          <div>
            <span className="text-[9px] text-[#0D0D0C]/50 block font-sans">VAL</span>
            <span className="font-bold text-[#0D0D0C]">{val ? val.toFixed(dec) : '---'}</span>
          </div>
          <span className="text-[#0D0D0C]/25 font-light">→</span>
          <div className="text-right">
            <span className="text-[9px] text-[#0D0D0C]/50 block font-sans">VAH</span>
            <span className="font-bold text-[#0D0D0C]">{vah ? vah.toFixed(dec) : '---'}</span>
          </div>
        </div>
        <div className="w-full bg-[#0D0D0C]/08 h-1 rounded-full mt-2 overflow-hidden">
          <div
            className="bg-[#0D0D0C] h-full rounded-full transition-all duration-300"
            style={{ width: `${vaProgress}%` }}
          />
        </div>
      </div>

      {/* 3. Prior Day Range (PDL / PDH) */}
      <div className="bg-white border border-[#0D0D0C]/10 rounded-[6px] p-3 sm:p-3.5 flex flex-col justify-between hover:border-[#0D0D0C]/25 transition">
        <div className="flex items-center justify-between gap-1 mb-1">
          <span className="text-xs font-semibold text-[#0D0D0C]/70 flex items-center gap-1.5 uppercase tracking-wider font-mono">
            <Flame className="w-3.5 h-3.5 text-[#F2772F]" />
            Prior Day Range
          </span>
          <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-[#F8F9FA] text-[#0D0D0C]/70 border border-[#0D0D0C]/08">
            Liquidity
          </span>
        </div>
        <div className="flex items-baseline justify-between font-mono mt-1 text-xs sm:text-sm">
          <div>
            <span className="text-[9px] text-[#0D0D0C]/50 block font-sans">PDL</span>
            <span className="font-bold text-[#0D0D0C]">{pLow ? pLow.toFixed(dec) : '---'}</span>
          </div>
          <span className="text-[#0D0D0C]/25 font-light">→</span>
          <div className="text-right">
            <span className="text-[9px] text-[#0D0D0C]/50 block font-sans">PDH</span>
            <span className="font-bold text-[#0D0D0C]">{pHigh ? pHigh.toFixed(dec) : '---'}</span>
          </div>
        </div>
        <div className="w-full h-1 mt-2"></div>
      </div>

      {/* 4. Contextual Metric: Daily Std Dev (when ON) OR Capital Guard (when OFF) */}
      {showStandardDeviation && dailySD && dailySD.stdDev ? (
        <div className="bg-white border border-[#0D0D0C]/10 rounded-[6px] p-3 sm:p-3.5 flex flex-col justify-between hover:border-[#0D0D0C]/25 transition">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-xs font-semibold text-[#0D0D0C]/70 flex items-center gap-1.5 uppercase tracking-wider font-mono">
              <Activity className="w-3.5 h-3.5 text-[#3FB874]" />
              Daily Std Dev (σ)
            </span>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#F8F9FA] text-[#0D0D0C] border border-[#0D0D0C]/08">
              Z: {dailySD.zScore >= 0 ? `+${dailySD.zScore.toFixed(2)}` : dailySD.zScore.toFixed(2)}σ
            </span>
          </div>
          <div className="flex items-baseline justify-between font-mono mt-1 text-xs sm:text-sm">
            <div>
              <span className="text-[9px] text-[#0D0D0C]/50 block font-sans">-1.0σ</span>
              <span className="font-bold text-[#0D0D0C]">{dailySD.sd1Lower ? dailySD.sd1Lower.toFixed(dec) : '---'}</span>
            </div>
            <div className="text-center">
              <span className="text-[9px] text-[#0D0D0C]/50 block font-sans">Daily σ</span>
              <span className="font-bold text-[#0D0D0C]">±${dailySD.stdDev ? dailySD.stdDev.toFixed(dec) : '0.00'}</span>
            </div>
            <div className="text-right">
              <span className="text-[9px] text-[#0D0D0C]/50 block font-sans">+1.0σ</span>
              <span className="font-bold text-[#0D0D0C]">{dailySD.sd1Upper ? dailySD.sd1Upper.toFixed(dec) : '---'}</span>
            </div>
          </div>
          <div className="w-full h-1 mt-2"></div>
        </div>
      ) : (
        <div className="bg-white border border-[#0D0D0C]/10 rounded-[6px] p-3 sm:p-3.5 flex flex-col justify-between hover:border-[#0D0D0C]/25 transition">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-xs font-semibold text-[#0D0D0C]/70 flex items-center gap-1.5 uppercase tracking-wider font-mono">
              <Shield className="w-3.5 h-3.5 text-[#3FB874]" />
              Capital Guard
            </span>
            <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-[#F8F9FA] text-[#0D0D0C]/70 border border-[#0D0D0C]/08">
              Safe: -2.5%
            </span>
          </div>
          <div className="flex items-baseline justify-between font-mono mt-1 text-xs sm:text-sm">
            <div>
              <span className="text-[9px] text-[#0D0D0C]/50 block font-sans">Risk / Trade</span>
              <span className="font-bold text-[#0D0D0C]">0.5% - 1.0%</span>
            </div>
            <div className="text-right">
              <span className="text-[9px] text-[#0D0D0C]/50 block font-sans">Daily Target</span>
              <span className="font-bold text-[#3FB874]">+2.0% - 3.0%</span>
            </div>
          </div>
          <div className="w-full h-1 mt-2"></div>
        </div>
      )}
    </div>
  );
}
