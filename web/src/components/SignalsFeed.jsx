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
} from 'lucide-react';
import { simulateLifecycleAction } from '../services/liveMarketService';

const STRATEGIES = [
  {
    id: 'amt_80',
    number: '1',
    name: 'AMT 80% Value Area Rule',
    tag: 'Highest Win Rate (76% - 82%)',
    winRatePOC: '82%',
    winRateFull: '76%',
    avgRR: '1 : 2.3',
    riskPips: '$6.00 (60 pips)',
    footprintDelta: '+1,450',
    footprintDetail: 'Ask 3,100 x Bid 1,650 (Absorption at Top)',
    contextTf: '30-Min / 15-Min (Prior Day VP)',
    execTf: '5-Min Footprint Chart',
    dailyFreq: '1 to 2 trades/day (London or NY Open)',
    description:
      'Trades failed breakouts using Auction Market Theory. Breakouts above VAH or below VAL fail ~80% of the time, rotating back to POC (Target 1: 82% Win Rate) and Opposite VA (Full Target: 76% Win Rate).',
    direction: 'SELL',
    setupType: 'Failed Auction / Value Rotation',
    target1Name: 'Rotation to POC (70% Scale-Out)',
    target2Name: 'Opposite VA Rotation (30% Runner)',
  },
  {
    id: 'vwap_fade',
    number: '2',
    name: 'VWAP 2-SD Absorption Fade',
    tag: 'High Probability (70% - 75%)',
    winRatePOC: '75%',
    winRateFull: '68%',
    avgRR: '1 : 1.8 to 1 : 2.2',
    riskPips: '$2.50 to $3.50 (25-35 pips)',
    footprintDelta: '-1,180 (CVD Divergence)',
    footprintDetail: '3:1 Sell Imbalance Flip at +2σ Band',
    contextTf: '15-Min / 5-Min (Session VWAP ±2σ Bands)',
    execTf: '5-Min or 1-Min Footprint + CVD',
    dailyFreq: '2 to 3 trades/day (Across London & NY)',
    description:
      'Fades intraday overextensions away from Session VWAP. 95.4% of volume stays inside the ±2σ bands. Enters when footprint prints a 3:1 imbalance flip with CVD absorption.',
    direction: 'SELL',
    setupType: 'Mean-Reversion Overextension Fade',
    target1Name: 'Central VWAP Line (70% Scale-Out)',
    target2Name: 'Opposite ±1σ Band (30% Runner)',
  },
  {
    id: 'lvn_pullback',
    number: '3',
    name: 'LVN Trend Pullback',
    tag: 'Highest R:R (1 : 2.5 to 1 : 4.0+)',
    winRatePOC: '65%',
    winRateFull: '58%',
    avgRR: '1 : 2.5 to 1 : 4.0+',
    riskPips: '$2.00 to $3.00 (20-30 pips)',
    footprintDelta: '+2,850 (Trend Continuation)',
    footprintDetail: 'Stacked Buying Imbalance (300%+) at LVN',
    contextTf: '15-Min (Developing Session Profile)',
    execTf: '5-Min or 3-Min Footprint Imbalance',
    dailyFreq: '1 to 3 trades/day (Only on Trend Days, ~25% of week)',
    description:
      'Trend continuation entry for runaway trend days (CPI, NFP, Fed rates). Price breaks violently out of value, leaving a Low Volume Node (LVN) valley. Enters on pullback reload into LVN.',
    direction: 'BUY',
    setupType: 'Institutional Trend Continuation',
    target1Name: 'Recent Swing High (70% Scale-Out)',
    target2Name: 'Trend Expansion Wave (30% Runner)',
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
    <div className="bg-white border border-slate-200 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden flex flex-col h-full font-sans">
      {/* 1. Header Toolbar */}
      <div className="px-4 sm:px-5 py-3 border-b border-slate-200/90 flex flex-wrap items-center justify-between gap-2 bg-white">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm tracking-tight flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
              MT5 Signals & Strategies
            </h3>
            <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
              XAUUSD (Gold Spot) • Institutional Order Flow Engine
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTester((v) => !v)}
            className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-mono transition"
            title="Toggle Lifecycle Testing Bar"
          >
            {showTester ? 'Hide Test' : '⚡ Test Lifecycle'}
          </button>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-mono">
            @tradingboyorderbot
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
            🇮🇳 IST
          </span>
        </div>
      </div>

      {/* Interactive Lifecycle Simulator Toolbar (Allows 1-Click Verification of SL, TP1, BE, TP2) */}
      {showTester && (
        <div className="p-2.5 bg-blue-50/90 border-b border-blue-200 flex flex-wrap items-center justify-between gap-1.5 text-xs font-mono">
          <span className="font-bold text-blue-900 text-[11px] flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Interactive Lifecycle Simulator:</span>
          </span>
          <div className="flex flex-wrap items-center gap-1">
            <button
              onClick={() => handleSimulate('ARM_TRADE')}
              className="px-2 py-1 rounded bg-white hover:bg-slate-100 text-slate-800 font-bold border border-slate-300 text-[10px] transition"
            >
              1. Arm Trade
            </button>
            <button
              onClick={() => handleSimulate('TP1')}
              className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] shadow-xs transition"
            >
              2. Hit TP1 (+0.70% & BE)
            </button>
            <button
              onClick={() => handleSimulate('TP2')}
              className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] shadow-xs transition"
            >
              3. Hit TP2 (+1.15% Win)
            </button>
            <button
              onClick={() => handleSimulate('BE')}
              className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] shadow-xs transition"
            >
              4. BE Exit (+0.70% Kept)
            </button>
            <button
              onClick={() => handleSimulate('SL')}
              className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] shadow-xs transition"
            >
              5. Hit SL (-0.50%)
            </button>
            <button
              onClick={() => handleSimulate('RESET')}
              className="px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10px] transition"
              title="Reset state to flat"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Latest Lifecycle Event Notification Banner */}
      {latestEvent && (
        <div className="px-4 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200/80 flex items-center justify-between gap-2 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
            <div>
              <span className="font-extrabold text-blue-950 block">{latestEvent.headline}</span>
              {latestEvent.subtext && (
                <span className="text-[10px] text-blue-800 font-sans font-medium">
                  {latestEvent.subtext}
                </span>
              )}
            </div>
          </div>
          <span className="text-[10px] text-blue-600 font-bold shrink-0">{latestEvent.time}</span>
        </div>
      )}

      {/* 2. Top Navigation Tabs: Live Signal | Strategy | History */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 px-2.5 sm:px-4 py-2 bg-slate-50 border-b border-slate-200 w-full">
        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
          <button
            onClick={() => setActiveTab('live')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 sm:gap-1.5 ${
              activeTab === 'live'
                ? 'bg-blue-600 text-white shadow-sm font-extrabold'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${activeTab === 'live' ? 'text-amber-300' : 'text-amber-500'}`} />
            <span>Live Signal</span>
            {activeTrades.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('strategy')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 sm:gap-1.5 ${
              activeTab === 'strategy'
                ? 'bg-blue-600 text-white shadow-sm font-extrabold'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Strategy</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 sm:gap-1.5 ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white shadow-sm font-extrabold'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <span>History</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'history' ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {recentTrades.length}
            </span>
          </button>
        </div>

        {/* Live Net Today P&L % Display */}
        <div className="text-right text-xs font-mono font-bold hidden xs:block">
          <span className="text-slate-400 text-[10px] font-sans">Today's P&L: </span>
          <span className={todayPnl.startsWith('+') ? 'text-emerald-600 font-black' : 'text-rose-600 font-black'}>
            {todayPnl}
          </span>
          <span className="text-slate-400 text-[10px] ml-1">({tradesCount}/{maxTrades})</span>
        </div>
      </div>

      {/* 3. Tab Contents */}

      {/* TAB 1: LIVE SIGNAL (Shows ONLY the active trade or clean flat status — NO blueprints here!) */}
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
                  className="p-4 sm:p-5 rounded-2xl border-2 border-emerald-500 bg-white shadow-md ring-2 ring-emerald-500/15"
                >
                  {/* Header: Side & Status */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                      <span
                        className={`text-xs font-black px-2.5 py-1 rounded-md text-white font-mono tracking-tight ${
                          isBuy ? 'bg-emerald-600' : 'bg-rose-600'
                        }`}
                      >
                        ACTIVE SIGNAL: {at.side} XAUUSD
                      </span>
                      <span className="text-xs font-bold text-slate-800 font-sans">
                        {at.strategy || 'AMT 80% Value Area Rule'}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono font-bold">
                      {isAtTP1 ? (
                        <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>TP1 HIT • SL AT BREAKEVEN</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-md bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1">
                          <Activity className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                          <span>INITIAL POSITION RUNNING</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Mandatory MT5 Action Prompt */}
                  {isAtTP1 ? (
                    <div className="mb-3.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs font-mono">
                      <div className="flex items-center gap-1.5 font-black text-emerald-900 mb-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>BREAKEVEN LOCK ACTIVE (100% RISK-FREE TRADE)</span>
                      </div>
                      <p className="text-[11px] text-emerald-800 font-sans">
                        👉 <b>ACTION IN MT5:</b> Order A banked at Target 1 (+0.70%). Modify <b>Order B</b> and drag its Stop Loss to <b>Breakeven ({at.entry})</b> now!
                      </p>
                    </div>
                  ) : (
                    <div className="mb-3.5 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-950 text-xs font-mono">
                      <div className="flex items-center gap-1.5 font-black text-blue-900 mb-1">
                        <Activity className="w-4 h-4 text-blue-600 animate-pulse" />
                        <span>TWIN ORDERS ACTIVE IN MT5</span>
                      </div>
                      <p className="text-[11px] text-blue-800 font-sans">
                        👉 Place Twin Orders: <b>Order A (70% volume)</b> targeting {at.tp1} and <b>Order B (30% runner)</b> targeting {at.tp2}.
                      </p>
                    </div>
                  )}

                  {/* 3-Step Lifecycle Visual Progress Bar */}
                  <div className="mb-3.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200 font-mono text-[11px]">
                    <div className="flex items-center justify-between text-slate-500 mb-1.5 text-[10px] font-sans font-bold uppercase">
                      <span>Trade Progress Stepper</span>
                      <span>Lifecycle State</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold">
                        <span className="block text-[9px] text-emerald-600">1. Entry Price</span>
                        <span className="text-sm">{at.entry}</span>
                      </div>
                      <div
                        className={`p-2 rounded-lg border font-bold ${
                          isAtTP1
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-400 ring-1 ring-emerald-400'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        <span className="block text-[9px] text-slate-500">2. Target 1 (POC)</span>
                        <span className="text-sm">{at.tp1}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold">
                        <span className="block text-[9px] text-slate-500">3. Target 2 (Opp. VA)</span>
                        <span className="text-sm">{at.tp2}</span>
                      </div>
                    </div>
                  </div>

                  {/* Twin Orders Real-Time Breakdown */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono mb-3.5">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-500 block font-sans">Order A (70% Banker):</span>
                      <span className="font-extrabold text-slate-900 text-sm">
                        {isAtTP1 ? '✅ Banked (+0.70%) at POC' : `Target: ${at.tp1}`}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-500 block font-sans">Order B (30% Runner):</span>
                      <span className="font-extrabold text-blue-700 text-sm">
                        {isAtTP1 ? `Running to ${at.tp2} (SL @ Breakeven)` : `Target: ${at.tp2} (SL: ${at.sl})`}
                      </span>
                    </div>
                  </div>

                  {/* Copy Live Ticket Button */}
                  <button
                    onClick={() => handleCopyTicket(at, idx, 'LIVE SIGNAL')}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 active:scale-[0.99]"
                  >
                    {copiedId === idx ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-300" />
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
          ) : (
            /* Clean Minimalist Flat Status State (Zero clutter, pristine White Theme) */
            <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-6 sm:p-8 text-center font-mono">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto mb-3.5 shadow-2xs">
                <Shield className="w-6 h-6" />
              </div>
              <h4 className="text-base font-black text-slate-900 mb-1">
                No Active Signal — Market 100% Flat
              </h4>
              <p className="text-xs text-slate-600 font-sans max-w-md mx-auto mb-5 leading-relaxed">
                The institutional engine is scanning Gold (XAUUSD) order flow clusters. A signal is triggered only when high-probability auction imbalance is verified.
              </p>

              {/* Status Metric Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs max-w-lg mx-auto mb-4">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] text-slate-400 font-sans block">Daily Target</span>
                  <span className="font-extrabold text-emerald-700">+2.0% - 3.0%</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] text-slate-400 font-sans block">Capital Guard</span>
                  <span className="font-extrabold text-slate-800">Safe (-2.5%)</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] text-slate-400 font-sans block">Daily Pacing</span>
                  <span className="font-extrabold text-blue-700">{tradesCount} / {maxTrades} Taken</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] text-slate-400 font-sans block">Scan Schedule</span>
                  <span className="font-extrabold text-amber-700">:31 Hourly</span>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 font-sans">
                Automatic Telegram alerts active at <span className="font-mono text-blue-600 font-bold">@tradingboyorderbot</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: STRATEGY (Shows the 3 strategy details, rules, win rates, and blueprints) */}
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
                  className={`text-left p-3 rounded-xl transition-all border text-xs ${
                    active
                      ? 'bg-blue-50/80 text-blue-950 border-blue-500 shadow-sm ring-1 ring-blue-500/20 font-bold'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-black text-xs text-slate-900">
                      {strat.number}. {strat.name.split(' ')[0]}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                        active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {strat.winRatePOC} Win
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">{strat.name}</div>
                </button>
              );
            })}
          </div>

          {/* Strategy Details Card */}
          <div className="bg-slate-50/60 border border-slate-200 rounded-2xl p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-mono text-emerald-600 uppercase tracking-wider font-extrabold">
                  Strategy {activeStrat.number} • {activeStrat.tag}
                </span>
                <h4 className="text-base font-black text-slate-900">{activeStrat.name}</h4>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono text-slate-400 block font-sans">Avg Reward : Risk</span>
                <span className="text-sm font-black text-amber-600 font-mono">{activeStrat.avgRR}</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 font-sans mb-4 leading-relaxed">
              {activeStrat.description}
            </p>

            {/* Strategy KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono mb-4">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[9px] text-slate-400 block font-sans">Target 1 Win Rate</span>
                <span className="text-sm font-extrabold text-emerald-600">{activeStrat.winRatePOC}</span>
                <span className="text-[9px] text-slate-400 block truncate">Scale 70% Off</span>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[9px] text-slate-400 block font-sans">Full Target Win</span>
                <span className="text-sm font-extrabold text-emerald-600">{activeStrat.winRateFull}</span>
                <span className="text-[9px] text-slate-400 block truncate">30% Runner</span>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[9px] text-slate-400 block font-sans">Defined Stop Risk</span>
                <span className="text-sm font-extrabold text-rose-600">{activeStrat.riskPips}</span>
                <span className="text-[9px] text-slate-400 block truncate">Max 0.5% - 1.0%</span>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[9px] text-slate-400 block font-sans">Footprint Confluence</span>
                <span className="text-xs font-extrabold text-blue-700 truncate block">
                  {activeStrat.footprintDelta}
                </span>
                <span className="text-[9px] text-slate-400 block truncate">Imbalance Shift</span>
              </div>
            </div>

            {/* Theoretical & Execution Specs */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs font-mono space-y-1.5 mb-4">
              <div className="flex items-center justify-between text-slate-700">
                <span className="text-slate-400 font-sans">Context Timeframe:</span>
                <span className="font-bold">{activeStrat.contextTf}</span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span className="text-slate-400 font-sans">Execution Timeframe:</span>
                <span className="font-bold">{activeStrat.execTf}</span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span className="text-slate-400 font-sans">Daily Frequency:</span>
                <span className="font-bold">{activeStrat.dailyFreq}</span>
              </div>
            </div>

            {/* Calculated Strategy Blueprint & Watchlist Levels */}
            <div className="bg-white border-2 border-slate-200 rounded-xl p-3.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-mono">
                  Calculated Strategy Blueprint Levels
                </span>
                <span className="text-xs font-black text-slate-800 font-mono">
                  {activeBlueprint.side} XAUUSD
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs mb-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 font-sans block">Entry Price</span>
                  <span className="font-extrabold text-slate-900 text-sm">{activeBlueprint.entry}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-sans block">Stop Loss</span>
                  <span className="font-extrabold text-rose-600 text-sm">{activeBlueprint.sl}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-sans block truncate">
                    Target 1 ({activeStrat.winRatePOC})
                  </span>
                  <span className="font-extrabold text-emerald-600 text-sm">{activeBlueprint.tp1}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-sans block truncate">
                    Target 2 ({activeStrat.winRateFull})
                  </span>
                  <span className="font-extrabold text-emerald-600 text-sm">{activeBlueprint.tp2}</span>
                </div>
              </div>

              <button
                onClick={() => handleCopyTicket(activeBlueprint, 'strat-bp', 'STRATEGY BLUEPRINT')}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 active:scale-[0.99]"
              >
                {copiedId === 'strat-bp' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
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

      {/* TAB 3: HISTORY (Shows today's completed trades log) */}
      {activeTab === 'history' && (
        <div className="p-3 sm:p-4 overflow-y-auto flex-1 space-y-2.5">
          {recentTrades.length === 0 ? (
            <div className="text-center py-12 text-slate-400 font-mono text-xs">
              <Shield className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-slate-600">No completed trades yet today.</p>
              <p className="text-[11px] mt-1">Trades will appear here when they hit SL, TP1, TP2, or Breakeven.</p>
            </div>
          ) : (
            recentTrades.map((rt, idx) => {
              const isWin = rt.close_reason === 'TP2_HIT' || rt.close_reason === 'MANUAL_WIN';
              const isBE = rt.close_reason === 'BE_EXIT' || rt.close_reason === 'MANUAL_BE';
              const isLoss = rt.close_reason === 'SL_HIT' || rt.close_reason === 'MANUAL_LOSS';

              return (
                <div
                  key={idx}
                  className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs font-mono text-xs flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900">
                        {rt.side} {rt.sym || 'XAUUSD'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-sans">
                        {rt.strategy || 'AMT 80% Rule'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Entry: <b>{rt.entry}</b> | Exit: <b>{rt.exit_price || '---'}</b> | {rt.exit_time || getISTTimeStr()}
                    </div>
                  </div>

                  <div className="text-right">
                    {isWin && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                        🏆 Full Target Hit (+1.15%)
                      </span>
                    )}
                    {isBE && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 font-bold border border-amber-200">
                        ⚖️ Order B at BE (+0.70% Kept)
                      </span>
                    )}
                    {isLoss && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-800 font-bold border border-rose-200">
                        🛑 Hard SL Hit (-0.50%)
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
      <div className="p-3 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 flex flex-wrap items-center justify-between gap-2 font-mono">
        <span>Daily Target: +2.0% - 3.0% / Day</span>
        <span>•</span>
        <span>Capital Guard Limit: -2.5%</span>
        <span>•</span>
        <span>Max 3 Trades/Day</span>
        <span>•</span>
        <span className="font-bold text-slate-700">TRADING BOY GOLD ONLY</span>
      </div>
    </div>
  );
}