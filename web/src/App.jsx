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
  getFallbackBars,
  getFallbackOrderFlow,
  getFallbackFootprint,
  getFallbackSignals,
} from './data/mockData';

const SYMBOLS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'AUDUSD', 'USDCAD'];

export default function App() {
  const [activeSymbol, setActiveSymbol] = useState('XAUUSD');
  const [timeframe, setTimeframe] = useState('1h'); // '5m' | '15m' | '1h' | '4h'
  const [activeView, setActiveView] = useState('all'); // 'all' | 'candles' | 'footprint'

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
    return initBars[0]?.close || 2742.5;
  });

  const [isConnected, setIsConnected] = useState(false);
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

  // Handle symbol change smoothly
  const handleSelectSymbol = async (sym) => {
    setActiveSymbol(sym);
    setBarsData(getFallbackBars(sym, 120, timeframe));
    setFootprintData(getFallbackFootprint(sym, 12, timeframe));
    const of = orderFlowData.find((o) => o.symbol === sym);
    if (of?.current_price) {
      setCurrentPrice(of.current_price);
    }

    if (apiUrl !== 'simulation') {
      try {
        const cleanUrl = apiUrl ? apiUrl.replace(/\/+$/, '') : '';
        const res = await fetch(`${cleanUrl}/api/bars?symbol=${sym}&timeframe=${timeframe}&limit=120`, { mode: 'cors' });
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.bars) && json.bars.length > 0) {
            setBarsData(json.bars);
            if (json.live_price) setCurrentPrice(json.live_price);
            setIsConnected(true);
          }
        }
      } catch (e) {
        console.warn('Direct symbol fetch:', e);
      }
    }
  };

  // Handle timeframe change smoothly and fetch bars & footprint immediately
  const handleSelectTimeframe = async (newTf) => {
    setTimeframe(newTf);
    // 1. Instantly swap to distinct timeframe bars & footprint so chart changes visibly and instantly
    setBarsData(getFallbackBars(activeSymbol, 120, newTf));
    setFootprintData(getFallbackFootprint(activeSymbol, 12, newTf));

    // 2. Directly fetch live bars & footprint for new timeframe from backend or Vercel cloud
    if (apiUrl !== 'simulation') {
      try {
        const cleanUrl = apiUrl ? apiUrl.replace(/\/+$/, '') : '';
        const [barsRes, fpRes] = await Promise.all([
          fetch(`${cleanUrl}/api/bars?symbol=${activeSymbol}&timeframe=${newTf}&limit=120`, { mode: 'cors' }),
          fetch(`${cleanUrl}/api/footprint?symbol=${activeSymbol}&timeframe=${newTf}&limit=12`, { mode: 'cors' }),
        ]);

        if (barsRes.ok) {
          const json = await barsRes.json();
          if (Array.isArray(json.bars) && json.bars.length > 0) {
            setBarsData(json.bars);
            if (json.live_price) setCurrentPrice(json.live_price);
            setIsConnected(true);
          }
        }

        if (fpRes.ok) {
          const fpJson = await fpRes.json();
          if (Array.isArray(fpJson.footprint) && fpJson.footprint.length > 0) {
            setFootprintData(fpJson.footprint);
          }
        }
      } catch (e) {
        console.warn('Direct timeframe fetch:', e);
      }
    }
  };

  // Fetch all live data from backend or 24/7 Vercel cloud endpoints
  const fetchAllData = useCallback(async () => {
    if (apiUrl === 'simulation') {
      setIsConnected(false);
      return;
    }

    setIsLoading(true);
    const cleanUrl = apiUrl ? apiUrl.replace(/\/+$/, '') : '';

    try {
      // 1. Fetch Order Flow across pairs
      const ofRes = await fetch(`${cleanUrl}/api/orderflow`, { mode: 'cors' });
      if (ofRes.ok) {
        const ofJson = await ofRes.json();
        if (Array.isArray(ofJson.orderflow) && ofJson.orderflow.length > 0) {
          setOrderFlowData(ofJson.orderflow);
          const activeOF = ofJson.orderflow.find((o) => o.symbol === activeSymbol);
          if (activeOF?.current_price) {
            setCurrentPrice(activeOF.current_price);
          }
        }
      }

      // 2. Fetch Candlestick Bars for active symbol & timeframe (5m, 15m, 1h, 4h)
      const barsRes = await fetch(
        `${cleanUrl}/api/bars?symbol=${activeSymbol}&timeframe=${timeframe}&limit=120`,
        { mode: 'cors' }
      );
      if (barsRes.ok) {
        const barsJson = await barsRes.json();
        if (Array.isArray(barsJson.bars) && barsJson.bars.length > 0) {
          setBarsData(barsJson.bars);
          if (barsJson.live_price) {
            setCurrentPrice(barsJson.live_price);
          }
        }
      }

      // 3. Fetch Footprint Clusters for active symbol & selected timeframe
      const fpRes = await fetch(
        `${cleanUrl}/api/footprint?symbol=${activeSymbol}&timeframe=${timeframe}&limit=12`,
        { mode: 'cors' }
      );
      if (fpRes.ok) {
        const fpJson = await fpRes.json();
        if (Array.isArray(fpJson.footprint) && fpJson.footprint.length > 0) {
          setFootprintData(fpJson.footprint);
        }
      }

      // 4. Fetch Live Signals
      const sigRes = await fetch(`${cleanUrl}/api/signals`, { mode: 'cors' });
      if (sigRes.ok) {
        const sigJson = await sigRes.json();
        setSignalsData(sigJson);

        const currentCount = sigJson.trades_count || 0;
        if (prevSignalsCountRef.current > 0 && currentCount > prevSignalsCountRef.current) {
          playAlertSound();
        }
        prevSignalsCountRef.current = currentCount;
      }

      setIsConnected(true);
    } catch (err) {
      console.info('[TERMINAL] Backend offline. Running high-fidelity simulation mode.');
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, activeSymbol, timeframe, playAlertSound]);

  // Initial fetch and auto-refresh every 15 seconds
  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 15000);
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

  // Subtle live tick generator when in offline / simulation mode to keep charts feeling alive
  useEffect(() => {
    if (isConnected) return;

    const tickInterval = setInterval(() => {
      setBarsData((prevBars) => {
        if (!prevBars || prevBars.length === 0) return prevBars;
        const last = { ...prevBars[prevBars.length - 1] };
        const microNoise = (Math.random() - 0.5) * (activeSymbol === 'XAUUSD' ? 0.35 : 0.00012);
        const newClose = Number((last.close + microNoise).toFixed(activeSymbol === 'XAUUSD' ? 2 : 5));
        const newHigh = Math.max(last.high, newClose);
        const newLow = Math.min(last.low, newClose);
        const updated = [...prevBars.slice(0, -1), { ...last, close: newClose, high: newHigh, low: newLow }];
        setCurrentPrice(newClose);
        return updated;
      });
    }, 3000);

    return () => clearInterval(tickInterval);
  }, [isConnected, activeSymbol]);

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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
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
      />

      {/* 2. Main Terminal Content (Mobile to 4K Responsive Grid) */}
      <main className="flex-1 max-w-full 2xl:max-w-[2100px] 3xl:max-w-[3200px] 4k:max-w-[3600px] w-full mx-auto px-2 sm:px-4 md:px-6 3xl:px-10 py-3 sm:py-6 space-y-4 sm:space-y-6 pb-24 lg:pb-8">
        {/* Order Flow Top Cards (100% Synchronized with Chart VP) */}
        <OrderFlowCards
          symbol={activeSymbol}
          orderFlowData={orderFlowData}
          livePrice={currentPrice}
          activeVP={activeVP}
        />

        {/* Charting & Execution Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-12 3xl:grid-cols-12 gap-4 sm:gap-6 items-start">
          {/* Main Visuals Column (8 cols on XL/3XL) */}
          <div className="xl:col-span-8 3xl:col-span-8 space-y-4 sm:space-y-6">
            {/* Candlestick & In-Chart Footprint/Volume Profile Terminal */}
            {(activeView === 'all' || activeView === 'candles') && (
              <div id="chart-section">
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

            {/* Standalone Footprint Clusters Matrix View */}
            {(activeView === 'all' || activeView === 'footprint') && (
              <div id="footprint-section">
                <FootprintChart
                  symbol={activeSymbol}
                  footprintData={footprintData}
                  timeframe={timeframe}
                  decimals={decimals}
                />
              </div>
            )}
          </div>

          {/* Right Rail: Volume Profile Depth & Telegram Signals (4 cols on XL/3XL) */}
          <div className="xl:col-span-4 3xl:col-span-4 space-y-4 sm:space-y-6">
            {/* Live Signals & MT5 Tickets */}
            <div id="signals-section">
              <SignalsFeed signalsData={signalsData} />
            </div>

            {/* Horizontal Volume Profile Ladder (100% Synchronized with Chart VP) */}
            <div id="volume-profile-section">
              <VolumeProfileHistogram
                symbol={activeSymbol}
                orderFlowData={orderFlowData}
                activeVP={activeVP}
                decimals={decimals}
              />
            </div>
          </div>
        </div>
      </main>

      {/* 3. Footer Bar */}
      <footer className="bg-white border-t border-slate-200 mt-auto py-3 px-4 sm:px-6 text-xs text-slate-500 mb-16 lg:mb-0">
        <div className="max-w-full 2xl:max-w-[2100px] 3xl:max-w-[3200px] 4k:max-w-[3600px] mx-auto flex flex-wrap items-center justify-between gap-3 font-mono">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-400'}`}></span>
            <span>TRADING BOY AI TRADING ENGINE</span>
            <span className="text-slate-300">|</span>
            <span>Twin Orders: 1:1 + 1:2 RR</span>
            <span className="text-slate-300">|</span>
            <span>Risk: 1.0%</span>
            <span className="text-slate-300">|</span>
            <span className={isConnected ? 'text-emerald-600 font-bold' : 'text-amber-600 font-semibold'}>
              {isConnected ? 'LIVE ENGINE SYNCED' : 'SIMULATION MODE'}
            </span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span>Scan Schedule: :31 Past Every Hour</span>
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
