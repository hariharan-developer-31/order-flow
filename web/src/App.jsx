import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from './components/Header';
import OrderFlowCards from './components/OrderFlowCards';
import CandleChart from './components/CandleChart';
import StandardDeviationMatrix from './components/StandardDeviationMatrix';
import { calculateDynamicVolumeProfile } from './utils/volumeProfile';
import { calculateDailyStandardDeviation } from './utils/standardDeviation';
import {
  getLiveCandleBars,
  getLiveOrderFlow,
  getLiveFootprintClusters,
  getCachedBars,
  subscribeLiveMarketTicks,
} from './services/liveMarketService';
import {
  getFallbackBars,
  getFallbackOrderFlow,
  getFallbackFootprint,
} from './data/mockData';

const SYMBOLS = ['XAUUSD'];

export default function App() {
  const [activeSymbol, setActiveSymbol] = useState('XAUUSD');
  const [timeframe, setTimeframe] = useState('1h');
  const [showStandardDeviation, setShowStandardDeviation] = useState(false); // Default OFF per user rule
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  // Instant cache retrieval or realistic mocks
  const [barsData, setBarsData] = useState(() => {
    const cached = getCachedBars('XAUUSD', '1h');
    return cached && cached.length > 0 ? cached : getFallbackBars('XAUUSD', '1h');
  });

  const [currentPrice, setCurrentPrice] = useState(() => {
    return barsData && barsData.length > 0 ? barsData[barsData.length - 1].close : 4034.40;
  });

  const [orderFlowData, setOrderFlowData] = useState(() => getFallbackOrderFlow());
  const [footprintData, setFootprintData] = useState(() => {
    const initBars = getCachedBars('XAUUSD', '1h') || getFallbackBars('XAUUSD', '1h');
    return getLiveFootprintClusters(initBars, 'XAUUSD', '1h');
  });

  // Timeframe change with instant Cache sync
  const handleSelectTimeframe = useCallback((tf) => {
    if (tf !== timeframe) {
      setTimeframe(tf);
      const cached = getCachedBars(activeSymbol, tf);
      if (cached && cached.length > 0) {
        setBarsData(cached);
        setCurrentPrice(cached[cached.length - 1].close);
        setFootprintData(getLiveFootprintClusters(cached, activeSymbol, tf));
      } else {
        const fb = getFallbackBars(activeSymbol, tf);
        setBarsData(fb);
        setCurrentPrice(fb[fb.length - 1].close);
        setFootprintData(getLiveFootprintClusters(fb, activeSymbol, tf));
      }
    }
  }, [activeSymbol, timeframe]);

  // Unified background market fetcher
  const fetchAllData = useCallback(async () => {
    try {
      const live = await getLiveCandleBars(activeSymbol, timeframe, 120);
      if (live && live.bars && live.bars.length > 0) {
        setBarsData(live.bars);
        setCurrentPrice(live.livePrice);

        const fp = getLiveFootprintClusters(live.bars, activeSymbol, timeframe);
        if (fp && fp.length > 0) setFootprintData(fp);

        const of = await getLiveOrderFlow(SYMBOLS, { [activeSymbol]: live.bars }, { [activeSymbol]: live.livePrice });
        if (of && of.length > 0) setOrderFlowData(of);
      }
    } catch (err) {
      console.warn('[LIVE_API] Auto-reconnecting live stream:', err);
    }
  }, [activeSymbol, timeframe]);

  // High-Speed Live Market Tick Stream
  useEffect(() => {
    const unsub = subscribeLiveMarketTicks(activeSymbol, timeframe, (update) => {
      if (update.livePrice != null) {
        setCurrentPrice(update.livePrice);
      }

      if (update.lastBar) {
        const tick = update.lastBar;
        setBarsData((prev) => {
          if (!prev || prev.length === 0) return prev;
          const last = prev[prev.length - 1];

          if (tick.time === last.time) {
            const updated = {
              ...last,
              close: tick.close,
              high: Math.max(last.high, tick.high),
              low: Math.min(last.low, tick.low),
              volume: (last.volume || 100) + (tick.volume || 1),
            };
            return [...prev.slice(0, -1), updated];
          } else if (tick.time > last.time) {
            return [...prev.slice(1), tick];
          }
          return prev;
        });

        // Live footprint update
        setFootprintData((prev) => {
          if (!prev || prev.length === 0) return prev;
          const lastFp = prev[prev.length - 1];
          if (tick.time === lastFp.time) {
            const updatedClusters = [...lastFp.clusters];
            const pStep = 1.0;
            const targetPrice = Math.round(tick.close / pStep) * pStep;
            const cIdx = updatedClusters.findIndex((c) => Math.abs(c.price - targetPrice) < pStep / 2);
            const isAsk = tick.close >= (lastFp.close || tick.close);
            if (cIdx >= 0) {
              const cur = updatedClusters[cIdx];
              updatedClusters[cIdx] = {
                ...cur,
                ask: isAsk ? cur.ask + 1 : cur.ask,
                bid: !isAsk ? cur.bid + 1 : cur.bid,
                delta: cur.delta + (isAsk ? 1 : -1),
                total: cur.total + 1,
              };
            }
            return [...prev.slice(0, -1), { ...lastFp, close: tick.close, clusters: updatedClusters }];
          }
          return prev;
        });
      }
    });

    return () => unsub();
  }, [activeSymbol, timeframe]);

  // Background refresh interval
  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 3000);
    return () => clearInterval(interval);
  }, [fetchAllData]);

  // Register Progressive Web App (PWA) Service Worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((err) => console.info('[PWA] Service worker note:', err));
    }
  }, []);

  const decimals = activeSymbol === 'XAUUSD' ? 2 : 5;

  // Dynamic Volume Profile directly calculated from bars
  const activeVP = useMemo(() => {
    return calculateDynamicVolumeProfile(barsData, 55);
  }, [barsData]);

  // Daily Standard Deviation levels
  const dailySD = useMemo(() => {
    return calculateDailyStandardDeviation(barsData, currentPrice, activeSymbol);
  }, [barsData, currentPrice, activeSymbol]);

  return (
    <div className="min-h-screen bg-white text-[#0D0D0C] flex flex-col font-sans selection:bg-[#0D0D0C] selection:text-white w-full max-w-full overflow-x-hidden">
      {/* 1. Super Minimal Top Navigation */}
      <Header
        activeSymbol={activeSymbol}
        currentPrice={currentPrice}
        timeframe={timeframe}
        onSelectTimeframe={handleSelectTimeframe}
        showStandardDeviation={showStandardDeviation}
        onToggleStandardDeviation={() => setShowStandardDeviation((v) => !v)}
        isConnected={isConnected}
        isLoading={isLoading}
        onRefresh={fetchAllData}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((v) => !v)}
      />

      {/* 2. Main Minimal Workspace */}
      <main className="flex-1 max-w-full 2xl:max-w-[2100px] mx-auto px-2.5 sm:px-6 py-2.5 sm:py-3.5 w-full space-y-2.5 sm:space-y-3.5">
        {/* Minimal Metric Strip */}
        <OrderFlowCards
          symbol={activeSymbol}
          orderFlowData={orderFlowData}
          livePrice={currentPrice}
          activeVP={activeVP}
          dailySD={dailySD}
          showStandardDeviation={showStandardDeviation}
        />

        {/* Central High-Performance Chart (Candlestick + Footprint + In-Chart VP) */}
        <CandleChart
          symbol={activeSymbol}
          barsData={barsData}
          footprintData={footprintData}
          orderFlowData={orderFlowData}
          activeVP={activeVP}
          dailySD={dailySD}
          showStandardDeviation={showStandardDeviation}
          onToggleStandardDeviation={() => setShowStandardDeviation((v) => !v)}
          timeframe={timeframe}
          onSelectTimeframe={handleSelectTimeframe}
          decimals={decimals}
        />

        {/* Daily Standard Deviation Matrix (Conditional on SD Toggle) */}
        {showStandardDeviation && (
          <StandardDeviationMatrix
            dailySD={dailySD}
            currentPrice={currentPrice}
            symbol={activeSymbol}
            decimals={decimals}
          />
        )}
      </main>

      {/* 3. Minimal 1-Line Footer */}
      <footer className="bg-white border-t border-[#0D0D0C]/10 py-2.5 px-3 sm:px-6 text-[11px] font-mono text-[#0D0D0C]/45 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3FB874]"></span>
          <span className="font-semibold text-[#0D0D0C]">TRADING BOY</span>
          <span>•</span>
          <span>XAUUSD Live Auction</span>
        </div>
        <div>
          <span>Institutional Gold Terminal</span>
        </div>
      </footer>
    </div>
  );
}
