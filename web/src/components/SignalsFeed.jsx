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
  const [activeStrategyId, setActiveStrategyId] = useState('amt_80');
  const [copiedId, setCopiedId] = useState(null);
  const [showTester, setShowTester] = useState(false);
  const [activeTab, setActiveTab] = useState('feed'); // 'feed' | 'history'

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

  const handleCopyTicket = (ticket, idx) => {
    const text = `MT5 ORDER FLOW EXECUTION TICKET (INSTITUTIONAL GOLD XAUUSD):
Strategy: ${activeStrat.name} (${activeStrat.tag})
Asset: ${ticket.side} XAUUSD (Gold Spot)
Entry Price: ${ticket.entry}
Stop Loss: ${ticket.sl} (Risk: ${activeStrat.riskPips})
Target 1 (70% Scale-Out): ${ticket.tp1} (${activeStrat.target1Name})
Target 2 (30% Runner): ${ticket.tp2} (${activeStrat.target2Name})
Execution Time (IST): ${ticket.time || getISTTimeStr() + ' IST'}

MANDATORY RISK RULES:
1. Cap Per-Trade Risk at 0.5% - 1.0% of Capital.
2. When Target 1 (${ticket.tp1}) is hit, close 70% of position and pull Stop Loss to Entry (${ticket.entry})!
3. Target 2 (${ticket.tp2}) runs with 100% ZERO RISK.`;

    navigator.clipboard.writeText(text);
    setCopiedId(idx);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleSimulate = (action) => {
    const res = simulateLifecycleAction(action, currentPrice);
    if (onLifecycleChange) onLifecycleChange(res);
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden flex flex-col h-full font-sans">
      {/* 1. Top Header */}
      <div className="px-4 sm:px-5 py-3 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2 bg-white">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></div>
          <h3 className="font-extrabold text-slate-900 text-sm tracking-tight flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
            Institutional Telegram Signals (Gold XAUUSD)
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTester((v) => !v)}
            className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-mono transition"
            title="Toggle Lifecycle Testing Bar"
          >
            {showTester ? 'Hide Test Bar' : '⚡ Test Lifecycle'}
          </button>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-mono">
            @tradingboyorderbot
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
            🇮🇳 IST (UTC+05:30)
          </span>
        </div>
      </div>

      {/* Interactive Lifecycle Simulator Toolbar (Allows 1-Click Verification of SL, TP1, BE, TP2) */}
      {showTester && (
        <div className="p-2.5 bg-blue-50/80 border-b border-blue-200 flex flex-wrap items-center justify-between gap-1.5 text-xs font-mono">
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

      {/* Latest Lifecycle Event Notification Banner (Instant Real-Time Notice) */}
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

      {/* 2. Top Navigation Tabs: Live Feeds vs Today's Completed History */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('feed')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
              activeTab === 'feed'
                ? 'bg-white text-blue-900 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Live Trade Feed & Blueprints
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-white text-blue-900 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Today's Trade History</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-800 text-[10px]">
              {recentTrades.length}
            </span>
          </button>
        </div>
        <div className="text-right text-[11px] font-mono font-bold">
          <span className="text-slate-400">Net Today: </span>
          <span className={todayPnl.startsWith('+') ? 'text-emerald-600' : 'text-rose-600'}>
            {todayPnl}
          </span>
        </div>
      </div>

      {activeTab === 'history' ? (
        /* Today's Completed Trades History Log */
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1 max-h-[500px]">
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
                  className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs font-mono text-xs flex flex-wrap items-center justify-between gap-2"
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
      ) : (
        /* Main Feed: Active Trades + Strategies */
        <div className="overflow-y-auto flex-1 max-h-[500px]">
          {/* A. ACTIVE RUNNING TRADE CARD (Shows up when trade is OPEN or at TP1 / Breakeven) */}
          {activeTrades.length > 0 &&
            activeTrades.map((at, idx) => {
              const isAtTP1 = at.stage === 'TP1_BANKED_BE_ACTIVE' || at.be_alerted === true;
              const isBuy = at.side === 'BUY';

              return (
                <div
                  key={idx}
                  className="m-3 p-4 rounded-xl border-2 border-emerald-500 bg-white shadow-md ring-2 ring-emerald-500/15"
                >
                  {/* Active Header & Milestone Pill */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                      <span
                        className={`text-xs font-black px-2.5 py-1 rounded-md text-white font-mono ${
                          isBuy ? 'bg-emerald-600' : 'bg-rose-600'
                        }`}
                      >
                        LIVE POSITION: {at.side} XAUUSD
                      </span>
                      <span className="text-xs font-bold text-slate-800 font-sans">
                        {at.strategy || '1. AMT 80% Value Area Rule'}
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

                  {/* Mandatory Action Alert Box when TP1 is hit */}
                  {isAtTP1 && (
                    <div className="mb-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs font-mono">
                      <div className="flex items-center gap-1.5 font-black text-emerald-900 mb-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>BREAKEVEN LOCK ACTIVE: 100% RISK-FREE TRADE</span>
                      </div>
                      <p className="text-[11px] text-emerald-800 font-sans">
                        👉 <b>ACTION IN MT5:</b> Order A has been banked at Target 1 (+0.70%). Modify <b>Order B</b> and change its Stop Loss to <b>Breakeven ({at.entry})</b> now!
                      </p>
                    </div>
                  )}

                  {/* 3-Step Lifecycle Visual Progress Bar */}
                  <div className="mb-3.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200 font-mono text-[11px]">
                    <div className="flex items-center justify-between text-slate-500 mb-1.5 text-[10px] font-sans font-bold uppercase">
                      <span>Trade Progress Stepper</span>
                      <span>Execution Status</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold">
                        <span className="block text-[9px] text-emerald-600">1. Entry Price</span>
                        <span>{at.entry}</span>
                      </div>
                      <div
                        className={`p-1.5 rounded-lg border font-bold ${
                          isAtTP1
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-400 ring-1 ring-emerald-400'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        <span className="block text-[9px] text-slate-500">2. Target 1 (POC)</span>
                        <span>{at.tp1}</span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold">
                        <span className="block text-[9px] text-slate-500">3. Target 2 (VAL)</span>
                        <span>{at.tp2}</span>
                      </div>
                    </div>
                  </div>

                  {/* Twin Orders Real-Time Breakdown */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono mb-3">
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-500 block font-sans">Order A (70% Banker):</span>
                      <span className="font-extrabold text-slate-900 text-sm">
                        {isAtTP1 ? '✅ Banked (+0.70%) at POC' : `Target: ${at.tp1} (POC)`}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-500 block font-sans">Order B (30% Runner):</span>
                      <span className="font-extrabold text-blue-700 text-sm">
                        {isAtTP1 ? `Running to ${at.tp2} (SL @ BE)` : `Target: ${at.tp2} (SL: ${at.sl})`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

          {/* B. Strategy Selector Tabs */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-200">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-1 flex items-center justify-between">
              <span>Active Institutional Order Flow Strategy</span>
              <span className="text-blue-600 font-semibold">100% Gold Only</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              {STRATEGIES.map((strat) => {
                const active = strat.id === activeStrategyId;
                return (
                  <button
                    key={strat.id}
                    onClick={() => setActiveStrategyId(strat.id)}
                    className={`text-left p-2 rounded-xl transition-all border text-xs ${
                      active
                        ? 'bg-white text-blue-900 border-blue-500 shadow-sm ring-1 ring-blue-500/20 font-bold'
                        : 'bg-white/60 text-slate-600 border-slate-200 hover:bg-white hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-extrabold text-xs">
                        {strat.number}. {strat.name.split(' ')[0]}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                          active ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {strat.winRatePOC} Win
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">{strat.name}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* C. Strategy KPI Metric Dashboard */}
          <div className="bg-white text-slate-900 p-4 border-b border-slate-200">
            <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-100">
              <div>
                <div className="text-[10px] font-mono text-emerald-600 uppercase tracking-wider font-bold">
                  Strategy {activeStrat.number} • {activeStrat.tag}
                </div>
                <h4 className="text-sm font-black text-slate-900">{activeStrat.name}</h4>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono text-slate-500 block">Avg Reward : Risk</span>
                <span className="text-xs font-black text-amber-600 font-mono">{activeStrat.avgRR}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-[9px] text-slate-500 block font-sans">Target 1 Win Rate</span>
                <span className="text-sm font-extrabold text-emerald-600">{activeStrat.winRatePOC}</span>
                <span className="text-[9px] text-slate-500 block truncate">Scale 70% Off</span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-[9px] text-slate-500 block font-sans">Full Target Win</span>
                <span className="text-sm font-extrabold text-emerald-600">{activeStrat.winRateFull}</span>
                <span className="text-[9px] text-slate-500 block truncate">30% Runner</span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-[9px] text-slate-500 block font-sans">Defined Stop Risk</span>
                <span className="text-sm font-extrabold text-rose-600">{activeStrat.riskPips}</span>
                <span className="text-[9px] text-slate-500 block truncate">Max 0.5% - 1.0%</span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-[9px] text-slate-500 block font-sans">Footprint Confluence</span>
                <span className="text-xs font-extrabold text-blue-700 truncate block">
                  {activeStrat.footprintDelta}
                </span>
                <span className="text-[9px] text-slate-500 block truncate">Imbalance Shift</span>
              </div>
            </div>
          </div>

          {/* D. Daily Execution Pacing & Capital Guard Safe Banner */}
          <div className="bg-emerald-50/70 border-b border-emerald-200/60 px-4 py-2 flex items-center justify-between text-[11px] text-emerald-950 font-mono">
            <div className="flex items-center gap-1.5 font-bold">
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              <span>Daily Pacing: {tradesCount} / {maxTrades} Trades (Max 3)</span>
              <span className="text-emerald-300">|</span>
              <span className="text-emerald-700">Daily Target: +2.0% - 3.0%</span>
            </div>
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-200 hidden sm:inline">
              🛡️ Capital Guard: Safe (Limit -2.5%)
            </span>
          </div>

          {/* E. Strategy Blueprints Stream */}
          <div className="p-4 space-y-3">
            {strategyBlueprints.map((t, idx) => {
              const isBuy = t.side === 'BUY';
              const isTriggered = t.is_triggered === true;

              return (
                <div
                  key={t.id || idx}
                  className={`bg-white border-2 rounded-xl p-4 shadow-sm transition relative ${
                    isTriggered
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:border-blue-400'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-mono flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                        STRATEGY BLUEPRINT
                      </span>
                      <span
                        className={`text-xs font-black px-2 py-0.5 rounded-md font-mono ${
                          isBuy ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}
                      >
                        Planned {t.side}
                      </span>
                      <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 hidden sm:inline">
                        {t.strategy_name || activeStrat.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
                      <Clock className="w-3 h-3 text-blue-600" />
                      <span className="font-bold text-slate-700">{t.time || getISTTimeStr() + ' IST'}</span>
                    </div>
                  </div>

                  {/* Status Notice: Explains that market is Flat awaiting candle close */}
                  {isFlat && (
                    <div className="mb-3 px-3 py-1.5 rounded-lg bg-amber-50/80 border border-amber-200 text-amber-900 text-[11px] font-medium flex items-center justify-between gap-2 font-mono">
                      <span className="flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span><b>Status: Scanning & Armed</b> — Level blueprint calculated. Awaiting trigger.</span>
                      </span>
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded shrink-0">
                        FLAT ({tradesCount}/3 TODAY)
                      </span>
                    </div>
                  )}

                  {/* Levels Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs mb-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-[10px] text-slate-400 font-sans block">Entry Price</span>
                      <span className="font-extrabold text-slate-900 text-sm">{t.entry}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-sans block">Hard Stop Loss</span>
                      <span className="font-extrabold text-rose-600 text-sm">{t.sl}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-sans block truncate">
                        Target 1 ({activeStrat.winRatePOC})
                      </span>
                      <span className="font-extrabold text-emerald-600 text-sm">{t.tp1}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-sans block truncate">
                        Target 2 ({activeStrat.winRateFull})
                      </span>
                      <span className="font-extrabold text-emerald-600 text-sm">{t.tp2}</span>
                    </div>
                  </div>

                  {/* Order Flow Action Plan */}
                  <div className="mb-3 space-y-1 text-[11px] text-slate-600 bg-blue-50/60 p-2.5 rounded-lg border border-blue-100 font-mono">
                    <div className="flex items-center justify-between font-bold text-blue-900">
                      <span>Order A (70% Scale-Out):</span>
                      <span>Exit at {t.tp1} • Pull SL to Break-Even ({t.entry})</span>
                    </div>
                    <div className="flex items-center justify-between font-bold text-blue-900">
                      <span>Order B (30% Runner):</span>
                      <span>Run to {t.tp2} (Zero-Risk {activeStrat.avgRR} R:R)</span>
                    </div>
                  </div>

                  {/* Copy Blueprint Button */}
                  <button
                    onClick={() => handleCopyTicket(t, idx)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 active:scale-[0.99]"
                  >
                    {copiedId === idx ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied Strategy Levels to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Strategy Blueprint (For Setting Alerts / Limits)</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Footer Policy Note */}
      <div className="p-3 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 flex flex-wrap items-center justify-between gap-2 font-mono">
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
