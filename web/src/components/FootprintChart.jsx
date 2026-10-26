import React, { useState } from 'react';
import { Layers, ArrowUp, ArrowDown, Activity, Info } from 'lucide-react';

export default function FootprintChart({ symbol, footprintData, decimals = 2 }) {
  const [selectedBarIdx, setSelectedBarIdx] = useState(null);

  if (!footprintData || footprintData.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400">
        <Activity className="w-8 h-8 mx-auto mb-2 opacity-50 animate-pulse text-blue-500" />
        <p className="text-sm font-semibold">Loading footprint clusters...</p>
      </div>
    );
  }

  // Calculate Cumulative Volume Delta (CVD) max/min for scaling
  const cvdValues = footprintData.map((b) => b.cvd || 0);
  const minCvd = Math.min(...cvdValues, 0);
  const maxCvd = Math.max(...cvdValues, 1);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
      {/* Top Header */}
      <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-600" />
          <h3 className="font-extrabold text-slate-900 text-sm">
            Institutional Footprint Clusters (Bid × Ask Delta)
          </h3>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            {symbol} 1H
          </span>
        </div>

        {/* Imbalance Legend */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500 ring-1 ring-emerald-300"></span>
            <span className="text-slate-600 font-medium">Buy Imbalance (&ge;300%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-rose-500 ring-1 ring-rose-300"></span>
            <span className="text-slate-600 font-medium">Sell Imbalance (&ge;300%)</span>
          </div>
        </div>
      </div>

      {/* Horizontal Scrollable Footprint Matrix */}
      <div className="p-4 overflow-x-auto">
        <div className="flex items-start gap-3 min-w-max pb-2">
          {footprintData.map((bar, bIdx) => {
            const isBullish = bar.close >= bar.open;
            const delta = bar.delta || 0;
            const isDeltaPositive = delta >= 0;

            // Find candle POC (price level with max volume in this single candle)
            let candlePocPrice = null;
            let maxClusterVol = -1;
            (bar.clusters || []).forEach((c) => {
              const clusterTot = (c.bid || 0) + (c.ask || 0);
              if (clusterTot > maxClusterVol) {
                maxClusterVol = clusterTot;
                candlePocPrice = c.price;
              }
            });

            // Sort clusters descending by price (high to low)
            const sortedClusters = [...(bar.clusters || [])].sort((a, b) => b.price - a.price);

            return (
              <div
                key={bar.time || bIdx}
                className="w-56 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden hover:border-blue-400 hover:shadow-md transition flex flex-col"
              >
                {/* Candle Header */}
                <div
                  className={`p-2.5 border-b text-xs font-mono flex items-center justify-between ${
                    isBullish ? 'bg-emerald-50/80 border-emerald-200' : 'bg-rose-50/80 border-rose-200'
                  }`}
                >
                  <span className="font-bold text-slate-800">{bar.datetime}</span>
                  <span
                    className={`font-black flex items-center gap-0.5 ${
                      isDeltaPositive ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {isDeltaPositive ? (
                      <ArrowUp className="w-3 h-3" />
                    ) : (
                      <ArrowDown className="w-3 h-3" />
                    )}
                    {delta > 0 ? `+${delta.toFixed(0)}` : delta.toFixed(0)}
                  </span>
                </div>

                {/* OHLC Mini Summary */}
                <div className="px-2.5 py-1.5 bg-white border-b border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-500">
                  <span>O: {bar.open?.toFixed(decimals)}</span>
                  <span>C: {bar.close?.toFixed(decimals)}</span>
                  <span>Vol: {bar.volume ? Math.round(bar.volume).toLocaleString() : '---'}</span>
                </div>

                {/* Bid x Ask Cluster Ladder */}
                <div className="p-2 space-y-1 max-h-[340px] overflow-y-auto">
                  {sortedClusters.map((c, cIdx) => {
                    const isPOC = c.price === candlePocPrice;
                    const isBuyImb = c.imbalance === 'BUY';
                    const isSellImb = c.imbalance === 'SELL';

                    return (
                      <div
                        key={cIdx}
                        className={`flex items-center text-[10px] font-mono rounded px-1.5 py-0.5 border transition ${
                          isPOC
                            ? 'bg-amber-50 border-amber-300 font-bold'
                            : 'bg-white border-slate-150 hover:bg-slate-100/70'
                        }`}
                      >
                        {/* Bid Volume (Market Sellers) */}
                        <div
                          className={`flex-1 text-right pr-2 py-0.5 rounded-l ${
                            isSellImb
                              ? 'bg-rose-500 text-white font-black shadow-sm'
                              : 'text-rose-700 bg-rose-50/50'
                          }`}
                        >
                          {c.bid}
                        </div>

                        {/* Price Level (Center) */}
                        <div
                          className={`px-1.5 font-bold text-center text-[10px] ${
                            isPOC ? 'text-amber-800 font-extrabold' : 'text-slate-600'
                          }`}
                        >
                          {c.price?.toFixed(decimals)}
                        </div>

                        {/* Ask Volume (Market Buyers) */}
                        <div
                          className={`flex-1 text-left pl-2 py-0.5 rounded-r ${
                            isBuyImb
                              ? 'bg-emerald-500 text-white font-black shadow-sm'
                              : 'text-emerald-700 bg-emerald-50/50'
                          }`}
                        >
                          {c.ask}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Candle Delta Footer */}
                <div className="p-2 bg-white border-t border-slate-200 mt-auto flex items-center justify-between text-[10px] font-mono font-semibold">
                  <span className="text-slate-500">Net Delta:</span>
                  <span className={isDeltaPositive ? 'text-emerald-700' : 'text-rose-700'}>
                    {delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cumulative Volume Delta (CVD) Sparkline Footer */}
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-600" />
          <span className="font-bold text-slate-800">
            Cumulative Volume Delta (CVD):
          </span>
          <span
            className={`font-mono font-extrabold px-2 py-0.5 rounded ${
              (cvdValues[cvdValues.length - 1] || 0) >= 0
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-rose-100 text-rose-800'
            }`}
          >
            {(cvdValues[cvdValues.length - 1] || 0) > 0 ? '+' : ''}
            {(cvdValues[cvdValues.length - 1] || 0).toLocaleString()} contracts
          </span>
        </div>
        <p className="text-[11px] text-slate-500">
          Positive CVD = Aggressive buyer accumulation | Negative CVD = Aggressive seller distribution
        </p>
      </div>
    </div>
  );
}
