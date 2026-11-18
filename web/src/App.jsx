import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from './components/Header';
import CandleChart from './components/CandleChart';
import StandardDeviationMatrix from './components/StandardDeviationMatrix';
import AuctionProfileMatrix from './components/AuctionProfileMatrix';
import AuthGate from './components/AuthGate';
import AdminPanel from './components/AdminPanel';
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
  verifySession,
  clearSession,
  getStoredToken,
} from './services/authService';
import {
  getFallbackBars,
  getFallbackOrderFlow,
  getFallbackFootprint,
} from './data/mockData';

const SYMBOLS = ['XAUUSD', 'NAS100'];

function TradingTerminal({ authUser, pendingCount, onOpenAdmin, onLogout }) {
  const [activeSymbol, setActiveSymbol] = useState('XAUUSD');
  const [timeframe, setTimeframe] = useState('1h');
  const [showStandardDeviation, setShowStandardDeviation] = useState(false); // Default OFF per user rule
  const [showMarketProfile, setShowMarketProfile] = useState(false); // Default OFF: Volume • Delta • TPO Profile Matrix
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  // Instant cache retrieval or realistic mocks
  const [barsData, setBarsData] = useState(() => {
    const cached = getCachedBars('XAUUSD', '1h');
    const bars = cached?.bars || cached;
    return bars && bars.length > 0 ? bars : getFallbackBars('XAUUSD', '1h');
  });

  const [currentPrice, setCurrentPrice] = useState(() => {
    return barsData && barsData.length > 0 ? barsData[barsData.length - 1].close : 4034.40;
  });

  const [orderFlowData, setOrderFlowData] = useState(() => getFallbackOrderFlow());
  const [footprintData, setFootprintData] = useState(() => {
    const cached = getCachedBars('XAUUSD', '1h');
    const initBars = cached?.bars || cached || getFallbackBars('XAUUSD', '1h');
    return getLiveFootprintClusters(initBars, 'XAUUSD', '1h');
  });

  // Instant Symbol Switching (XAUUSD <-> NASDAQ)
  const handleSelectSymbol = useCallback((sym) => {
    if (sym !== activeSymbol) {
      setActiveSymbol(sym);
      const cached = getCachedBars(sym, timeframe);
      const bars = cached?.bars || cached;
      if (bars && bars.length > 0) {
        setBarsData(bars);
        if (cached?.livePrice != null) {
          setCurrentPrice(cached.livePrice);
        } else if (bars[bars.length - 1]?.close != null) {
          setCurrentPrice(bars[bars.length - 1].close);
        }
        setFootprintData(getLiveFootprintClusters(bars, sym, timeframe));
      } else {
        const fb = getFallbackBars(sym, 100, timeframe);
        if (fb && fb.length > 0) {
          setBarsData(fb);
          if (fb[fb.length - 1]?.close != null) {
            setCurrentPrice(fb[fb.length - 1].close);
          }
          setFootprintData(getLiveFootprintClusters(fb, sym, timeframe));
        }
      }
    }
  }, [activeSymbol, timeframe]);

  // Timeframe change with instant Cache sync
  const handleSelectTimeframe = useCallback((tf) => {
    if (tf !== timeframe) {
      setTimeframe(tf);
      const cached = getCachedBars(activeSymbol, tf);
      const bars = cached?.bars || cached;
      if (bars && bars.length > 0) {
        setBarsData(bars);
        if (cached?.livePrice != null) {
          setCurrentPrice(cached.livePrice);
        } else if (bars[bars.length - 1]?.close != null) {
          setCurrentPrice(bars[bars.length - 1].close);
        }
        setFootprintData(getLiveFootprintClusters(bars, activeSymbol, tf));
      } else {
        const fb = getFallbackBars(activeSymbol, 100, tf);
        if (fb && fb.length > 0) {
          setBarsData(fb);
          if (fb[fb.length - 1]?.close != null) {
            setCurrentPrice(fb[fb.length - 1].close);
          }
          setFootprintData(getLiveFootprintClusters(fb, activeSymbol, tf));
        }
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

  const isDec2 = activeSymbol === 'XAUUSD' || activeSymbol === 'NAS100' || activeSymbol === 'NASDAQ';
  const decimals = isDec2 ? 2 : 5;

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
        onSelectSymbol={handleSelectSymbol}
        currentPrice={currentPrice}
        timeframe={timeframe}
        onSelectTimeframe={handleSelectTimeframe}
        showStandardDeviation={showStandardDeviation}
        onToggleStandardDeviation={() => setShowStandardDeviation((v) => !v)}
        showMarketProfile={showMarketProfile}
        onToggleMarketProfile={() => setShowMarketProfile((v) => !v)}
        isConnected={isConnected}
        isLoading={isLoading}
        onRefresh={fetchAllData}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((v) => !v)}
        authUser={authUser}
        pendingCount={pendingCount}
        onOpenAdmin={onOpenAdmin}
        onLogout={onLogout}
      />

      {/* 2. Main Minimal Workspace */}
      <main className="flex-1 max-w-full 2xl:max-w-[2100px] mx-auto px-2.5 sm:px-6 py-2.5 sm:py-3.5 w-full space-y-2.5 sm:space-y-3.5">
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

        {/* Institutional Auction Profile (Volume • Delta • TPO) Matrix */}
        {showMarketProfile && (
          <AuctionProfileMatrix
            symbol={activeSymbol}
            barsData={barsData}
            footprintData={footprintData}
            currentPrice={currentPrice}
            decimals={decimals}
          />
        )}

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
    </div>
  );
}

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [authNotice, setAuthNotice] = useState('');

  // Verify existing session on mount
  useEffect(() => {
    let active = true;
    const check = async () => {
      const token = getStoredToken();
      if (!token) {
        if (active) {
          setAuthUser(null);
          setAuthChecked(true);
        }
        return;
      }
      const res = await verifySession();
      if (!active) return;
      if (res.ok && res.user) {
        setAuthUser(res.user);
        setPendingCount(res.pendingCount || 0);
      } else {
        setAuthUser(null);
        if (res.status === 'rejected' || res.status === 'pending') {
          setAuthNotice(res.error || '');
        }
      }
      setAuthChecked(true);
    };
    check();
    return () => {
      active = false;
    };
  }, []);

  // Periodic live session & pending-request sync (every 30s)
  useEffect(() => {
    if (!authUser) return;
    const timer = setInterval(async () => {
      const res = await verifySession();
      if (res.ok && res.user) {
        setAuthUser(res.user);
        if (res.user.role === 'admin') {
          setPendingCount(res.pendingCount || 0);
        }
      } else if (!res.networkError) {
        setAuthUser(null);
        setShowAdminPanel(false);
        setAuthNotice(res.error || 'Your session ended.');
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [authUser]);

  const handleAuthSuccess = useCallback((user, initialPendingCount = 0) => {
    setAuthNotice('');
    setAuthUser(user);
    setPendingCount(initialPendingCount || 0);
    setShowAdminPanel(false);
  }, []);

  const handleLogout = useCallback(() => {
    clearSession();
    setAuthUser(null);
    setPendingCount(0);
    setShowAdminPanel(false);
    setAuthNotice('');
  }, []);

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-white text-[#0D0D0C] flex items-center justify-center font-mono text-xs">
        <div className="flex items-center gap-2 text-[#0D0D0C]/60">
          <span className="w-2 h-2 rounded-full bg-[#0D0D0C] animate-pulse"></span>
          <span>Verifying access...</span>
        </div>
      </div>
    );
  }

  // Strictly block all data/charts until authenticated & approved
  if (!authUser) {
    return <AuthGate onAuthSuccess={handleAuthSuccess} initialMessage={authNotice} />;
  }

  // Dedicated Admin Panel View
  if (authUser.role === 'admin' && showAdminPanel) {
    return (
      <AdminPanel
        onClose={() => setShowAdminPanel(false)}
        onLogout={handleLogout}
        onPendingCountChange={setPendingCount}
      />
    );
  }

  return (
    <TradingTerminal
      authUser={authUser}
      pendingCount={pendingCount}
      onOpenAdmin={() => setShowAdminPanel(true)}
      onLogout={handleLogout}
    />
  );
}
