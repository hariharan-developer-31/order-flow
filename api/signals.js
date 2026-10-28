import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fetchLiveBars, fetchLiveSignals } from './_lib/market.js';

// Configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const STATE_FILE = path.join(os.tmpdir(), 'tb_daily_signals_state.json');

// In-memory fallback cache across lambda warm invocations
let memoryState = null;

function loadState() {
  const today = new Date().toISOString().split('T')[0];
  const defaultState = {
    date: today,
    trades_count: 0,
    max_trades: 3,
    pnl: 0.0,
    pnl_pct: 0.0,
    today_pnl: '+0.00%',
    daily_target: '+2.0% - 3.0%',
    capital_guard: '-2.5%',
    is_flat: false,
    active_trades: [],
    recent_trades: [],
    latest_lifecycle_event: null,
    last_updated: Date.now(),
  };

  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      if (data && data.date === today) {
        memoryState = data;
        return memoryState;
      }
    }
  } catch (e) {}

  if (memoryState && memoryState.date === today) {
    return memoryState;
  }

  memoryState = defaultState;
  return memoryState;
}

function saveState(state) {
  memoryState = state;
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (e) {}
}

async function sendTelegramAlert(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return false;
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'HTML',
      }),
    });
    if (res.ok) return true;
    // Fallback: strip HTML tags and retry as plain text
    const cleanText = text.replace(/<[^>]+>/g, '');
    const fallbackRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: cleanText,
      }),
    });
    return fallbackRes.ok;
  } catch (e) {
    return false;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let state = loadState();

  // POST: Sync from Python Cloud Bot or WebApp Client
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (body) {
        const nowIST = new Date().toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }) + ' IST';

        if (body.action === 'RESET') {
          const today = new Date().toISOString().split('T')[0];
          state = {
            date: today,
            trades_count: 0,
            max_trades: 3,
            pnl: 0.0,
            pnl_pct: 0.0,
            today_pnl: '+0.00%',
            daily_target: '+2.0% - 3.0%',
            capital_guard: '-2.5%',
            is_flat: true,
            active_trades: [],
            recent_trades: state.recent_trades || [],
            latest_lifecycle_event: null,
            last_updated: Date.now(),
          };
          saveState(state);
          return res.status(200).json({ ok: true, state });
        }

        if (body.action === 'CLEAR_HISTORY') {
          state.recent_trades = [];
          state.last_updated = Date.now();
          saveState(state);
          return res.status(200).json({ ok: true, state });
        }

        if (body.action === 'ARM_TRADE') {
          const p = Number(body.price || 4028.50);
          const isBuy = p < 4014.50;
          const newTrade = {
            id: `TB-XAUUSD-${Date.now()}`,
            sym: 'XAUUSD',
            side: isBuy ? 'BUY' : 'SELL',
            strategy: '1. AMT 80% Value Area Rule',
            entry: Number(p.toFixed(2)),
            sl: Number((isBuy ? p - 6.00 : p + 6.00).toFixed(2)),
            tp1: Number((isBuy ? p + 6.00 : p - 6.00).toFixed(2)),
            tp2: Number((isBuy ? p + 13.80 : p - 13.80).toFixed(2)),
            dec: 2,
            lots: 0.08,
            half1: 0.05,
            half2: 0.03,
            stage: 'OPEN',
            order_a_status: 'RUNNING (Targeting TP1)',
            order_b_status: 'RUNNING (Targeting TP2)',
            order_b_sl: Number((isBuy ? p - 6.00 : p + 6.00).toFixed(2)),
            be_alerted: false,
            closed: false,
            time: nowIST,
            open_time_ist: nowIST,
          };
          state.active_trades = [newTrade];
          state.is_flat = false;
          state.trades_count = Math.max(state.trades_count || 1, 1);
          state.latest_lifecycle_event = {
            type: 'NEW_TRADE',
            headline: `🚀 ACTIVE SIGNAL: ${newTrade.side} XAUUSD at ${p.toFixed(2)}`,
            subtext: `Target 1: ${newTrade.tp1.toFixed(2)} | Target 2: ${newTrade.tp2.toFixed(2)} | SL: ${newTrade.sl.toFixed(2)}`,
            time: nowIST,
          };
          state.last_updated = Date.now();
          saveState(state);
          return res.status(200).json({ ok: true, state });
        }

        // Action from Client or External Webhook (TP1, TP2, BE, SL)
        if (body.action) {
          let trade = state.active_trades?.[0];

          if (body.action === 'TP1' && trade) {
            trade.be_alerted = true;
            trade.stage = 'TP1_BANKED_BE_ACTIVE';
            trade.order_a_status = 'BANKED (+0.70%)';
            const isBuyTrade = trade.side === 'BUY';
            const beCushionPrice = Number((isBuyTrade ? trade.entry + 0.50 : trade.entry - 0.50).toFixed(2));
            trade.order_b_status = `RUNNING (SL @ ${beCushionPrice} BE+Cushion)`;
            trade.order_b_sl = beCushionPrice;
            trade.tp1_hit_time = nowIST;

            state.pnl_pct = Number(((state.pnl_pct || 0) + 0.70).toFixed(2));
            state.pnl = state.pnl_pct;
            state.today_pnl = state.pnl_pct >= 0 ? `+${state.pnl_pct.toFixed(2)}%` : `${state.pnl_pct.toFixed(2)}%`;

            state.latest_lifecycle_event = {
              type: 'TP1_HIT',
              trade_id: trade.id,
              sym: trade.sym,
              side: trade.side,
              price: trade.tp1,
              gain_pct: 0.70,
              time: nowIST,
              headline: `🎯 TARGET 1 HIT: Order A Banked (+0.70%)`,
              subtext: `👉 ACTION IN MT5: Modify Order B Stop Loss to Breakeven + Cushion (${beCushionPrice.toFixed(2)})!`,
            };

            const beMsg =
              `🎯 <b>BREAKEVEN ALERT: ${trade.side} ${trade.sym} REACHED TARGET 1 (POC)!</b>\n\n` +
              `✅ <b>Price Hit POC:</b> <code>${trade.tp1.toFixed(2)}</code>\n` +
              `💰 <b>Order A Banked (70% Scale-Out):</b> +0.70% Net Gain!\n` +
              `🕒 <b>Execution Time:</b> <code>${nowIST}</code>\n` +
              `📈 <b>Today's Net P&L:</b> <code>${state.today_pnl}</code>\n\n` +
              `👉 <b>MANDATORY ACTION REQUIRED IN MT5:</b>\n` +
              `Modify <b>Order B</b> and change Stop Loss to <b>Breakeven (<code>${trade.entry.toFixed(2)}</code>)</b>.\n\n` +
              `🛡️ <i>Your trade is now 100% RISK-FREE. Order B runner is targeting TP2 (<code>${trade.tp2.toFixed(2)}</code>)!</i>`;
            await sendTelegramAlert(beMsg);
          } else if (body.action === 'TP2' && trade) {
            trade.closed = true;
            trade.stage = 'TP2_HIT';
            trade.close_reason = 'TP2_HIT';
            trade.exit_price = trade.tp2;
            trade.exit_time = nowIST;
            trade.total_gain_pct = 1.15;

            state.pnl_pct = Number(((state.pnl_pct || 0) + 0.45).toFixed(2));
            state.pnl = state.pnl_pct;
            state.today_pnl = state.pnl_pct >= 0 ? `+${state.pnl_pct.toFixed(2)}%` : `${state.pnl_pct.toFixed(2)}%`;

            state.recent_trades = [trade, ...(state.recent_trades || [])].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
            state.active_trades = [];
            state.is_flat = true;

            state.latest_lifecycle_event = {
              type: 'TP2_HIT',
              trade_id: trade.id,
              sym: trade.sym,
              side: trade.side,
              price: trade.tp2,
              gain_pct: 0.45,
              total_gain_pct: 1.15,
              time: nowIST,
              headline: `🏆 FULL ROTATION TARGET 2 HIT (+1.15% Net Profit)`,
              subtext: 'Order B runner banked (+0.45%). Total trade gain: +1.15%. Position completed!',
            };

            const tp2Msg =
              `🏆 <b>FULL VALUE AREA ROTATION TARGET HIT!</b>\n` +
              `<b>Asset:</b> ${trade.side} <b>${trade.sym}</b>\n\n` +
              `🎯 <b>Price Reached TP2:</b> <code>${trade.tp2.toFixed(2)}</code>\n` +
              `💵 <b>Order B Banked:</b> <b>+0.45%</b>\n` +
              `📈 <b>Total Trade Profit:</b> <b>+1.15% Net Gain</b>\n` +
              `🕒 <b>Completion Time:</b> <code>${nowIST}</code>\n\n` +
              `📊 <b>Today's Net P&L:</b> <code>${state.today_pnl}</code>\n` +
              `🛡️ <i>Position completed. Active Position Guard unlocked for next session!</i>`;
            await sendTelegramAlert(tp2Msg);
          } else if (body.action === 'BE' && trade) {
            trade.closed = true;
            trade.stage = 'BE_EXIT';
            trade.close_reason = 'BE_EXIT';
            trade.exit_price = trade.entry;
            trade.exit_time = nowIST;
            trade.total_gain_pct = 0.70;

            state.recent_trades = [trade, ...(state.recent_trades || [])].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
            state.active_trades = [];
            state.is_flat = true;

            state.latest_lifecycle_event = {
              type: 'BE_EXIT',
              trade_id: trade.id,
              sym: trade.sym,
              side: trade.side,
              price: trade.entry,
              total_gain_pct: 0.70,
              time: nowIST,
              headline: `⚖️ ORDER B CLOSED AT BREAKEVEN (${trade.entry.toFixed(2)})`,
              subtext: 'Runner exited at $0 loss. Order A +0.70% profit safely locked in account!',
            };

            const beExitMsg =
              `⚖️ <b>ORDER B CLOSED AT BREAKEVEN: ${trade.side} ${trade.sym}</b>\n\n` +
              `• <b>Exit Price:</b> <code>${trade.entry.toFixed(2)}</code>\n` +
              `• <b>Order B Loss:</b> 0.00% (Risk-Free Exit)\n` +
              `• <b>Order A Profit:</b> +0.70% safely locked in your account!\n` +
              `• <b>Exit Time:</b> <code>${nowIST}</code>\n\n` +
              `📊 <b>Today's Net P&L:</b> <code>${state.today_pnl}</code>\n` +
              `🛡️ <i>Position cleared. Active Position Guard unlocked for next session!</i>`;
            await sendTelegramAlert(beExitMsg);
          } else if (body.action === 'SL' && trade) {
            trade.closed = true;
            trade.stage = 'SL_HIT';
            trade.close_reason = 'SL_HIT';
            trade.exit_price = trade.sl;
            trade.exit_time = nowIST;
            trade.total_gain_pct = -0.50;

            state.pnl_pct = Number(((state.pnl_pct || 0) - 0.50).toFixed(2));
            state.pnl = state.pnl_pct;
            state.today_pnl = state.pnl_pct >= 0 ? `+${state.pnl_pct.toFixed(2)}%` : `${state.pnl_pct.toFixed(2)}%`;

            state.recent_trades = [trade, ...(state.recent_trades || [])].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
            state.active_trades = [];
            state.is_flat = true;

            state.latest_lifecycle_event = {
              type: 'SL_HIT',
              trade_id: trade.id,
              sym: trade.sym,
              side: trade.side,
              price: trade.sl,
              pnl_pct: -0.50,
              time: nowIST,
              headline: `🛑 STOP LOSS HIT: ${trade.side} ${trade.sym} (-0.50%)`,
              subtext: 'Hard Stop Loss triggered. Capital Guard safe (-2.5% safe limit).',
            };

            const slMsg =
              `🛑 <b>TRADE HIT STOP LOSS: ${trade.side} ${trade.sym}</b>\n\n` +
              `• <b>Exit Price:</b> <code>${trade.sl.toFixed(2)}</code>\n` +
              `• <b>Loss:</b> -0.50% (-1.0R)\n` +
              `• <b>Time:</b> <code>${nowIST}</code>\n` +
              `• <b>Today's Net P&L:</b> <code>${state.today_pnl}</code>\n` +
              `• <b>Capital Guard Safe:</b> -2.5% Limit\n` +
              `🛡️ <i>Active Position Guard cleared.</i>`;
            await sendTelegramAlert(slMsg);
          }

          state.last_updated = Date.now();
          saveState(state);
          return res.status(200).json({ ok: true, state });
        }

        // Direct state sync from bot.py
        if (body.active_trades) state.active_trades = body.active_trades;
        if (body.trades_count != null) state.trades_count = body.trades_count;
        if (body.pnl_pct != null) {
          state.pnl_pct = body.pnl_pct;
          state.pnl = body.pnl_pct;
          state.today_pnl = body.pnl_pct >= 0 ? `+${body.pnl_pct.toFixed(2)}%` : `${body.pnl_pct.toFixed(2)}%`;
        }
        if (body.recent_trades) {
          state.recent_trades = [...(body.recent_trades || []), ...(state.recent_trades || [])]
            .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
        }
        if (body.latest_lifecycle_event) state.latest_lifecycle_event = body.latest_lifecycle_event;
        state.is_flat = !state.active_trades || state.active_trades.length === 0;
        state.last_updated = Date.now();
        saveState(state);
        return res.status(200).json({ ok: true, synced: true, trades_count: state.trades_count });
      }
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  }

  // GET: If we already have open active trade or recent trades, return it
  if (state.active_trades && state.active_trades.length > 0) {
    return res.status(200).json(state);
  }

  // If flat but has recent trades from today, return current state
  if (state.is_flat && state.recent_trades && state.recent_trades.length > 0) {
    return res.status(200).json(state);
  }

  // Otherwise, auto-initialize live evaluated signal based on live market price
  try {
    const barsData = await fetchLiveBars('XAUUSD', '1h', 1);
    const liveP = barsData?.livePrice || 4015.50;
    const evaluated = fetchLiveSignals(liveP);

    state.active_trades = evaluated.active_trades || [];
    state.trades_count = Math.max(state.trades_count || 1, 1);
    state.is_flat = false;
    state.latest_lifecycle_event = evaluated.latest_lifecycle_event;
    state.signals_stream = evaluated.signals_stream;
    state.rules = evaluated.rules;
    saveState(state);

    return res.status(200).json({
      ...state,
      ...evaluated,
      active_trades: state.active_trades,
      recent_trades: state.recent_trades,
    });
  } catch (e) {
    const fallback = fetchLiveSignals(4015.50);
    return res.status(200).json(fallback);
  }
}
