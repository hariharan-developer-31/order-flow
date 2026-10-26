import React, { useState } from 'react';
import { Send, Check, Copy, Shield, Target, Clock, AlertTriangle } from 'lucide-react';

export default function SignalsFeed({ signalsData }) {
  const [copiedId, setCopiedId] = useState(null);

  const activeTrades = signalsData?.active_trades || [];
  const tradesList = signalsData?.trades_list || [];
  const tradesCount = signalsData?.trades_count ?? 0;
  const maxTrades = signalsData?.max_trades ?? 3;
  const pnl = signalsData?.pnl ?? 0.0;
  const latestSummary = signalsData?.latest_summary || 'Waiting for next hourly candle close at :31 IST...';

  const handleCopyTicket = (trade, idx) => {
    const text = `MT5 EXECUTION TICKET:
Asset: ${trade.side} ${trade.sym}
Entry: ${trade.entry}
SL: ${trade.sl}
Order A (1:1): Lots ${trade.half1 || trade.lots} | TP ${trade.tp1}
Order B (1:2): Lots ${trade.half2 || 0.01} | TP ${trade.tp2}
Breakeven Rule: When Order A reaches ${trade.tp1}, move Order B SL to ${trade.entry}!`;

    navigator.clipboard.writeText(text);
    setCopiedId(idx);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full">
      {/* Top Header */}
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></div>
          <h3 className="font-extrabold text-slate-900 text-sm">
            Live Telegram Signals & MT5 Tickets
          </h3>
        </div>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
          Sync: @tradingboyorderbot
        </span>
      </div>

      {/* Daily Risk & Performance Status Banner */}
      <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-[10px] text-slate-400 font-bold block uppercase">
              Today's Pacing
            </span>
            <span className="font-mono font-black text-slate-900 text-sm">
              {tradesCount} / {maxTrades} Trades
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold block uppercase">
              Net P&L
            </span>
            <span
              className={`font-mono font-black text-sm ${
                pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
          <Shield className="w-4 h-4 text-emerald-600" />
          <span>Risk 1.0% | Twin Target 1:1 + 1:2 RR</span>
        </div>
      </div>

      {/* Signal Cards Feed */}
      <div className="p-4 overflow-y-auto space-y-3 flex-1 max-h-[500px]">
        {activeTrades.length === 0 ? (
          <div className="py-10 text-center">
            <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300 animate-pulse" />
            <h4 className="text-sm font-bold text-slate-700">No Open Trades Right Now</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              The engine is monitoring the market. Next automated scan triggers at{' '}
              <b className="text-slate-600">:31 past the hour</b>.
            </p>
          </div>
        ) : (
          activeTrades.map((t, idx) => {
            const isBuy = t.side === 'BUY';
            const isBE = t.be_alerted;
            const isClosed = t.closed;

            return (
              <div
                key={idx}
                className="bg-white border-2 border-slate-200 rounded-xl p-4 shadow-sm hover:border-blue-400 transition"
              >
                {/* Card Top: Asset Badge & Status */}
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-black px-2.5 py-1 rounded-lg ${
                        isBuy
                          ? 'bg-emerald-500 text-white'
                          : 'bg-rose-500 text-white'
                      }`}
                    >
                      {t.side} {t.sym}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      1H Candle
                    </span>
                  </div>

                  {/* Status Pill */}
                  {isClosed ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                      Closed ({t.close_reason || 'Exit'})
                    </span>
                  ) : isBE ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300 animate-pulse">
                      Order B Running (BE Locked)
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Active Setup
                    </span>
                  )}
                </div>

                {/* Execution Levels Grid */}
                <div className="grid grid-cols-2 gap-2 font-mono text-xs mb-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-400 font-sans block">Entry Price</span>
                    <span className="font-bold text-slate-900">{t.entry}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-sans block">Stop Loss</span>
                    <span className="font-bold text-rose-600">{t.sl}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-sans block">TP1 (1:1 Banker)</span>
                    <span className="font-bold text-emerald-600">{t.tp1}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-sans block">TP2 (1:2 High-Win)</span>
                    <span className="font-bold text-emerald-600">{t.tp2}</span>
                  </div>
                </div>

                {/* Twin-Order Breakdown */}
                <div className="flex items-center justify-between text-[11px] text-slate-600 mb-3 bg-blue-50/50 p-2 rounded border border-blue-100">
                  <span>
                    Order A: <b>{t.half1 || t.lots} lots</b> (TP1)
                  </span>
                  <span>
                    Order B: <b>{t.half2 || 0.01} lots</b> (TP2)
                  </span>
                </div>

                {/* Copy Button */}
                <button
                  onClick={() => handleCopyTicket(t, idx)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 transition"
                >
                  {copiedId === idx ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Copied MT5 Ticket!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Exact MT5 Order Ticket</span>
                    </>
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
        <span>Instant Execution Sync</span>
        <span className="font-semibold text-slate-700">TRADING BOY AI</span>
      </div>
    </div>
  );
}
