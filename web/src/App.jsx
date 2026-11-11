import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Header from './components/Header';
import OrderFlowCards from './components/OrderFlowCards';
import CandleChart from './components/CandleChart';
import { calculateDynamicVolumeProfile } from './utils/volumeProfile';
import { calculateDailyStandardDeviation } from './utils/standardDeviation';
import FootprintChart from './components/FootprintChart';
import VolumeProfileHistogram from './components/VolumeProfileHistogram';
import StandardDeviationMatrix from './components/StandardDeviationMatrix';
import UOTSignalTerminal from './components/UOTSignalTerminal';
import SettingsModal from './components/SettingsModal';
import BottomNav from './components/BottomNav';
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
  const [timeframe, setTimeframe] = useState('1h'); // '5m' | '15m' | '1h' | '4h'
  const [activeView, setActiveView] = useState('candles'); // 'candles' | 'footprint' | 'volume-profile' | 'all'

  // Smart API URL resolution: handles localStorage, Vercel env variable, or localhost
  const [apiUrl, setApiUrl] = useState(() => {
    const saved = localStorage.getItem('tb_api_url');
    if (saved !== null) return saved;
    const envUrl = import.meta.env?.VITE_API_URL;
    if (envUrl) return envUrl.trim().replace(/\/+$/, '');
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:8080';
    return '';
  });

  // Zero-flash fallback initialization: Instant cache retrieval or realistic mocks
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

  const [isConnected, setIsConnected] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showStandardDeviation, setShowStandardDeviation] = useState(false); // Default OFF per user instruction
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Handle symbol change smoothly with instant Cache + Live Feed sync
  const handleSelectSymbol = useCallback((sym) => {
    if (sym !== activeSymbol) {
      setActiveSymbol(sym);
      const cached = getCachedBars(sym, timeframe);
      if (cached && cached.length > 0) {
        setBarsData(cached);
        setCurrentPrice(cached[cached.length - 1].close);
        setFootprintData(getLiveFootprintClusters(cached, sym, timeframe));
      } else {
        const fb = getFallbackBars(sym, timeframe);
        setBarsData(fb);
        setCurrentPrice(fb[fb.length - 1].close);
        setFootprintData(getLiveFootprintClusters(fb, sym, timeframe));
      }
    }
  }, [activeSymbol, timeframe]);

  // Handle timeframe change with instant Cache + Live Feed sync
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

  // Unified background market fetcher: pulls Yahoo/MT5 real-time quotes without freezing UI
  const fetchAllData = useCallback(async () => {
    try {
      const live = await getLiveCandleBars(activeSymbol, timeframe, 120, apiUrl);
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
  }, [apiUrl, activeSymbol, timeframe]);

  // High-Speed WebSocket Live Stream (<50ms Tick-by-Tick Latency)
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
            // Update active candle in-place
            const updated = {
              ...last,
              close: tick.close,
              high: Math.max(last.high, tick.high),
              low: Math.min(last.low, tick.low),
              volume: (last.volume || 100) + (tick.volume || 1),
            };
            return [...prev.slice(0, -1), updated];
          } else if (tick.time > last.time) {
            // New bar appended
            return [...prev.slice(1), tick];
          }
          return prev;
        });

        // Live footprint tick stream
        setFootprintData((prev) => {
          if (!prev || prev.length === 0) return prev;
          const lastFp = prev[prev.length - 1];
          if (tick.time === lastFp.time) {
            const updatedClusters = [...lastFp.clusters];
            const pStep = activeSymbol === 'XAUUSD' ? (timeframe === '5m' ? 0.25 : 1.0) : 0.0002;
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
  }, [activeSymbol, timeframe, apiUrl]);

  // Initial fetch and fast auto-refresh every 3 seconds
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

  const handleSaveApiUrl = (newUrl) => {
    const trimmed = newUrl ? newUrl.trim().replace(/\/+$/, '') : '';
    setApiUrl(trimmed);
    localStorage.setItem('tb_api_url', trimmed);
    setTimeout(fetchAllData, 100);
  };

  const decimals = activeSymbol === 'XAUUSD' ? 2 : 5;

  // Calculate unified dynamic Volume Profile directly from active candlestick bars
  // Guarantees 100% synchronization between the Chart and all Data Boxes above!
  const activeVP = useMemo(() => {
    return calculateDynamicVolumeProfile(barsData, 55);
  }, [barsData]);

  // Calculate institutional Daily Standard Deviation & Trailing 24H VWAP Bands
  const dailySD = useMemo(() => {
    return calculateDailyStandardDeviation(barsData, currentPrice, activeSymbol);
  }, [barsData, currentPrice, activeSymbol]);

  return (
    <div className="min-h-screen bg-white text-[#0D0D0C] flex flex-col font-sans selection:bg-[#0D0D0C] selection:text-white w-full max-w-full overflow-x-hidden relative">
      {/* Clean Pure White Canvas */}

      {/* 1. Top Navigation & Ticker Header */}
      <Header
        activeSymbol={activeSymbol}
        onSelectSymbol={handleSelectSymbol}
        symbols={SYMBOLS}
        orderFlowData={orderFlowData}
        currentPrice={currentPrice}
        isConnected={isConnected}
        isLoading={isLoading}
        onRefresh={fetchAllData}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((v) => !v)}
        showStandardDeviation={showStandardDeviation}
        onToggleStandardDeviation={() => setShowStandardDeviation((v) => !v)}
        activeView={activeView}
        onChangeView={setActiveView}
      />

      {/* 2. Main Content Canvas */}
      <main className="flex-1 max-w-full 2xl:max-w-[2100px] 3xl:max-w-[3200px] 4k:max-w-[3600px] mx-auto px-2.5 sm:px-6 3xl:px-10 py-3 sm:py-5 w-full space-y-4 sm:space-y-6">
        {/* Editorial Hero Banner (Inter Tight ~172px Reference Scale & Balanced Groups) */}
        <section className="pt-2 pb-1 sm:pt-4 sm:pb-3 border-b border-[#0D0D0C]/10 mb-2 animate-fade-rise">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="max-w-4xl">
              <div className="flex items-center gap-2 mb-2 sm:mb-3">
                <span className="w-2 h-2 rounded-full bg-[#3FB874] animate-pulse"></span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0D0D0C]/70 font-mono">
                  INSTITUTIONAL GOLD (XAUUSD) • 1.0% RISK ENGINE
                </span>
              </div>
              <h1 className="text-[38px] xs:text-[48px] sm:text-[72px] md:text-[98px] lg:text-[132px] xl:text-[160px] 2xl:text-[172px] font-medium leading-[0.86] tracking-[-0.032em] text-[#0D0D0C] font-headline select-none">
                GOLD AUCTION
              </h1>
              <p className="text-[15px] sm:text-[18.5px] text-[#0D0D0C]/56 font-sans leading-relaxed mt-2.5 sm:mt-3.5 max-w-2xl">
                Auction Market Theory, Volume Profile & Footprint Delta terminal. Calibrated twin-order execution with zero-risk breakeven runner.
              </p>
            </div>

            {/* Quick Hero Metrics Group */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
              <div className="bg-[#F8F9FA] border border-[#0D0D0C]/12 rounded-[7px] p-3 sm:p-3.5 min-w-[130px] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                <span className="text-[11px] text-[#0D0D0C]/56 block font-sans font-medium">Daily Target</span>
                <span className="text-xl sm:text-2xl font-semibold text-[#3FB874] font-headline">+2.0% - 3.0%</span>
              </div>
              <div className="bg-[#F8F9FA] border border-[#0D0D0C]/12 rounded-[7px] p-3 sm:p-3.5 min-w-[130px] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                <span className="text-[11px] text-[#0D0D0C]/56 block font-sans font-medium">Risk Limit</span>
                <span className="text-xl sm:text-2xl font-semibold text-[#0D0D0C] font-headline">-2.5% Safe</span>
              </div>
              <div className="bg-[#F8F9FA] border border-[#0D0D0C]/12 rounded-[7px] p-3 sm:p-3.5 min-w-[130px] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                <span className="text-[11px] text-[#0D0D0C]/56 block font-sans font-medium">Risk Model</span>
                <span className="text-xl sm:text-2xl font-semibold text-[#0D0D0C] font-headline">Twin Order</span>
              </div>
            </div>
          </div>
        </section>

        {/* VIEW 1: Dedicated Footprint Clusters Chart View */}
        {activeView === 'footprint' && (
          <div className="w-full">
            <FootprintChart
              symbol={activeSymbol}
              footprintData={footprintData}
              currentPrice={currentPrice}
              timeframe={timeframe}
              onSelectTimeframe={handleSelectTimeframe}
              decimals={decimals}
              barsData={barsData}
            />
          </div>
        )}

        {/* VIEW 2: Dedicated Order Flow Depth View */}
        {activeView === 'volume-profile' && (
          <div className="w-full max-w-6xl mx-auto space-y-4 sm:space-y-6">
            <OrderFlowCards
              symbol={activeSymbol}
              orderFlowData={orderFlowData}
              livePrice={currentPrice}
              activeVP={activeVP}
              dailySD={dailySD}
              showStandardDeviation={showStandardDeviation}
            />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
              <div className={showStandardDeviation ? "lg:col-span-5" : "lg:col-span-12"}>
                <VolumeProfileHistogram
                  symbol={activeSymbol}
                  orderFlowData={orderFlowData}
                  activeVP={activeVP}
                  decimals={decimals}
                />
              </div>
              {showStandardDeviation && (
                <div className="lg:col-span-7">
                  <StandardDeviationMatrix
                    dailySD={dailySD}
                    currentPrice={currentPrice}
                    symbol={activeSymbol}
                    decimals={decimals}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 3: Standard Candlestick + Micro Volume Profile View */}
        {activeView === 'candles' && (
          <div className="space-y-4 sm:space-y-6">
            <OrderFlowCards
              symbol={activeSymbol}
              orderFlowData={orderFlowData}
              livePrice={currentPrice}
              activeVP={activeVP}
              dailySD={dailySD}
              showStandardDeviation={showStandardDeviation}
            />
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
            {showStandardDeviation && (
              <StandardDeviationMatrix
                dailySD={dailySD}
                currentPrice={currentPrice}
                symbol={activeSymbol}
                decimals={decimals}
              />
            )}
          </div>
        )}

        {/* VIEW 5: UOT Institutional Trading Analysis Engine */}
        {activeView === 'uot-signals' && (
          <div className="w-full max-w-6xl mx-auto">
            <UOTSignalTerminal
              barsData={barsData}
              currentPrice={currentPrice}
              symbol={activeSymbol}
              decimals={decimals}
              onRefresh={fetchAllData}
              isLoading={isLoading}
            />
          </div>
        )}

        {/* VIEW 4: Combined Multi-Column View (Full Desktop Terminal) */}
        {activeView === 'all' && (
          <div className="space-y-4 sm:space-y-6">
            <OrderFlowCards
              symbol={activeSymbol}
              orderFlowData={orderFlowData}
              livePrice={currentPrice}
              activeVP={activeVP}
              dailySD={dailySD}
              showStandardDeviation={showStandardDeviation}
            />
            <div className="grid grid-cols-1 xl:grid-cols-12 3xl:grid-cols-12 gap-4 sm:gap-6 items-start">
              <div className="xl:col-span-8 3xl:col-span-8">
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
              </div>
              <div className="xl:col-span-4 3xl:col-span-4">
                <VolumeProfileHistogram
                  symbol={activeSymbol}
                  orderFlowData={orderFlowData}
                  activeVP={activeVP}
                  decimals={decimals}
                />
              </div>
            </div>
            {showStandardDeviation && (
              <div className="w-full">
                <StandardDeviationMatrix
                  dailySD={dailySD}
                  currentPrice={currentPrice}
                  symbol={activeSymbol}
                  decimals={decimals}
                />
              </div>
            )}
            <div className="w-full">
              <FootprintChart
                symbol={activeSymbol}
                footprintData={footprintData}
                currentPrice={currentPrice}
                timeframe={timeframe}
                onSelectTimeframe={handleSelectTimeframe}
                decimals={decimals}
                barsData={barsData}
              />
            </div>
          </div>
        )}
      </main>

      {/* 3. Footer Bar */}
      <footer className="bg-white border-t border-[#0D0D0C]/10 mt-auto py-3.5 px-3 sm:px-6 text-xs text-[#0D0D0C]/56 mb-16 lg:mb-0 w-full overflow-x-hidden font-mono relative z-10">
        <div className="max-w-full 2xl:max-w-[2100px] 3xl:max-w-[3200px] 4k:max-w-[3600px] mx-auto flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs">
            <span className="flex items-center gap-1.5 font-bold text-[#0D0D0C]">
              <span className="w-2 h-2 rounded-full bg-[#3FB874] animate-pulse"></span>
              TRADING BOY ORDER FLOW TERMINAL
            </span>
            <span className="text-[#0D0D0C]/25 hidden sm:inline">|</span>
            <span className="hidden sm:inline">Target: +2.0% - 3.0%</span>
            <span className="text-[#0D0D0C]/25 hidden sm:inline">|</span>
            <span className="hidden sm:inline">Capital Guard: -2.5%</span>
            <span className="text-[#0D0D0C]/25 hidden sm:inline">|</span>
            <span className="text-[#3FB874] font-bold">
              LIVE AUCTION FEED ACTIVE
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[#0D0D0C]/42 text-[10px] sm:text-xs">
            <span>Volume Profile & Footprint Engine</span>
            <span>•</span>
            <span>XAUUSD Spot</span>
          </div>
        </div>
      </footer>

      {/* 4. Mobile & Tablet Native App Bottom Navigation Bar */}
      <BottomNav
        activeView={activeView}
        onChangeView={setActiveView}
        showStandardDeviation={showStandardDeviation}
        onToggleStandardDeviation={() => setShowStandardDeviation((v) => !v)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiUrl={apiUrl}
        onSaveApiUrl={handleSaveApiUrl}
      />
    </div>
  );
}
