import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import OrderFlowCards from './components/OrderFlowCards';
import CandleChart from './components/CandleChart';
import FootprintChart from './components/FootprintChart';
import VolumeProfileHistogram from './components/VolumeProfileHistogram';
import SignalsFeed from './components/SignalsFeed';
import SettingsModal from './components/SettingsModal';

const SYMBOLS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'AUDUSD', 'USDCAD'];

export default function App() {
  const [activeSymbol, setActiveSymbol] = useState('XAUUSD');
  const [activeView, setActiveView] = useState('all'); // 'all' | 'candles' | 'footprint'
  const [apiUrl, setApiUrl] = useState(() => {
    return (
      localStorage.getItem('tb_api_url') ||
      (window.location.hostname === 'localhost'
        ? 'http://localhost:8080'
        : 'https://order-flow-trader.onrender.com')
    );
  });

  const [orderFlowData, setOrderFlowData] = useState([]);
  const [barsData, setBarsData] = useState([]);
  const [footprintData, setFootprintData] = useState([]);
  const [signalsData, setSignalsData] = useState(null);
  const [currentPrice, setCurrentPrice] = useState(null);

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
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
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

  // Fetch all live data from backend
  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    const cleanUrl = apiUrl.replace(/\/+$/, '');

    try {
      // 1. Fetch Order Flow across pairs
      const ofRes = await fetch(`${cleanUrl}/api/orderflow`, { mode: 'cors' });
      if (ofRes.ok) {
        const ofJson = await ofRes.json();
        setOrderFlowData(ofJson.orderflow || []);
        const activeOF = (ofJson.orderflow || []).find((o) => o.symbol === activeSymbol);
        if (activeOF?.current_price) {
          setCurrentPrice(activeOF.current_price);
        }
      }

      // 2. Fetch Candlestick Bars for active symbol
      const barsRes = await fetch(`${cleanUrl}/api/bars?symbol=${activeSymbol}&limit=120`, {
        mode: 'cors',
      });
      if (barsRes.ok) {
        const barsJson = await barsRes.json();
        setBarsData(barsJson.bars || []);
        if (barsJson.live_price) {
          setCurrentPrice(barsJson.live_price);
        }
      }

      // 3. Fetch Footprint Clusters for active symbol
      const fpRes = await fetch(`${cleanUrl}/api/footprint?symbol=${activeSymbol}&limit=12`, {
        mode: 'cors',
      });
      if (fpRes.ok) {
        const fpJson = await fpRes.json();
        setFootprintData(fpJson.footprint || []);
      }

      // 4. Fetch Live Signals
      const sigRes = await fetch(`${cleanUrl}/api/signals`, { mode: 'cors' });
      if (sigRes.ok) {
        const sigJson = await sigRes.json();
        setSignalsData(sigJson);

        // Check for new signals
        const currentCount = sigJson.trades_count || 0;
        if (prevSignalsCountRef.current > 0 && currentCount > prevSignalsCountRef.current) {
          playAlertSound();
        }
        prevSignalsCountRef.current = currentCount;
      }

      setIsConnected(true);
    } catch (err) {
      console.warn('API Fetch error:', err);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, activeSymbol, playAlertSound]);

  // Initial fetch and auto-refresh every 15 seconds
  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 15000);
    return () => clearInterval(interval);
  }, [fetchAllData]);

  const handleSaveApiUrl = (newUrl) => {
    setApiUrl(newUrl);
    localStorage.setItem('tb_api_url', newUrl);
  };

  const decimals = activeSymbol === 'XAUUSD' ? 2 : 5;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* 1. Top Navigation & Ticker Header */}
      <Header
        activeSymbol={activeSymbol}
        onSelectSymbol={(sym) => {
          setActiveSymbol(sym);
          setBarsData([]);
          setFootprintData([]);
        }}
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

      {/* 2. Main Terminal Content */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Order Flow Top Cards */}
        <OrderFlowCards
          symbol={activeSymbol}
          orderFlowData={orderFlowData}
          livePrice={currentPrice}
        />

        {/* Charting & Execution Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Main Visuals Column (8 cols on XL) */}
          <div className="xl:col-span-8 space-y-6">
            {/* Candlestick & Volume Profile Overlay View */}
            {(activeView === 'all' || activeView === 'candles') && (
              <CandleChart
                symbol={activeSymbol}
                barsData={barsData}
                orderFlowData={orderFlowData}
                decimals={decimals}
              />
            )}

            {/* Footprint Clusters View */}
            {(activeView === 'all' || activeView === 'footprint') && (
              <FootprintChart
                symbol={activeSymbol}
                footprintData={footprintData}
                decimals={decimals}
              />
            )}
          </div>

          {/* Right Rail: Volume Profile Depth & Telegram Signals (4 cols on XL) */}
          <div className="xl:col-span-4 space-y-6">
            {/* Live Signals & MT5 Tickets */}
            <SignalsFeed signalsData={signalsData} />

            {/* Horizontal Volume Profile Ladder */}
            <VolumeProfileHistogram
              symbol={activeSymbol}
              orderFlowData={orderFlowData}
              decimals={decimals}
            />
          </div>
        </div>
      </main>

      {/* 3. Footer Bar */}
      <footer className="bg-white border-t border-slate-200 mt-auto py-3 px-6 text-xs text-slate-500">
        <div className="max-w-[1720px] mx-auto flex flex-wrap items-center justify-between gap-3 font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>TRADING BOY AI TRADING ENGINE</span>
            <span className="text-slate-300">|</span>
            <span>Twin Orders: 1:1 + 1:2 RR</span>
            <span className="text-slate-300">|</span>
            <span>Risk: 1.0%</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span>Scan Schedule: :31 Past Every Hour</span>
            <span>•</span>
            <span>Synced with @tradingboyorderbot</span>
          </div>
        </div>
      </footer>

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
