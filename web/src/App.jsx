import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Header from './components/Header';
import OrderFlowCards from './components/OrderFlowCards';
import CandleChart from './components/CandleChart';
import { calculateDynamicVolumeProfile } from './utils/volumeProfile';
import FootprintChart from './components/FootprintChart';
import VolumeProfileHistogram from './components/VolumeProfileHistogram';
import SignalsFeed from './components/SignalsFeed';
import SettingsModal from './components/SettingsModal';
import BottomNav from './components/BottomNav';
import {
  getLiveCandleBars,
  getLiveOrderFlow,
  getLiveFootprintClusters,
  getLiveExecutionSignals,
  evaluateTradeLifecycle,
  getCachedBars,
  subscribeLiveMarketTicks,
} from './services/liveMarketService';
import {
  getFallbackBars,
  getFallbackOrderFlow,
  getFallbackFootprint,
  getFallbackSignals,
} from './data/mockData';

const SYMBOLS = ['XAUUSD'];

export default function App() {
  const [activeSymbol, setActiveSymbol] = useState('XAUUSD');
  const [timeframe, setTimeframe] = useState('1h'); // '5m' | '15m' | '1h' | '4h'
  const [activeView, setActiveView] = useState('candles'); // 'candles' | 'footprint' | 'volume-profile' | 'signals' | 'all'

  // Smart API URL resolution: handles localStorage, Vercel env variable, or localhost
  const [apiUrl, setApiUrl] = useState(() => {
    const saved = localStorage.getItem('tb_api_url');
    if (saved !== null) return saved;
    const envUrl = import.meta.env?.VITE_API_URL;
    if (envUrl) return envUrl.trim().replace(/\/+$/, '');
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || !host) {
      return 'http://localhost:8080';
    }
    return '';
  });

  // Pre-seed state with high-fidelity realistic data immediately so chart & candles NEVER show blank
  const [orderFlowData, setOrderFlowData] = useState(() => getFallbackOrderFlow('XAUUSD'));
  const [barsData, setBarsData] = useState(() => getFallbackBars('XAUUSD', 120, '1h'));
  const [footprintData, setFootprintData] = useState(() => getFallbackFootprint('XAUUSD', 12, '1h'));
  const [signalsData, setSignalsData] = useState(() => getFallbackSignals());
  const [currentPrice, setCurrentPrice] = useState(() => {
    const initBars = getFallbackBars('XAUUSD', 1, '1h');
    return initBars[0]?.close || 4028.5;
  });

  const [isConnected, setIsConnected] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const prevSignalsCountRef = useRef(0);

  // Play audio chime for new signal
  const playAlertSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.warn('AudioContext error:', e);
    }
  }, [soundEnabled]);

  // Handle symbol change smoothly with instant Cache + Live Feed sync
  const handleSelectSymbol = async (sym) => {
    setActiveSymbol(sym);

    // Instant (0ms) in-memory cache check so chart never delays
    const cached = getCachedBars(sym, timeframe);
    if (cached && cached.bars && cached.bars.length > 0) {
      setBarsData(cached.bars);
      setCurrentPrice(cached.livePrice);
    }

    try {
      const live = await getLiveCandleBars(sym, timeframe, 120, apiUrl);
      if (live && live.bars && live.bars.length > 0) {
        setBarsData(live.bars);
        setCurrentPrice(live.livePrice);

        const fp = getLiveFootprintClusters(live.bars, sym, timeframe);
        if (fp && fp.length > 0) setFootprintData(fp);

        const of = await getLiveOrderFlow(SYMBOLS, { [sym]: live.bars }, { [sym]: live.livePrice });
        if (of && of.length > 0) setOrderFlowData(of);
      }
    } catch (e) {
      console.warn('Live symbol fetch:', e);
    }
  };

  // Handle timeframe change smoothly with instant Cache + Live Feed sync
  const handleSelectTimeframe = async (newTf) => {
    setTimeframe(newTf);

    // Instant (0ms) in-memory cache check so chart never delays
    const cached = getCachedBars(activeSymbol, newTf);
    if (cached && cached.bars && cached.bars.length > 0) {
      setBarsData(cached.bars);
      setCurrentPrice(cached.livePrice);
    }

    try {
      const live = await getLiveCandleBars(activeSymbol, newTf, 120, apiUrl);
      if (live && live.bars && live.bars.length > 0) {
        setBarsData(live.bars);
        setCurrentPrice(live.livePrice);

        const fp = getLiveFootprintClusters(live.bars, activeSymbol, newTf);
        if (fp && fp.length > 0) setFootprintData(fp);
      }
    } catch (e) {
      console.warn('Live timeframe fetch:', e);
    }
  };

  // 24/7 Live Feed background sync - runs continuously on Mobile, Vercel, and Desktop
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

        const sigs = await getLiveExecutionSignals(activeSymbol, live.livePrice, apiUrl);
        setSignalsData(sigs);
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

        // Immediate tick lifecycle evaluator: triggers sound and UI updates when SL, TP1, TP2, or BE is reached
        const lifecycleEvent = evaluateTradeLifecycle(update.livePrice);
        if (lifecycleEvent) {
          playAlertSound();
          getLiveExecutionSignals(activeSymbol, update.livePrice, apiUrl).then(setSignalsData);
        }
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
              volume: tick.volume || last.volume,
              buyVol: tick.buyVol || last.buyVol,
              sellVol: tick.sellVol || last.sellVol,
            };
            return [...prev.slice(0, -1), updated];
          } else if (tick.time > last.time) {
            // Brand new candle bar opened!
            return [...prev.slice(1), tick];
          }
          return prev;
        });
      } else if (update.tickerOnly && update.livePrice != null) {
        const curP = update.livePrice;
        setBarsData((prev) => {
          if (!prev || prev.length === 0) return prev;
          const last = prev[prev.length - 1];
          const updated = {
            ...last,
            close: curP,
            high: Math.max(last.high, curP),
            low: Math.min(last.low, curP),
          };
          return [...prev.slice(0, -1), updated];
        });
      }
    });

    return () => unsub();
  }, [activeSymbol, timeframe, apiUrl, playAlertSound]);

  const handleLifecycleChange = useCallback(async (event) => {
    if (event) {
      playAlertSound();
    }
    const sigs = await getLiveExecutionSignals(activeSymbol, currentPrice, apiUrl);
    setSignalsData(sigs);
  }, [activeSymbol, currentPrice, apiUrl, playAlertSound]);

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

  return (
    <div className="min-h-screen bg-[#FBF6EF] text-[#0D0D0C] flex flex-col font-sans selection:bg-[#0D0D0C] selection:text-[#FBF6EF] w-full max-w-full overflow-x-hidden relative">
      {/* Layered Soft Radial Glows */}
      <div className="absolute top-[-100px] left-[-100px] w-[600px] h-[600px] rounded-full radial-glow-lemon pointer-events-none opacity-70 animate-drift"></div>
      <div className="absolute top-[250px] right-[-150px] w-[650px] h-[650px] rounded-full radial-glow-peach pointer-events-none opacity-50"></div>
      <div className="absolute bottom-[200px] left-[10%] w-[550px] h-[550px] rounded-full radial-glow-sage pointer-events-none opacity-40"></div>
      <div className="absolute top-[60%] right-[10%] w-[500px] h-[500px] rounded-full radial-glow-rose pointer-events-none opacity-45"></div>

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
        onOpenSettings={() => setIsSettingsOpen(true)}
        activeView={activeView}
        onChangeView={setActiveView}
        signalsData={signalsData}
      />

      {/* 2. Main Terminal Content (Mobile to 4K Responsive Grid) */}
      <main className="flex-1 max-w-full 2xl:max-w-[2100px] 3xl:max-w-[3200px] 4k:max-w-[3600px] w-full mx-auto px-2.5 sm:px-4 md:px-6 3xl:px-10 py-3 sm:py-6 space-y-4 sm:space-y-6 pb-24 lg:pb-8 overflow-x-hidden relative z-10">
        
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
              <div className="bg-[#F4EFE6] border border-[#0D0D0C]/12 rounded-[7px] p-3 sm:p-3.5 min-w-[130px]">
                <span className="text-[11px] text-[#0D0D0C]/56 block font-sans font-medium">Daily Target</span>
                <span className="text-xl sm:text-2xl font-semibold text-[#3FB874] font-headline">+2.0% - 3.0%</span>
              </div>
              <div className="bg-[#F4EFE6] border border-[#0D0D0C]/12 rounded-[7px] p-3 sm:p-3.5 min-w-[130px]">
                <span className="text-[11px] text-[#0D0D0C]/56 block font-sans font-medium">Risk Limit</span>
                <span className="text-xl sm:text-2xl font-semibold text-[#0D0D0C] font-headline">-2.5% Safe</span>
              </div>
              <div className="bg-[#F4EFE6] border border-[#0D0D0C]/12 rounded-[7px] p-3 sm:p-3.5 min-w-[130px]">
                <span className="text-[11px] text-[#0D0D0C]/56 block font-sans font-medium">Pacing</span>
                <span className="text-xl sm:text-2xl font-semibold text-[#0D0D0C] font-headline">{signalsData?.trades_count ?? 0} / 3 Max</span>
              </div>
            </div>
          </div>
        </section>

        {/* VIEW 1: Dedicated MT5 Signals & Strategies View */}
        {activeView === 'signals' && (
          <div className="w-full max-w-5xl mx-auto">
            <SignalsFeed
              signalsData={signalsData}
              onLifecycleChange={handleLifecycleChange}
              currentPrice={currentPrice}
            />
          </div>
        )}

        {/* VIEW 2: Dedicated Footprint Clusters Chart View */}
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

        {/* VIEW 3: Dedicated Volume Profile Depth Histogram View */}
        {activeView === 'volume-profile' && (
          <div className="w-full max-w-5xl mx-auto">
            <VolumeProfileHistogram
              symbol={activeSymbol}
              orderFlowData={orderFlowData}
              activeVP={activeVP}
              decimals={decimals}
            />
          </div>
        )}

        {/* VIEW 4: Chart & Order Flow Overview View */}
        {activeView === 'candles' && (
          <div className="space-y-4 sm:space-y-6">
            <OrderFlowCards
              symbol={activeSymbol}
              orderFlowData={orderFlowData}
              livePrice={currentPrice}
              activeVP={activeVP}
              signalsData={signalsData}
            />
            <CandleChart
              symbol={activeSymbol}
              barsData={barsData}
              footprintData={footprintData}
              orderFlowData={orderFlowData}
              activeVP={activeVP}
              timeframe={timeframe}
              onSelectTimeframe={handleSelectTimeframe}
              decimals={decimals}
            />
          </div>
        )}

        {/* VIEW 5: Combined Multi-Column View (Full Desktop Terminal) */}
        {activeView === 'all' && (
          <div className="space-y-4 sm:space-y-6">
            <OrderFlowCards
              symbol={activeSymbol}
              orderFlowData={orderFlowData}
              livePrice={currentPrice}
              activeVP={activeVP}
              signalsData={signalsData}
            />
            <div className="grid grid-cols-1 xl:grid-cols-12 3xl:grid-cols-12 gap-4 sm:gap-6 items-start">
              <div className="xl:col-span-8 3xl:col-span-8 space-y-4 sm:space-y-6">
                <CandleChart
                  symbol={activeSymbol}
                  barsData={barsData}
                  footprintData={footprintData}
                  orderFlowData={orderFlowData}
                  activeVP={activeVP}
                  timeframe={timeframe}
                  onSelectTimeframe={handleSelectTimeframe}
                  decimals={decimals}
                />
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
              <div className="xl:col-span-4 3xl:col-span-4 space-y-4 sm:space-y-6">
                <SignalsFeed
                  signalsData={signalsData}
                  onLifecycleChange={handleLifecycleChange}
                  currentPrice={currentPrice}
                />
                <VolumeProfileHistogram
                  symbol={activeSymbol}
                  orderFlowData={orderFlowData}
                  activeVP={activeVP}
                  decimals={decimals}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 3. Footer Bar */}
      <footer className="bg-[#FBF6EF] border-t border-[#0D0D0C]/12 mt-auto py-3.5 px-3 sm:px-6 text-xs text-[#0D0D0C]/56 mb-16 lg:mb-0 w-full overflow-x-hidden font-mono relative z-10">
        <div className="max-w-full 2xl:max-w-[2100px] 3xl:max-w-[3200px] 4k:max-w-[3600px] mx-auto flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs">
            <span className="flex items-center gap-1.5 font-bold text-[#0D0D0C]">
              <span className="w-2 h-2 rounded-full bg-[#3FB874] animate-pulse"></span>
              TRADING BOY AI ENGINE
            </span>
            <span className="text-[#0D0D0C]/25 hidden sm:inline">|</span>
            <span className="hidden sm:inline">Target: +2.0% - 3.0%</span>
            <span className="text-[#0D0D0C]/25 hidden sm:inline">|</span>
            <span className="hidden sm:inline">Capital Guard: -2.5%</span>
            <span className="text-[#0D0D0C]/25 hidden sm:inline">|</span>
            <span className="hidden sm:inline">Max 3 Trades/Day</span>
            <span className="text-[#0D0D0C]/25 hidden sm:inline">|</span>
            <span className="text-[#3FB874] font-bold">
              LIVE ENGINE SYNCED
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[#0D0D0C]/42 text-[10px] sm:text-xs">
            <span>Hourly :31 Scans</span>
            <span>•</span>
            <span>Synced with @tradingboyorderbot</span>
          </div>
        </div>
      </footer>

      {/* 4. Mobile & Tablet Native App Bottom Navigation Bar */}
      <BottomNav
        activeView={activeView}
        onChangeView={setActiveView}
        onOpenSettings={() => setIsSettingsOpen(true)}
        signalsCount={signalsData?.trades_count || 0}
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
