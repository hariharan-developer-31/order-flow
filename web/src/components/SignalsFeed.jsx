import React, { useState } from 'react';
import {
  Send,
  Check,
  Copy,
  Shield,
  Target,
  Clock,
  Flame,
  TrendingUp,
  Activity,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Info,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
  BarChart3,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { simulateLifecycleAction, clearTradeHistory } from '../services/liveMarketService';

const STRATEGIES = [
  {
    id: 'amt_80',
    number: '1',
    name: 'AMT 80% Value Area Rule',
    tag: 'Ultra-High Win Rate (82% - 88%)',
    winRatePOC: '88%',
    winRateFull: '82%',
    avgRR: '1 : 2.3',
    riskPips: '$6.00 (60 pips)',
    footprintDelta: '+1,450',
    footprintDetail: 'Ask 3,100 x Bid 1,650 (Absorption at Top)',
    contextTf: '30-Min / 15-Min (Prior Day VP)',
    execTf: '5-Min Footprint Chart',
    dailyFreq: '1 to 2 trades/day (London or NY Open Killzones)',
    description:
      'Trades failed breakouts using Auction Market Theory. Breakouts above VAH or below VAL fail ~80% of the time, rotating back to POC (Target 1: 88% Win Rate with 3-Gate confirmation) and Opposite VA (Full Target: 82% Win Rate).',
    direction: 'SELL',
    setupType: 'Failed Auction / Value Rotation',
    target1Name: 'Rotation to POC (70% Scale-Out)',
    target2Name: 'Opposite VA Rotation (30% Runner)',
    gates: [
      '⚡ Gate 1: London Open (13:30 IST) & NY Overlap Killzones',
      '📊 Gate 2: Footprint Absorption (≥300% Imbalance Confirmation)',
      '🏛️ Gate 3: 4H HTF Alignment & Breakeven Cushion (+$0.50)'
    ]
  },
  {
    id: 'vwap_fade',
    number: '2',
    name: 'VWAP 2-SD Absorption Fade',
    tag: 'High Probability (75% - 82%)',
    winRatePOC: '82%',
    winRateFull: '75%',
    avgRR: '1 : 1.8 to 1 : 2.2',
    riskPips: '$2.50 to $3.50 (25-35 pips)',
    footprintDelta: '-1,180 (CVD Divergence)',
    footprintDetail: '3:1 Sell Imbalance Flip at +2σ Band',
    contextTf: '15-Min / 5-Min (Session VWAP ±2σ Bands)',
    execTf: '5-Min or 1-Min Footprint + CVD',
    dailyFreq: '1 to 2 trades/day (Across London & NY)',
    description:
      'Fades intraday overextensions away from Session VWAP. 95.4% of volume stays inside the ±2σ bands. Enters when footprint prints a 3:1 imbalance flip with CVD absorption.',
    direction: 'SELL',
    setupType: 'Mean-Reversion Overextension Fade',
    target1Name: 'Central VWAP Line (70% Scale-Out)',
    target2Name: 'Opposite ±1σ Band (30% Runner)',
    gates: [
      '⚡ Gate 1: NY Session Peak Volume (18:00 – 21:30 IST)',
      '📊 Gate 2: 3:1 CVD Imbalance Flip at ±2σ Band',
      '🏛️ Gate 3: Breakeven Cushion (+$0.50) at Central VWAP'
    ]
  },
  {
    id: 'lvn_pullback',
    number: '3',
    name: 'LVN Trend Pullback',
    tag: 'Trend Expansion (65% - 72%)',
    winRatePOC: '72%',
    winRateFull: '65%',
    avgRR: '1 : 2.5 to 1 : 4.0+',
    riskPips: '$2.00 to $3.00 (20-30 pips)',
    footprintDelta: '+2,850 (Trend Continuation)',
    footprintDetail: 'Stacked Buying Imbalance (300%+) at LVN',
    contextTf: '15-Min (Developing Session Profile)',
    execTf: '5-Min or 3-Min Footprint Imbalance',
    dailyFreq: '1 trade/day (Only on 4H Trend Days, ~25% of week)',
    description:
      'Trend continuation entry for runaway trend days (CPI, NFP, Fed rates). Price breaks violently out of value, leaving a Low Volume Node (LVN) valley. Enters on pullback reload into LVN.',
    direction: 'BUY',
    setupType: 'Institutional Trend Continuation',
    target1Name: 'Recent Swing High (70% Scale-Out)',
    target2Name: 'Trend Expansion Wave (30% Runner)',
    gates: [
      '⚡ Gate 1: High-Volume Trend Expansion Session',
      '📊 Gate 2: Stacked Buying/Selling Imbalance (300%+) at LVN',
      '🏛️ Gate 3: 4H Trend Direction Lock (No Counter-Trend Entries)'
    ]
  },
];

export default function SignalsFeed({ signalsData, onLifecycleChange, currentPrice = 4028.5 }) {
  // Top 3 Segmented Tabs: 'live' (Live Signal) | 'strategy' (Strategy Details) | 'history' (Trade History)
  const [activeTab, setActiveTab] = useState('live');
  const [activeStrategyId, setActiveStrategyId] = useState('amt_80');
  const [copiedId, setCopiedId] = useState(null);
  const [showTester, setShowTester] = useState(false);

  const activeStrat = STRATEGIES.find((s) => s.id === activeStrategyId) || STRATEGIES[0];

  // Active trades stream and lifecycle state from live market service
  const activeTrades = signalsData?.active_trades || [];
  const recentTrades = signalsData?.recent_trades || [];
  const strategyBlueprints = signalsData?.signals_stream || [];
  const tradesCount = signalsData?.trades_count ?? 0;
  const maxTrades = signalsData?.max_trades ?? 3;
  const todayPnl = signalsData?.today_pnl || '+0.00%';
  const isFlat = signalsData?.is_flat ?? (activeTrades.length === 0);
  const latestEvent = signalsData?.latest_lifecycle_event;
  const preAlert = signalsData?.pre_alert;

  // Format current Indian Standard Time (IST, UTC+05:30)
  const getISTTimeStr = () => {
    return new Date().toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const handleCopyTicket = (ticket, idx, label = 'SIGNAL') => {
    const text = `MT5 ORDER FLOW EXECUTION TICKET (INSTITUTIONAL GOLD XAUUSD):
Type: ${label}
Strategy: ${ticket.strategy || ticket.strategy_name || activeStrat.name}
Asset: ${ticket.side} XAUUSD (Gold Spot)
Entry Price: ${ticket.entry}
Stop Loss: ${ticket.sl} (Risk: 0.5% - 1.0%)
Target 1 (70% Scale-Out): ${ticket.tp1}
Target 2 (30% Runner): ${ticket.tp2}
Execution Time: ${ticket.time || getISTTimeStr() + ' IST'}

MANDATORY RISK RULES:
1. Twin Orders: Order A (70% lot size) + Order B (30% lot size).
2. When Target 1 (${ticket.tp1}) is hit, close Order A and move Order B Stop Loss to Breakeven (${ticket.entry})!
3. Target 2 (${ticket.tp2}) runs with 100% ZERO RISK.`;

    navigator.clipboard.writeText(text);
    setCopiedId(idx);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleSimulate = (action) => {
    const res = simulateLifecycleAction(action, currentPrice);
    if (onLifecycleChange) onLifecycleChange(res);
  };

  // Find matching blueprint for active strategy
  const activeBlueprint = strategyBlueprints.find((b) => b.strategy_id === activeStrat.id) || strategyBlueprints[0] || {
    side: activeStrat.direction,
    entry: currentPrice,
    sl: activeStrat.direction === 'BUY' ? currentPrice - 3.5 : currentPrice + 3.5,
    tp1: activeStrat.direction === 'BUY' ? currentPrice + 4.5 : currentPrice - 4.5,
    tp2: activeStrat.direction === 'BUY' ? currentPrice + 9.0 : currentPrice - 9.0,
  };

  return (
    <div className="bg-[#FBF6EF] border border-[#0D0D0C]/15 rounded-[7px] overflow-hidden flex flex-col h-full font-sans shadow-[0_2px_12px_rgba(13,13,12,0.04)]">
      {/* 1. Header Toolbar */}
      <div className="px-4 sm:px-5 py-3 border-b border-[#0D0D0C]/12 flex flex-wrap items-center justify-between gap-2 bg-[#FBF6EF]">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#3FB874] animate-pulse"></div>
          <div>
            <h3 className="font-semibold text-[#0D0D0C] text-sm sm:text-base tracking-tight flex items-center gap-1.5 font-headline">
              <Zap className="w-4 h-4 text-[#0D0D0C] fill-[#E9C22E]" />
              MT5 Signals & Strategies
            </h3>
            <span className="text-[12px] text-[#0D0D0C]/56 font-normal hidden sm:inline">
              XAUUSD (Gold Spot) • Institutional Order Flow Engine
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowTester((v) => !v)}
            className="text-[10px] font-medium px-2 py-0.5 rounded-[5px] bg-[#F4EFE6] hover:bg-[#0D0D0C] hover:text-[#FBF6EF] text-[#0D0D0C] border border-[#0D0D0C]/15 font-mono transition duration-300"
            title="Toggle Lifecycle Testing Bar"
          >
            {showTester ? 'Hide Test' : '⚡ Test Lifecycle'}
          </button>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-[5px] bg-[#F4EFE6] text-[#0D0D0C] border border-[#0D0D0C]/12 font-mono">
            @tradingboyorderbot
          </span>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-[5px] bg-[#DFE9D4] text-[#0D0D0C] border border-[#0D0D0C]/12 font-mono">
            🇮🇳 IST
          </span>
        </div>
      </div>

      {/* Interactive Lifecycle Simulator Toolbar */}
      {showTester && (
        <div className="p-2.5 bg-[#F4EFE6] border-b border-[#0D0D0C]/12 flex flex-wrap items-center justify-between gap-1.5 text-xs font-mono">
          <span className="font-medium text-[#0D0D0C] text-[11px] flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-[#0D0D0C]" />
            <span>Interactive Simulator:</span>
          </span>
          <div className="flex flex-wrap items-center gap-1">
            <button
              onClick={() => handleSimulate('PRE_ALERT')}
              className="px-2 py-1 rounded-[5px] bg-[#F4EBC6] hover:bg-[#0D0D0C] hover:text-[#FBF6EF] text-[#0D0D0C] font-semibold text-[10px] border border-[#0D0D0C]/15 transition duration-300"
              title="Simulate 30-min advance heads-up pre-alert"
            >
              0. Pre-Alert (30m)
            </button>
            <button
              onClick={() => handleSimulate('ARM_TRADE')}
              className="px-2 py-1 rounded-[5px] bg-[#FBF6EF] hover:bg-[#0D0D0C] hover:text-[#FBF6EF] text-[#0D0D0C] font-semibold border border-[#0D0D0C]/20 text-[10px] transition duration-300"
            >
              1. Arm Trade
            </button>
            <button
              onClick={() => handleSimulate('TP1')}
              className="px-2 py-1 rounded-[5px] bg-[#DFE9D4] hover:bg-[#0D0D0C] hover:text-[#FBF6EF] text-[#0D0D0C] font-semibold text-[10px] border border-[#0D0D0C]/15 transition duration-300"
            >
              2. Hit TP1 (+0.70% & BE)
            </button>
            <button
              onClick={() => handleSimulate('TP2')}
              className="px-2 py-1 rounded-[5px] bg-[#DFE9D4] hover:bg-[#0D0D0C] hover:text-[#FBF6EF] text-[#0D0D0C] font-semibold text-[10px] border border-[#0D0D0C]/15 transition duration-300"
            >
              3. Hit TP2 (+1.15% Win)
            </button>
            <button
              onClick={() => handleSimulate('BE')}
              className="px-2 py-1 rounded-[5px] bg-[#F4EBC6] hover:bg-[#0D0D0C] hover:text-[#FBF6EF] text-[#0D0D0C] font-semibold text-[10px] border border-[#0D0D0C]/15 transition duration-300"
            >
              4. BE Exit (+0.70% Kept)
            </button>
            <button
              onClick={() => handleSimulate('SL')}
              className="px-2 py-1 rounded-[5px] bg-[#F8DCC7] hover:bg-[#0D0D0C] hover:text-[#FBF6EF] text-[#0D0D0C] font-semibold text-[10px] border border-[#0D0D0C]/15 transition duration-300"
            >
              5. Hit SL (-0.50%)
            </button>
            <button
              onClick={() => handleSimulate('RESET')}
              className="px-2 py-1 rounded-[5px] bg-[#FBF6EF] hover:bg-[#0D0D0C] hover:text-[#FBF6EF] text-[#0D0D0C] font-semibold text-[10px] border border-[#0D0D0C]/15 transition duration-300"
              title="Reset state to flat"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Latest Lifecycle Event Notification Banner */}
      {latestEvent && (
        <div className="px-4 py-2.5 grad-peach border-b border-[#0D0D0C]/12 flex items-center justify-between gap-2 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#0D0D0C] animate-pulse"></span>
            <div>
              <span className="font-semibold text-[#0D0D0C] block">{latestEvent.headline}</span>
              {latestEvent.subtext && (
                <span className="text-[10px] text-[#0D0D0C]/56 font-sans">
                  {latestEvent.subtext}
                </span>
              )}
            </div>
          </div>
          <span className="text-[10px] text-[#0D0D0C] font-medium shrink-0">{latestEvent.time}</span>
        </div>
      )}

      {/* 2. Top Navigation Tabs: Live Signal | Strategy | History */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 px-3 sm:px-4 py-2 bg-[#F4EFE6] border-b border-[#0D0D0C]/12 w-full">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveTab('live')}
            className={`px-3 py-1.5 rounded-[5px] text-xs transition duration-300 flex items-center gap-1.5 ${
              activeTab === 'live'
                ? 'bg-[#0D0D0C] text-[#FBF6EF] font-semibold'
                : 'bg-[#FBF6EF] text-[#0D0D0C]/70 hover:text-[#0D0D0C] border border-[#0D0D0C]/15 font-medium'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${activeTab === 'live' ? 'text-[#E9C22E]' : 'text-[#0D0D0C]'}`} />
            <span>Live Signal</span>
            {activeTrades.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-[#3FB874] animate-ping"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('strategy')}
            className={`px-3 py-1.5 rounded-[5px] text-xs transition duration-300 flex items-center gap-1.5 ${
              activeTab === 'strategy'
                ? 'bg-[#0D0D0C] text-[#FBF6EF] font-semibold'
                : 'bg-[#FBF6EF] text-[#0D0D0C]/70 hover:text-[#0D0D0C] border border-[#0D0D0C]/15 font-medium'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Strategy</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-[5px] text-xs transition duration-300 flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-[#0D0D0C] text-[#FBF6EF] font-semibold'
                : 'bg-[#FBF6EF] text-[#0D0D0C]/70 hover:text-[#0D0D0C] border border-[#0D0D0C]/15 font-medium'
            }`}
          >
            <span>History</span>
            <span
              className={`px-1.5 py-0.2 rounded-[5px] text-[10px] font-mono ${
                activeTab === 'history' ? 'bg-[#FBF6EF] text-[#0D0D0C]' : 'bg-[#0D0D0C]/10 text-[#0D0D0C]'
              }`}
            >
              {recentTrades.length}
            </span>
          </button>
        </div>

        {/* Live Net Today P&L % Display */}
        <div className="text-right text-xs font-mono font-medium hidden xs:block">
          <span className="text-[#0D0D0C]/56 text-[11px] font-sans">Today: </span>
          <span className={todayPnl.startsWith('+') ? 'text-[#3FB874] font-bold' : 'text-[#F2772F] font-bold'}>
            {todayPnl}
          </span>
          <span className="text-[#0D0D0C]/42 text-[10px] ml-1">({tradesCount}/{maxTrades})</span>
        </div>
      </div>

      {/* 3. Tab Contents */}

      {/* TAB 1: LIVE SIGNAL */}
      {activeTab === 'live' && (
        <div className="p-3 sm:p-4 overflow-y-auto flex-1 space-y-3">
          {activeTrades.length > 0 ? (
            /* Active Live Position Card */
            activeTrades.map((at, idx) => {
              const isAtTP1 = at.stage === 'TP1_BANKED_BE_ACTIVE' || at.be_alerted === true;
              const isBuy = at.side === 'BUY';

              return (
                <div
                  key={idx}
                  className="p-4 sm:p-5 rounded-[7px] border-2 border-[#0D0D0C] bg-[#FBF6EF] shadow-[0_2px_12px_rgba(13,13,12,0.05)]"
                >
                  {/* Header: Side & Status */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5 pb-3 border-b border-[#0D0D0C]/12">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#3FB874] animate-ping"></span>
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-[5px] text-[#FBF6EF] font-mono tracking-tight bg-[#0D0D0C]`}
                      >
                        ACTIVE SIGNAL: {at.side} XAUUSD
                      </span>
                      <span className="text-xs font-semibold text-[#0D0D0C] font-headline">
                        {at.strategy || 'AMT 80% Value Area Rule'}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono font-medium">
                      {isAtTP1 ? (
                        <span className="px-2.5 py-1 rounded-[5px] bg-[#DFE9D4] text-[#0D0D0C] border border-[#0D0D0C]/15 flex items-center gap-1 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#3FB874]" />
                          <span>TP1 HIT • SL AT BREAKEVEN</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-[5px] bg-[#F4EBC6] text-[#0D0D0C] border border-[#0D0D0C]/15 flex items-center gap-1 font-semibold">
                          <Activity className="w-3.5 h-3.5 text-[#0D0D0C] animate-pulse" />
                          <span>INITIAL POSITION RUNNING</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Mandatory MT5 Action Prompt */}
                  {isAtTP1 ? (
                    <div className="mb-3.5 p-3 rounded-[5px] bg-[#DFE9D4]/70 border border-[#0D0D0C]/15 text-[#0D0D0C] text-xs font-mono">
                      <div className="flex items-center gap-1.5 font-bold text-[#0D0D0C] mb-1">
                        <CheckCircle2 className="w-4 h-4 text-[#3FB874]" />
                        <span>BREAKEVEN LOCK ACTIVE (100% RISK-FREE TRADE)</span>
                      </div>
                      <p className="text-[11.5px] text-[#0D0D0C]/75 font-sans">
                        👉 <b>ACTION IN MT5:</b> Order A banked at Target 1 (+0.70%). Modify <b>Order B</b> and drag its Stop Loss to <b>Breakeven ({at.entry})</b> now!
                      </p>
                    </div>
                  ) : (
                    <div className="mb-3.5 p-3 rounded-[5px] bg-[#F4EFE6] border border-[#0D0D0C]/15 text-[#0D0D0C] text-xs font-mono">
                      <div className="flex items-center gap-1.5 font-bold text-[#0D0D0C] mb-1">
                        <Activity className="w-4 h-4 text-[#0D0D0C] animate-pulse" />
                        <span>TWIN ORDERS ACTIVE IN MT5</span>
                      </div>
                      <p className="text-[11.5px] text-[#0D0D0C]/75 font-sans">
                        👉 Place Twin Orders: <b>Order A (70% volume)</b> targeting {at.tp1} and <b>Order B (30% runner)</b> targeting {at.tp2}.
                      </p>
                    </div>
                  )}

                  {/* 3-Step Lifecycle Visual Progress Bar */}
                  <div className="mb-3.5 bg-[#F4EFE6] p-2.5 rounded-[5px] border border-[#0D0D0C]/12 font-mono text-[11px]">
                    <div className="flex items-center justify-between text-[#0D0D0C]/56 mb-1.5 text-[10px] font-sans font-medium uppercase">
                      <span>Trade Progress Stepper</span>
                      <span>Lifecycle State</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <div className="p-2 rounded-[5px] bg-[#DFE9D4] border border-[#0D0D0C]/15 text-[#0D0D0C] font-semibold">
                        <span className="block text-[9px] text-[#0D0D0C]/56">1. Entry Price</span>
                        <span className="text-sm">{at.entry}</span>
                      </div>
                      <div
                        className={`p-2 rounded-[5px] border font-semibold ${
                          isAtTP1
                            ? 'bg-[#DFE9D4] text-[#0D0D0C] border-[#0D0D0C]/25 ring-1 ring-[#0D0D0C]/20'
                            : 'bg-[#FBF6EF] text-[#0D0D0C] border-[#0D0D0C]/15'
                        }`}
                      >
                        <span className="block text-[9px] text-[#0D0D0C]/56">2. Target 1 (POC)</span>
                        <span className="text-sm">{at.tp1}</span>
                      </div>
                      <div className="p-2 rounded-[5px] bg-[#FBF6EF] border border-[#0D0D0C]/15 text-[#0D0D0C] font-semibold">
                        <span className="block text-[9px] text-[#0D0D0C]/56">3. Target 2 (Opp. VA)</span>
                        <span className="text-sm">{at.tp2}</span>
                      </div>
                    </div>
                  </div>

                  {/* Twin Orders Real-Time Breakdown */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono mb-3.5">
                    <div className="bg-[#F4EFE6] p-2.5 rounded-[5px] border border-[#0D0D0C]/12">
                      <span className="text-[10px] text-[#0D0D0C]/56 block font-sans font-medium">Order A (70% Banker):</span>
                      <span className="font-bold text-[#0D0D0C] text-sm">
                        {isAtTP1 ? '✅ Banked (+0.70%) at POC' : `Target: ${at.tp1}`}
                      </span>
                    </div>
                    <div className="bg-[#F4EFE6] p-2.5 rounded-[5px] border border-[#0D0D0C]/12">
                      <span className="text-[10px] text-[#0D0D0C]/56 block font-sans font-medium">Order B (30% Runner):</span>
                      <span className="font-bold text-[#0D0D0C] text-sm">
                        {isAtTP1 ? `Running to ${at.tp2} (SL @ Breakeven)` : `Target: ${at.tp2} (SL: ${at.sl})`}
                      </span>
                    </div>
                  </div>

                  {/* Copy Live Ticket Button */}
                  <button
                    onClick={() => handleCopyTicket(at, idx, 'LIVE SIGNAL')}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-[7px] text-xs font-semibold transition-all duration-300 bg-[#0D0D0C] text-[#FBF6EF] hover:bg-[#0D0D0C]/85 border border-[#0D0D0C] active:scale-[0.99]"
                  >
                    {copiedId === idx ? (
                      <>
                        <Check className="w-4 h-4 text-[#3FB874]" />
                        <span>Copied Live Ticket to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy MT5 Execution Ticket</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          ) : preAlert && preAlert.active ? (
            /* 30-Minute Advance Pre-Entry Alert & Preparation Card */
            <div className="grad-lemon border-2 border-[#0D0D0C] rounded-[7px] p-5 sm:p-6 shadow-[0_2px_12px_rgba(13,13,12,0.06)] font-mono">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#0D0D0C]/15 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E9C22E] animate-ping"></span>
                  <span className="px-2.5 py-0.5 rounded-[5px] bg-[#FBF6EF] text-[#0D0D0C] border border-[#0D0D0C]/15 font-bold text-xs uppercase tracking-wide">
                    ⏳ 30-Min Advance Heads-Up
                  </span>
                  <span className="text-xs font-semibold text-[#0D0D0C] font-headline">
                    {preAlert.sym} ({preAlert.side})
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-[#0D0D0C] bg-[#FBF6EF] px-2.5 py-1 rounded-[5px] border border-[#0D0D0C]/15">
                  {preAlert.est_time || preAlert.estTime || 'in ~28 mins'}
                </span>
              </div>

              <div className="space-y-3.5">
                <div>
                  <h4 className="text-base font-semibold text-[#0D0D0C] font-headline flex items-center gap-2">
                    <span>⚠️ Probable {preAlert.side === 'BUY' ? 'Bullish Reversal' : 'Bearish Rotation'} Entry Forming</span>
                  </h4>
                  <p className="text-xs text-[#0D0D0C]/75 font-sans mt-0.5">
                    {preAlert.strategy} — Price is testing {preAlert.level_name || preAlert.levelName} (${Number(preAlert.key_level || preAlert.keyLevel || 4032).toFixed(2)}). Prepare your MT5 orders in advance!
                  </p>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-[#FBF6EF] p-2.5 rounded-[5px] border border-[#0D0D0C]/15">
                    <span className="text-[10px] text-[#0D0D0C]/56 font-sans block">Current Price</span>
                    <span className="font-bold text-[#0D0D0C]">${Number(preAlert.current_price || preAlert.currentPrice || currentPrice).toFixed(2)}</span>
                  </div>
                  <div className="bg-[#FBF6EF] p-2.5 rounded-[5px] border border-[#0D0D0C]/15">
                    <span className="text-[10px] text-[#0D0D0C]/56 font-sans block">Watch Level</span>
                    <span className="font-bold text-[#0D0D0C]">${Number(preAlert.key_level || preAlert.keyLevel || 4032).toFixed(2)}</span>
                  </div>
                  <div className="bg-[#FBF6EF] p-2.5 rounded-[5px] border border-[#0D0D0C]/15">
                    <span className="text-[10px] text-[#0D0D0C]/56 font-sans block">Order A (70% Banker)</span>
                    <span className="font-bold text-[#0D0D0C]">{preAlert.lots_a || preAlert.lotsA || 0.04} lots (TP1)</span>
                  </div>
                  <div className="bg-[#FBF6EF] p-2.5 rounded-[5px] border border-[#0D0D0C]/15">
                    <span className="text-[10px] text-[#0D0D0C]/56 font-sans block">Order B (30% Runner)</span>
                    <span className="font-bold text-[#0D0D0C]">{preAlert.lots_b || preAlert.lotsB || 0.03} lots (TP2)</span>
                  </div>
                </div>

                {/* Preparation Steps Box */}
                <div className="bg-[#FBF6EF] border border-[#0D0D0C]/15 rounded-[5px] p-3 text-xs font-sans space-y-1.5 text-[#0D0D0C]">
                  <span className="font-bold font-mono text-[11px] text-[#0D0D0C] uppercase tracking-wide block">
                    📋 Advance Preparation Checklist (Do this now):
                  </span>
                  <div className="flex items-start gap-1.5">
                    <span className="text-[#0D0D0C] font-bold font-mono">1.</span>
                    <span><b>Free yourself:</b> Ensure 5–10 minutes of uninterrupted focus for the upcoming candle close.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-[#0D0D0C] font-bold font-mono">2.</span>
                    <span><b>Open MT5:</b> Bring up <b>XAUUSD (Gold)</b> order execution window on phone or PC.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-[#0D0D0C] font-bold font-mono">3.</span>
                    <span><b>Pre-fill Lot Sizes:</b> Pre-type Order A ({preAlert.lots_a || preAlert.lotsA || 0.04} lots) and Order B ({preAlert.lots_b || preAlert.lotsB || 0.03} lots).</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-[#0D0D0C] font-bold font-mono">4.</span>
                    <span><b>Stand By:</b> Official confirmed execution ticket will automatically arrive in Telegram & WebApp at candle close!</span>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => handleSimulate('CLEAR_PRE_ALERT')}
                    className="px-3 py-1.5 rounded-[5px] bg-[#FBF6EF] hover:bg-[#0D0D0C] hover:text-[#FBF6EF] text-[#0D0D0C] font-medium text-xs border border-[#0D0D0C]/15 transition duration-300"
                  >
                    Dismiss Notice
                  </button>
                  <button
                    onClick={() => handleSimulate('ARM_TRADE')}
                    className="px-3.5 py-1.5 rounded-[5px] bg-[#0D0D0C] hover:bg-[#0D0D0C]/85 text-[#FBF6EF] font-semibold text-xs transition duration-300 flex items-center gap-1.5"
                  >
                    <Zap className="w-3.5 h-3.5 text-[#E9C22E]" />
                    <span>Arm Trade Now</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Clean Minimalist Flat Status State */
            <div className="bg-[#FBF6EF] border border-[#0D0D0C]/15 rounded-[7px] p-6 sm:p-8 text-center font-mono">
              <div className="w-12 h-12 rounded-[7px] bg-[#F4EFE6] text-[#0D0D0C] border border-[#0D0D0C]/15 flex items-center justify-center mx-auto mb-3.5 shadow-xs">
                <Shield className="w-6 h-6" />
              </div>
              <h4 className="text-base sm:text-lg font-semibold text-[#0D0D0C] font-headline mb-1">
                No Active Signal — Market 100% Flat
              </h4>
              <p className="text-xs text-[#0D0D0C]/56 font-sans max-w-md mx-auto mb-5 leading-relaxed">
                The institutional engine is scanning Gold (XAUUSD) order flow clusters. A signal is triggered only when high-probability auction imbalance is verified.
              </p>

              {/* Status Metric Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs max-w-lg mx-auto mb-4">
                <div className="bg-[#F4EFE6] p-2.5 rounded-[5px] border border-[#0D0D0C]/12">
                  <span className="text-[10px] text-[#0D0D0C]/56 font-sans block font-medium">Daily Target</span>
                  <span className="font-bold text-[#3FB874]">+2.0% - 3.0%</span>
                </div>
                <div className="bg-[#F4EFE6] p-2.5 rounded-[5px] border border-[#0D0D0C]/12">
                  <span className="text-[10px] text-[#0D0D0C]/56 font-sans block font-medium">Capital Guard</span>
                  <span className="font-bold text-[#0D0D0C]">Safe (-2.5%)</span>
                </div>
                <div className="bg-[#F4EFE6] p-2.5 rounded-[5px] border border-[#0D0D0C]/12">
                  <span className="text-[10px] text-[#0D0D0C]/56 font-sans block font-medium">Daily Pacing</span>
                  <span className="font-bold text-[#0D0D0C]">{tradesCount} / {maxTrades} Taken</span>
                </div>
                <div className="bg-[#F4EFE6] p-2.5 rounded-[5px] border border-[#0D0D0C]/12">
                  <span className="text-[10px] text-[#0D0D0C]/56 font-sans block font-medium">Scan Schedule</span>
                  <span className="font-bold text-[#0D0D0C]">:31 Hourly</span>
                </div>
              </div>

              <div className="text-[12px] text-[#0D0D0C]/56 font-sans">
                Automatic Telegram alerts active at <span className="font-mono text-[#0D0D0C] font-semibold underline decoration-[#0D0D0C]/30">@tradingboyorderbot</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: STRATEGY */}
      {activeTab === 'strategy' && (
        <div className="p-3 sm:p-4 overflow-y-auto flex-1 space-y-4">
          {/* Strategy Selector Segmented Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {STRATEGIES.map((strat) => {
              const active = strat.id === activeStrategyId;
              return (
                <button
                  key={strat.id}
                  onClick={() => setActiveStrategyId(strat.id)}
                  className={`text-left p-3 rounded-[7px] transition-all duration-300 border text-xs ${
                    active
                      ? 'bg-[#0D0D0C] text-[#FBF6EF] border-[#0D0D0C] font-semibold shadow-sm'
                      : 'bg-[#FBF6EF] text-[#0D0D0C]/70 border-[#0D0D0C]/15 hover:bg-[#F4EFE6] hover:text-[#0D0D0C]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs font-headline">
                      {strat.number}. {strat.name.split(' ')[0]}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-[5px] font-mono font-bold ${
                        active ? 'bg-[#FBF6EF] text-[#0D0D0C]' : 'bg-[#F4EFE6] text-[#0D0D0C]'
                      }`}
                    >
                      {strat.winRatePOC} Win
                    </span>
                  </div>
                  <div className={`text-[11px] truncate ${active ? 'text-[#FBF6EF]/75' : 'text-[#0D0D0C]/56'}`}>{strat.name}</div>
                </button>
              );
            })}
          </div>

          {/* Strategy Details Card */}
          <div className="bg-[#F4EFE6] border border-[#0D0D0C]/15 rounded-[7px] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-[#0D0D0C]/12">
              <div>
                <span className="text-[10.5px] font-mono text-[#3FB874] uppercase tracking-wider font-bold">
                  Strategy {activeStrat.number} • {activeStrat.tag}
                </span>
                <h4 className="text-base sm:text-lg font-semibold text-[#0D0D0C] font-headline">{activeStrat.name}</h4>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono text-[#0D0D0C]/56 block font-sans">Avg Reward : Risk</span>
                <span className="text-sm font-bold text-[#0D0D0C] font-mono">{activeStrat.avgRR}</span>
              </div>
            </div>

            <p className="text-xs text-[#0D0D0C]/75 font-sans mb-4 leading-relaxed">
              {activeStrat.description}
            </p>

            {/* 3 Quality-Control Confirmation Gates */}
            {activeStrat.gates && activeStrat.gates.length > 0 && (
              <div className="mb-4 bg-[#DFE9D4]/70 border border-[#0D0D0C]/15 rounded-[7px] p-3">
                <span className="text-[10.5px] font-bold uppercase text-[#0D0D0C] tracking-wider block mb-2 font-mono">
                  🛡️ 3 Quality-Control Gates for 85%+ Win Rate
                </span>
                <div className="space-y-1.5 text-[11px] font-mono">
                  {activeStrat.gates.map((g, gi) => (
                    <div key={gi} className="flex items-center gap-2 text-[#0D0D0C] bg-[#FBF6EF] px-2.5 py-1.5 rounded-[5px] border border-[#0D0D0C]/12">
                      <span>{g}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Strategy KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono mb-4">
              <div className="bg-[#FBF6EF] p-2.5 rounded-[5px] border border-[#0D0D0C]/15">
                <span className="text-[9px] text-[#0D0D0C]/56 block font-sans">Target 1 Win Rate</span>
                <span className="text-sm font-bold text-[#3FB874]">{activeStrat.winRatePOC}</span>
                <span className="text-[9px] text-[#0D0D0C]/42 block truncate">Scale 70% Off</span>
              </div>

              <div className="bg-[#FBF6EF] p-2.5 rounded-[5px] border border-[#0D0D0C]/15">
                <span className="text-[9px] text-[#0D0D0C]/56 block font-sans">Full Target Win</span>
                <span className="text-sm font-bold text-[#3FB874]">{activeStrat.winRateFull}</span>
                <span className="text-[9px] text-[#0D0D0C]/42 block truncate">30% Runner</span>
              </div>

              <div className="bg-[#FBF6EF] p-2.5 rounded-[5px] border border-[#0D0D0C]/15">
                <span className="text-[9px] text-[#0D0D0C]/56 block font-sans">Defined Stop Risk</span>
                <span className="text-sm font-bold text-[#F2772F]">{activeStrat.riskPips}</span>
                <span className="text-[9px] text-[#0D0D0C]/42 block truncate">Max 0.5% - 1.0%</span>
              </div>

              <div className="bg-[#FBF6EF] p-2.5 rounded-[5px] border border-[#0D0D0C]/15">
                <span className="text-[9px] text-[#0D0D0C]/56 block font-sans">Footprint Confluence</span>
                <span className="text-xs font-bold text-[#0D0D0C] truncate block">
                  {activeStrat.footprintDelta}
                </span>
                <span className="text-[9px] text-[#0D0D0C]/42 block truncate">Imbalance Shift</span>
              </div>
            </div>

            {/* Theoretical & Execution Specs */}
            <div className="bg-[#FBF6EF] p-3 rounded-[5px] border border-[#0D0D0C]/15 text-xs font-mono space-y-1.5 mb-4">
              <div className="flex items-center justify-between text-[#0D0D0C]">
                <span className="text-[#0D0D0C]/56 font-sans">Context Timeframe:</span>
                <span className="font-semibold">{activeStrat.contextTf}</span>
              </div>
              <div className="flex items-center justify-between text-[#0D0D0C]">
                <span className="text-[#0D0D0C]/56 font-sans">Execution Timeframe:</span>
                <span className="font-semibold">{activeStrat.execTf}</span>
              </div>
              <div className="flex items-center justify-between text-[#0D0D0C]">
                <span className="text-[#0D0D0C]/56 font-sans">Daily Frequency:</span>
                <span className="font-semibold">{activeStrat.dailyFreq}</span>
              </div>
            </div>

            {/* Calculated Strategy Blueprint & Watchlist Levels */}
            <div className="bg-[#FBF6EF] border border-[#0D0D0C]/15 rounded-[7px] p-3.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-[5px] bg-[#F4EBC6] text-[#0D0D0C] border border-[#0D0D0C]/15 font-mono">
                  Calculated Strategy Blueprint Levels
                </span>
                <span className="text-xs font-bold text-[#0D0D0C] font-mono">
                  {activeBlueprint.side} XAUUSD
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs mb-3 bg-[#F4EFE6] p-2.5 rounded-[5px] border border-[#0D0D0C]/12">
                <div>
                  <span className="text-[10px] text-[#0D0D0C]/56 font-sans block">Entry Price</span>
                  <span className="font-bold text-[#0D0D0C] text-sm">{activeBlueprint.entry}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#0D0D0C]/56 font-sans block">Stop Loss</span>
                  <span className="font-bold text-[#F2772F] text-sm">{activeBlueprint.sl}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#0D0D0C]/56 font-sans block truncate">
                    Target 1 ({activeStrat.winRatePOC})
                  </span>
                  <span className="font-bold text-[#3FB874] text-sm">{activeBlueprint.tp1}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#0D0D0C]/56 font-sans block truncate">
                    Target 2 ({activeStrat.winRateFull})
                  </span>
                  <span className="font-bold text-[#3FB874] text-sm">{activeBlueprint.tp2}</span>
                </div>
              </div>

              <button
                onClick={() => handleCopyTicket(activeBlueprint, 'strat-bp', 'STRATEGY BLUEPRINT')}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-[5px] text-xs font-medium transition duration-300 bg-[#F4EFE6] hover:bg-[#0D0D0C] hover:text-[#FBF6EF] text-[#0D0D0C] border border-[#0D0D0C]/15 active:scale-[0.99]"
              >
                {copiedId === 'strat-bp' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#3FB874]" />
                    <span>Copied Blueprint to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Strategy Blueprint (For Limit Orders / Price Alerts)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: HISTORY */}
      {activeTab === 'history' && (
        <div className="p-3 sm:p-4 overflow-y-auto flex-1 space-y-3 font-sans">
          {/* History Header Toolbar */}
          <div className="flex items-center justify-between pb-2 border-b border-[#0D0D0C]/12">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#0D0D0C] font-mono">
                COMPLETED TRADES LOG ({recentTrades.length})
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-[5px] bg-[#DFE9D4] text-[#0D0D0C] font-mono font-semibold border border-[#0D0D0C]/15">
                P&L: {todayPnl}
              </span>
            </div>

            {recentTrades.length > 0 && (
              <button
                onClick={() => {
                  clearTradeHistory();
                  if (onLifecycleChange) onLifecycleChange({ type: 'CLEAR_HISTORY' });
                }}
                className="text-[10px] font-medium px-2 py-1 rounded-[5px] bg-[#F4EFE6] hover:bg-[#F8DCC7] text-[#0D0D0C] border border-[#0D0D0C]/15 transition flex items-center gap-1 font-mono"
                title="Clear completed trade logs"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear History</span>
              </button>
            )}
          </div>

          {recentTrades.length === 0 ? (
            <div className="text-center py-12 text-[#0D0D0C]/42 font-mono text-xs bg-[#F4EFE6]/50 rounded-[7px] border border-dashed border-[#0D0D0C]/15">
              <Shield className="w-8 h-8 text-[#0D0D0C]/30 mx-auto mb-2" />
              <p className="font-semibold text-[#0D0D0C] text-sm">No completed trades yet today.</p>
              <p className="text-[11px] text-[#0D0D0C]/56 mt-1">Trades will automatically record here when they hit Target 1, Target 2, Breakeven, or Stop Loss.</p>
            </div>
          ) : (
            recentTrades.map((rt, idx) => {
              const isTP2 = rt.close_reason === 'TP2_HIT' || rt.close_reason === 'MANUAL_WIN' || rt.stage === 'TP2_HIT';
              const isTP1 = rt.close_reason === 'TP1_SINGLE_HIT' || rt.close_reason === 'TP1_HIT' || rt.stage === 'TP1_HIT';
              const isBE = rt.close_reason === 'BE_EXIT' || rt.close_reason === 'MANUAL_BE' || rt.stage === 'BE_EXIT';
              const isLoss = rt.close_reason === 'SL_HIT' || rt.close_reason === 'MANUAL_LOSS' || rt.stage === 'SL_HIT';
              const isBuy = rt.side === 'BUY';

              const entryVal = Number(rt.entry || 0).toFixed(2);
              const exitVal = rt.exit_price != null ? Number(rt.exit_price).toFixed(2) : entryVal;
              const timeVal = rt.exit_time || rt.exit_time_ist || rt.time || getISTTimeStr();

              return (
                <div
                  key={idx}
                  className="bg-[#FBF6EF] border border-[#0D0D0C]/15 hover:border-[#0D0D0C]/35 rounded-[7px] p-3 sm:p-3.5 shadow-xs font-mono text-xs flex flex-wrap items-center justify-between gap-3 transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-[5px] text-[#FBF6EF] bg-[#0D0D0C]`}
                      >
                        {rt.side} {rt.sym || 'XAUUSD'}
                      </span>
                      <span className="text-xs font-semibold text-[#0D0D0C] font-sans">
                        {rt.strategy || 'AMT 80% Value Area Rule'}
                      </span>
                    </div>

                    <div className="text-[11px] text-[#0D0D0C]/75 flex flex-wrap items-center gap-2">
                      <span>Entry: <b className="text-[#0D0D0C]">${entryVal}</b></span>
                      <span>•</span>
                      <span>Exit: <b className="text-[#0D0D0C]">${exitVal}</b></span>
                      <span>•</span>
                      <span className="text-[#0D0D0C]/42 text-[10px]">{timeVal}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {isTP2 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[5px] bg-[#DFE9D4] text-[#0D0D0C] font-semibold border border-[#0D0D0C]/15">
                        🏆 Full Target Hit (+1.15%)
                      </span>
                    )}
                    {isTP1 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[5px] bg-[#DFE9D4] text-[#0D0D0C] font-semibold border border-[#0D0D0C]/15">
                        🎯 Target 1 Banked (+0.70%)
                      </span>
                    )}
                    {isBE && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[5px] bg-[#F4EBC6] text-[#0D0D0C] font-semibold border border-[#0D0D0C]/15">
                        ⚖️ Runner @ Breakeven (+0.70% Kept)
                      </span>
                    )}
                    {isLoss && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[5px] bg-[#F8DCC7] text-[#0D0D0C] font-semibold border border-[#0D0D0C]/15">
                        🛑 Hard SL Hit (-0.50%)
                      </span>
                    )}
                    {!isTP2 && !isTP1 && !isBE && !isLoss && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[5px] bg-[#F4EFE6] text-[#0D0D0C] font-semibold border border-[#0D0D0C]/15">
                        Closed ({rt.total_gain_pct >= 0 ? '+' : ''}{rt.total_gain_pct || 0}%)
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 4. Footer Policy Note */}
      <div className="p-3 bg-[#F4EFE6] border-t border-[#0D0D0C]/12 text-[10.5px] text-[#0D0D0C]/56 flex flex-wrap items-center justify-between gap-2 font-mono">
        <span>Daily Target: +2.0% - 3.0% / Day</span>
        <span>•</span>
        <span>Capital Guard Limit: -2.5%</span>
        <span>•</span>
        <span>Max 3 Trades/Day</span>
        <span>•</span>
        <span className="font-bold text-[#0D0D0C]">TRADING BOY GOLD ONLY</span>
      </div>
    </div>
  );
}
