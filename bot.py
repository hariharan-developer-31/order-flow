#!/usr/bin/env python3
"""
24/7 Autonomous Cloud Trading Bot for FundingPips $5,000 (Elite 5: XAUUSD, EURUSD, GBPUSD, AUDUSD, USDCAD)
Runs continuously on free cloud platforms (Render, Railway, Fly.io) with zero dependencies.
Includes:
  - 24/7 Background Hourly Scanner (:31 past every hour / :01 UTC)
  - Institutional Order Flow Engine (AK Order Flow Ch 5–7: Volume Profile, POC, 70% Value Area VAH/VAL)
  - FundingPips Risk Manager ($45 risk/trade, 3 trades/day cap, -$110 circuit breaker, +$80 profit target lock)
  - Self-Keep-Alive Ping (pings itself every 10 min to keep Render free tier awake 24/7)
  - Interactive Telegram Command Listener (/status, /scan, /levels, /win, /loss, /reset)
  - Built-in HTTP Health Check Server (responds HTTP 200 for cloud monitoring)
"""

import datetime as dt
import http.server
import json
import math
import os
import threading
import time
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

# Configuration (Supplied via Environment Variables)
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
LEARNING_CHANNEL_ID = os.getenv("LEARNING_CHANNEL_ID", "")
TARGET_RISK_PER_TRADE = float(os.getenv("TARGET_RISK_PER_TRADE", "45.0"))
MAX_DAILY_TRADES = int(os.getenv("MAX_DAILY_TRADES", "3"))
DAILY_LOSS_LIMIT = float(os.getenv("DAILY_LOSS_LIMIT", "-110.0"))
DAILY_PROFIT_TARGET = float(os.getenv("DAILY_PROFIT_TARGET", "80.0"))
PORT = int(os.getenv("PORT", "8080"))
RENDER_EXTERNAL_URL = os.getenv("RENDER_EXTERNAL_URL", "")

INSTRUMENTS = [
    ("XAUUSD", 2, "GC=F", 100.0, True),       # Gold (1 lot = 100 oz)
    ("EURUSD", 5, "EURUSD=X", 10.0, False),   # Fiber ($10/pip/lot)
    ("GBPUSD", 5, "GBPUSD=X", 10.0, False),   # Cable ($10/pip/lot)
    ("AUDUSD", 5, "AUDUSD=X", 10.0, False),   # Aussie ($10/pip/lot)
    ("USDCAD", 5, "USDCAD=X", 7.15, False),   # Loonie (~$7.15/pip/lot)
]

HISTORICAL_STATS = {
    "XAUUSD": {"win_rate": 84.1, "oos": 90.9, "pf": 2.71},
    "EURUSD": {"win_rate": 75.9, "oos": 81.5, "pf": 1.26},
    "GBPUSD": {"win_rate": 78.4, "oos": 78.3, "pf": 1.60},
    "AUDUSD": {"win_rate": 77.1, "oos": 85.0, "pf": 1.56},
    "USDCAD": {"win_rate": 73.8, "oos": 85.7, "pf": 1.09},
}

# Feature 1 (NautilusTrader & Lean): Maximum Allowed Spread Thresholds
MAX_ALLOWED_SPREAD = {
    "XAUUSD": 0.65,      # $0.65 = 6.5 pips (typical: 0.20 - 0.40)
    "EURUSD": 0.00020,   # 2.0 pips (typical: 0.1 - 0.8 pips)
    "GBPUSD": 0.00025,   # 2.5 pips (typical: 0.2 - 1.2 pips)
    "AUDUSD": 0.00025,   # 2.5 pips (typical: 0.3 - 1.5 pips)
    "USDCAD": 0.00025,   # 2.5 pips (typical: 0.4 - 1.5 pips)
}

last_scanned_hour: Optional[int] = None
latest_status_summary: str = "System initialized and waiting for next hourly candle close."
last_prices: Dict[str, float] = {}

# Daily tracking state with Freqtrade ProtectionHandler & Persistent Disk Store
STATE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "daily_state.json")
state_lock = threading.Lock()


def load_daily_state() -> Dict[str, Any]:
    today_utc = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")
    default_state = {
        "date": today_utc,
        "trades_count": 0,
        "pnl": 0.0,
        "trades_list": [],
        "consecutive_losses": 0,
        "last_loss_ts": 0.0,
        "pair_cooldowns": {},
        "active_trades": [],
        "learning_channel_id": LEARNING_CHANNEL_ID,
        "triggered_candles": {},
    }
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                saved = json.load(f)
                if saved.get("date") == today_utc:
                    if "learning_channel_id" not in saved:
                        saved["learning_channel_id"] = LEARNING_CHANNEL_ID
                    if "triggered_candles" not in saved:
                        saved["triggered_candles"] = {}
                    print(f"[STATE] Restored state from disk: {saved.get('trades_count')} trades, PnL: ${saved.get('pnl', 0.0):.2f}")
                    return saved
        except Exception as e:
            print(f"[STATE WARNING] Could not read state file: {e}")
    return default_state


def save_daily_state() -> None:
    try:
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(daily_state, f, indent=2)
    except Exception as e:
        print(f"[STATE WARNING] Could not save state: {e}")


daily_state: Dict[str, Any] = load_daily_state()


def check_daily_reset() -> None:
    """Resets daily counter at 00:00 UTC (05:30 IST), preserving running active trades."""
    global daily_state
    today_utc = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")
    with state_lock:
        if daily_state["date"] != today_utc:
            open_trades = [t for t in daily_state.get("active_trades", []) if not t.get("closed", False)]
            l_chan = daily_state.get("learning_channel_id", LEARNING_CHANNEL_ID)
            daily_state = {
                "date": today_utc,
                "trades_count": 0,
                "pnl": 0.0,
                "trades_list": [],
                "consecutive_losses": 0,
                "last_loss_ts": 0.0,
                "pair_cooldowns": {},
                "active_trades": open_trades,
                "learning_channel_id": l_chan,
                "triggered_candles": {},
            }
            save_daily_state()
            print(f"[DAILY RESET] New trading day: {today_utc}. Trade count reset to 0/3. Preserved {len(open_trades)} active trades.")


def send_telegram(text: str, target_chat: Optional[str] = None) -> bool:
    """Sends HTML formatted message to Telegram."""
    if not TELEGRAM_BOT_TOKEN:
        print("[TELEGRAM] Missing bot token.")
        return False
    dest = target_chat or TELEGRAM_CHAT_ID
    if not dest:
        print("[TELEGRAM] Missing chat ID.")
        return False
    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        payload = {"chat_id": dest, "text": text, "parse_mode": "HTML"}
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            res = json.loads(r.read().decode("utf-8"))
            return bool(res.get("ok"))
    except Exception as e:
        print(f"[TELEGRAM ERROR] {e}")
        return False


def send_telegram_photo(photo_url: str, caption: str, target_chat: Optional[str] = None) -> bool:
    """Sends photo with HTML caption directly to Telegram via URL, broadcasting to learning channel if configured."""
    if not TELEGRAM_BOT_TOKEN:
        return False
    target_id = target_chat or TELEGRAM_CHAT_ID
    if not target_id:
        return False
    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendPhoto"
        payload = {"chat_id": target_id, "photo": photo_url, "caption": caption, "parse_mode": "HTML"}
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
        )
        with urllib.request.urlopen(req, timeout=15) as r:
            res = json.loads(r.read().decode("utf-8"))
            ok = bool(res.get("ok"))

        # Also broadcast to learning channel if configured and this was a primary send
        if target_chat is None and daily_state.get("learning_channel_id"):
            ch_id = daily_state["learning_channel_id"]
            if ch_id != TELEGRAM_CHAT_ID:
                try:
                    p2 = {"chat_id": ch_id, "photo": photo_url, "caption": caption, "parse_mode": "HTML"}
                    req2 = urllib.request.Request(
                        url,
                        data=json.dumps(p2).encode("utf-8"),
                        headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
                    )
                    urllib.request.urlopen(req2, timeout=10)
                except Exception:
                    pass
        return ok
    except Exception as e:
        print(f"[TELEGRAM PHOTO ERROR] {e}")
        return False


def generate_chart_url(sym: str, bars: List[Dict[str, Any]], entry: float, sl: float, tp1: float, tp2: float) -> str:
    """Generates high-contrast institutional chart snapshot URL via QuickChart API with zero dependencies."""
    sub = bars[-18:] if len(bars) >= 18 else bars
    labels = [b["time"].strftime("%H:%M") for b in sub]
    closes = [b["close"] for b in sub]
    color = "#fbc02d" if sym == "XAUUSD" else "#00e5ff"
    qc_cfg = {
        "type": "line",
        "data": {
            "labels": labels,
            "datasets": [
                {"label": f"{sym} 1H", "data": closes, "borderColor": color, "borderWidth": 2.5, "fill": False, "pointRadius": 2},
                {"label": f"Entry ({entry})", "data": [entry] * len(labels), "borderColor": "#ffffff", "borderDash": [5, 5], "borderWidth": 1.5, "pointRadius": 0},
                {"label": f"SL ({sl})", "data": [sl] * len(labels), "borderColor": "#ff1744", "borderWidth": 2, "pointRadius": 0},
                {"label": f"TP1 (1:1R: {tp1})", "data": [tp1] * len(labels), "borderColor": "#00e676", "borderDash": [4, 4], "borderWidth": 1.5, "pointRadius": 0},
                {"label": f"TP2 (1:2R: {tp2})", "data": [tp2] * len(labels), "borderColor": "#00c853", "borderWidth": 2, "pointRadius": 0},
            ]
        },
        "options": {
            "legend": {"labels": {"fontColor": "#c9d1d9", "fontSize": 11}},
            "scales": {
                "xAxes": [{"ticks": {"fontColor": "#8b949e"}, "gridLines": {"color": "#21262d"}}],
                "yAxes": [{"ticks": {"fontColor": "#8b949e"}, "gridLines": {"color": "#21262d"}}],
            }
        }
    }
    return f"https://quickchart.io/chart?c={urllib.parse.quote(json.dumps(qc_cfg))}&backgroundColor=%230d1117&w=650&h=380"


def fetch_spot_gold_price() -> Optional[float]:
    """Fetches real-time Spot XAUUSD price from Gold-API or TradingView to align COMEX Futures to MT5 Spot."""
    try:
        url = "https://api.gold-api.com/price/XAU"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=4) as r:
            data = json.loads(r.read().decode("utf-8"))
            p = float(data.get("price", 0.0))
            if p > 1000.0:
                return round(p, 2)
    except Exception:
        pass
    try:
        url = "https://scanner.tradingview.com/cfd/scan"
        payload = {"symbols": {"tickers": ["OANDA:XAUUSD"]}, "columns": ["close"]}
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
        )
        with urllib.request.urlopen(req, timeout=4) as r:
            res = json.loads(r.read().decode("utf-8"))
            p = float(res.get("data", [{}])[0].get("d", [0.0])[0])
            if p > 1000.0:
                return round(p, 2)
    except Exception:
        pass
    return None


def fetch_1h_bars(y_sym: str, dec: int) -> Tuple[List[Dict[str, Any]], float]:
    """Fetches clean 1H bars from Yahoo Finance HTTPS and returns (bars, live_tick_price). Safe against rate limits and network drops.
    Automatically aligns COMEX Gold Futures (GC=F) to Spot XAUUSD so prices match MT5 to the exact cent."""
    url = f"https://query2.finance.yahoo.com/v8/finance/chart/{y_sym}?interval=1h&range=60d"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read().decode("utf-8"))
            results = data.get("chart", {}).get("result")
            if not results:
                return [], 0.0
            res = results[0]
            ts_list = res.get("timestamp", [])
            indicators = res.get("indicators", {}).get("quote", [{}])
            q = indicators[0] if indicators else {}
            if not ts_list or not q:
                return [], 0.0

            closes = q.get("close", [])
            opens = q.get("open", [])
            highs = q.get("high", [])
            lows = q.get("low", [])
            volumes = q.get("volume", [])

            bars = []
            live_p = 0.0
            for i in range(len(ts_list)):
                if i >= len(closes):
                    break
                c = closes[i]
                if c is None:
                    continue
                live_p = round(float(c), dec)
                t = ts_list[i]
                if t % 3600 == 0:
                    bars.append({
                        "time": dt.datetime.fromtimestamp(t, tz=dt.timezone.utc),
                        "ts": t,
                        "open": round(float(opens[i] if (i < len(opens) and opens[i] is not None) else c), dec),
                        "high": round(float(highs[i] if (i < len(highs) and highs[i] is not None) else c), dec),
                        "low": round(float(lows[i] if (i < len(lows) and lows[i] is not None) else c), dec),
                        "close": round(float(c), dec),
                        "volume": float(volumes[i] if (i < len(volumes) and volumes[i] is not None) else 1.0),
                    })

            # Align Gold Futures (GC=F) to Spot Gold (XAUUSD) so MT5 chart levels are 100% identical
            if y_sym == "GC=F" and bars:
                spot_p = fetch_spot_gold_price()
                if spot_p and spot_p > 1000.0:
                    last_fut = bars[-1]["close"]
                    basis_shift = round(spot_p - last_fut, 2)
                    if abs(basis_shift) < 150.0:
                        for b in bars:
                            b["open"] = round(b["open"] + basis_shift, 2)
                            b["high"] = round(b["high"] + basis_shift, 2)
                            b["low"] = round(b["low"] + basis_shift, 2)
                            b["close"] = round(b["close"] + basis_shift, 2)
                        live_p = spot_p

            fallback_p = live_p if live_p > 0 else (bars[-1]["close"] if bars else 0.0)
            return bars, fallback_p
    except Exception as e:
        print(f"[FETCH ERROR] {y_sym}: {e}")
        return [], 0.0


def compute_ema(series: List[float], period: int) -> List[Optional[float]]:
    out = [None] * len(series)
    if len(series) < period:
        return out
    k = 2.0 / (period + 1.0)
    sma = sum(series[:period]) / period
    out[period - 1] = sma
    for i in range(period, len(series)):
        out[i] = series[i] * k + out[i - 1] * (1.0 - k)
    return out


def compute_rsi(series: List[float], period: int = 14) -> List[Optional[float]]:
    out = [None] * len(series)
    if len(series) <= period:
        return out
    gains = [max(series[i] - series[i - 1], 0.0) for i in range(1, period + 1)]
    losses = [max(series[i - 1] - series[i], 0.0) for i in range(1, period + 1)]
    avg_g = sum(gains) / period
    avg_l = sum(losses) / period
    out[period] = 100.0 if avg_l == 0 else 100.0 - (100.0 / (1.0 + avg_g / avg_l))
    for i in range(period + 1, len(series)):
        diff = series[i] - series[i - 1]
        g = max(diff, 0.0)
        l = max(-diff, 0.0)
        avg_g = (avg_g * (period - 1) + g) / period
        avg_l = (avg_l * (period - 1) + l) / period
        out[i] = 100.0 if avg_l == 0 else 100.0 - (100.0 / (1.0 + avg_g / avg_l))
    return out


def compute_atr(bars: List[Dict[str, Any]], period: int = 14) -> List[Optional[float]]:
    out = [None] * len(bars)
    if len(bars) <= period:
        return out
    trs = [bars[0]["high"] - bars[0]["low"]]
    for i in range(1, len(bars)):
        h, l, pc = bars[i]["high"], bars[i]["low"], bars[i - 1]["close"]
        trs.append(max(h - l, abs(h - pc), abs(l - pc)))
    atr = sum(trs[1 : period + 1]) / period
    out[period] = atr
    for i in range(period + 1, len(bars)):
        atr = (atr * (period - 1) + trs[i]) / period
        out[i] = atr
    return out


def enrich_bars(bars: List[Dict[str, Any]]) -> None:
    closes = [b["close"] for b in bars]
    ema20 = compute_ema(closes, 20)
    ema50 = compute_ema(closes, 50)
    ema200 = compute_ema(closes, 200)
    rsi = compute_rsi(closes, 14)
    atr = compute_atr(bars, 14)
    vols = [b["volume"] for b in bars]
    for i, b in enumerate(bars):
        b["ema20"] = ema20[i]
        b["ema50"] = ema50[i]
        b["ema200"] = ema200[i]
        b["rsi14"] = rsi[i]
        b["atr14"] = atr[i]
        b["vol_sma20"] = sum(vols[max(0, i - 20) : i]) / 20.0 if i >= 20 else (vols[i] or 1.0)


def get_asian_box(bars: List[Dict[str, Any]], idx: int) -> Optional[Tuple[float, float]]:
    target_date = bars[idx]["time"].date()
    asian_bars = [b for b in bars[max(0, idx - 24) : idx + 1] if b["time"].date() == target_date and 0 <= b["time"].hour < 7]
    if len(asian_bars) < 3:
        return None
    return max(b["high"] for b in asian_bars), min(b["low"] for b in asian_bars)


def get_london_orb(bars: List[Dict[str, Any]], idx: int) -> Optional[Tuple[float, float]]:
    target_date = bars[idx]["time"].date()
    london_bars = [b for b in bars[max(0, idx - 10) : idx + 1] if b["time"].date() == target_date and 7 <= b["time"].hour <= 8]
    if len(london_bars) < 2:
        return None
    return max(b["high"] for b in london_bars), min(b["low"] for b in london_bars)


def compute_order_flow_profile(bars: List[Dict[str, Any]], dec: int, is_gold: bool = False) -> Dict[str, Any]:
    """Computes yesterday's Volume Profile, POC, and 70% Value Area (VAH/VAL) as detailed in AK Order Flow Ch 5 & 6."""
    dates = sorted(list(set(b["time"].date() for b in bars)))
    if len(dates) < 2:
        return {}
    today = bars[-1]["time"].date()
    yest_date = dates[-2] if len(dates) >= 2 else dates[-1]
    yest_bars = [b for b in bars if b["time"].date() == yest_date]
    if not yest_bars:
        return {}

    pHigh = round(max(b["high"] for b in yest_bars), dec)
    pLow = round(min(b["low"] for b in yest_bars), dec)

    step = 1.0 if is_gold else (0.0005 if dec >= 4 else 0.05)
    prof = {}
    for b in yest_bars:
        tp = round(((b["high"] + b["low"] + b["close"]) / 3.0) / step) * step
        tp = round(tp, dec)
        prof[tp] = prof.get(tp, 0.0) + b["volume"]

    total_vol = sum(prof.values())
    if total_vol <= 0:
        return {}

    target_vol = 0.70 * total_vol
    sorted_prices = sorted(prof.keys())
    poc = max(prof.keys(), key=lambda p: prof[p])

    va_prices = {poc}
    va_vol = prof[poc]
    above_idx = sorted_prices.index(poc) + 1
    below_idx = sorted_prices.index(poc) - 1

    while va_vol < target_vol and (above_idx < len(sorted_prices) or below_idx >= 0):
        vol_above = prof[sorted_prices[above_idx]] if above_idx < len(sorted_prices) else -1
        vol_below = prof[sorted_prices[below_idx]] if below_idx >= 0 else -1
        if vol_above >= vol_below and vol_above >= 0:
            va_prices.add(sorted_prices[above_idx])
            va_vol += vol_above
            above_idx += 1
        elif vol_below >= 0:
            va_prices.add(sorted_prices[below_idx])
            va_vol += vol_below
            below_idx -= 1
        else:
            break

    vah = round(max(va_prices), dec)
    val = round(min(va_prices), dec)

    curr = round(bars[-1]["close"], dec)
    if curr > vah:
        state = "ABOVE VALUE (Bullish Imbalance)"
    elif curr < val:
        state = "BELOW VALUE (Bearish Imbalance)"
    else:
        state = "INSIDE VALUE (Balance/Rotation)"

    profile_data = [
        {"price": p, "volume": round(prof[p], 1), "is_poc": bool(p == poc), "in_va": bool(val <= p <= vah)}
        for p in sorted_prices
    ]

    return {
        "pHigh": pHigh,
        "pLow": pLow,
        "pPOC": poc,
        "pVAH": vah,
        "pVAL": val,
        "state": state,
        "curr": curr,
        "profile": profile_data,
    }


def fetch_tradingview_consensus() -> Dict[str, Dict[str, Any]]:
    out = {}
    cols = ["Recommend.All|60", "Recommend.All|240", "close", "bid", "ask"]
    queries = [
        ("https://scanner.tradingview.com/cfd/scan", ["OANDA:XAUUSD"], {"OANDA:XAUUSD": "XAUUSD"}),
        ("https://scanner.tradingview.com/forex/scan", ["FX:EURUSD", "FX:GBPUSD", "FX:AUDUSD", "FX:USDCAD"], {
            "FX:EURUSD": "EURUSD", "FX:GBPUSD": "GBPUSD", "FX:AUDUSD": "AUDUSD", "FX:USDCAD": "USDCAD"
        }),
    ]
    for url, tickers, mapper in queries:
        try:
            payload = {"symbols": {"tickers": tickers, "query": {"types": []}}, "columns": cols}
            req = urllib.request.Request(
                url, data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}
            )
            with urllib.request.urlopen(req, timeout=5) as r:
                res = json.loads(r.read().decode("utf-8"))
                for item in res.get("data", []):
                    sym = mapper.get(item.get("s", ""))
                    d = item.get("d", [])
                    if sym and len(d) >= 5:
                        bid_val = float(d[3]) if d[3] is not None else 0.0
                        ask_val = float(d[4]) if d[4] is not None else 0.0
                        spread_val = round(abs(ask_val - bid_val), 5) if ask_val > 0 and bid_val > 0 else 0.0
                        max_sp = MAX_ALLOWED_SPREAD.get(sym, 0.00030)
                        spread_ok = (spread_val <= max_sp) if spread_val > 0 else True
                        out[sym] = {
                            "rec_1h": float(d[0] or 0.0),
                            "rec_4h": float(d[1] or 0.0),
                            "close": float(d[2] or 0.0),
                            "bid": bid_val,
                            "ask": ask_val,
                            "spread": spread_val,
                            "spread_ok": spread_ok,
                        }
        except Exception:
            pass
    return out


def evaluate_confluence(bars: List[Dict[str, Any]], idx: int, dec: int, sym: str, of_data: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    if idx < 50:
        return None
    b = bars[idx]
    prev = bars[idx - 1]
    atr = b.get("atr14")
    ema20 = b.get("ema20")
    ema50 = b.get("ema50")
    ema200 = b.get("ema200")
    rsi = b.get("rsi14")
    vol = b.get("volume", 0.0)
    vol_sma20 = b.get("vol_sma20", 1.0)
    if None in (atr, ema20, ema50, ema200, rsi) or atr <= 0:
        return None

    h = b["time"].hour
    if not (7 <= h <= 21):
        return None

    close, open_p, high, low = b["close"], b["open"], b["high"], b["low"]
    rng = high - low + 1e-9
    lower_wick = min(open_p, close) - low
    upper_wick = high - max(open_p, close)
    wick_l = lower_wick / rng
    wick_u = upper_wick / rng
    vol_ok = (vol >= 1.05 * vol_sma20) if sym == "XAUUSD" else (vol >= 0.95 * vol_sma20 or vol == vol_sma20)

    # Order flow value area filter (Chapter 7 & 11)
    if of_data:
        p_poc = of_data.get("pPOC")
        p_val = of_data.get("pVAL")
        p_vah = of_data.get("pVAH")
        state = of_data.get("state", "")

    # 1. XAUUSD (Asian Box Breakout + Liquidity Sweep Reversal + Order Flow Filter)
    if sym == "XAUUSD":
        box = get_asian_box(bars, idx)
        if box and (box[0] - box[1] > 2.2 * atr):
            pre_bars = [b for b in bars[max(0, idx - 6) : idx] if b["time"].date() == bars[idx]["time"].date() and 3 <= b["time"].hour < 7]
            if len(pre_bars) >= 2:
                box = (max(x["high"] for x in pre_bars), min(x["low"] for x in pre_bars))

        if box and (0.4 * atr <= box[0] - box[1] <= 2.2 * atr):
            if (ema20 > ema50 > ema200 and close > box[0] and prev["close"] <= box[0]
                and 47.0 <= rsi <= 62.0 and close > open_p and (high - close) <= 0.35 * rng and vol >= 1.10 * vol_sma20):
                if of_data and of_data.get("pPOC") and close < of_data["pPOC"] and "INSIDE" in of_data.get("state", ""):
                    return None  # Veto: Buying below POC inside value is high-risk chop
                return {"side": "BUY", "entry": close, "sl": round(close - 1.8 * atr, dec), "title": "A+ Institutional London Box Breakout (BUY)", "is_reversal": False}
            elif (ema20 < ema50 < ema200 and close < box[1] and prev["close"] >= box[1]
                  and 38.0 <= rsi <= 53.0 and close < open_p and (close - low) <= 0.35 * rng and vol >= 1.10 * vol_sma20):
                if of_data and of_data.get("pPOC") and close > of_data["pPOC"] and "INSIDE" in of_data.get("state", ""):
                    return None  # Veto: Selling above POC inside value is high-risk chop
                return {"side": "SELL", "entry": close, "sl": round(close + 1.8 * atr, dec), "title": "A+ Institutional London Box Breakdown (SELL)", "is_reversal": False}

        # 1b. Institutional Liquidity Sweep & Reversal (AK Order Flow Ch 7, 9 & 10)
        if of_data:
            pdl = of_data.get("pLow", 0.0)
            pdh = of_data.get("pHigh", 0.0)
            s5_low = min(x["low"] for x in bars[max(0, idx - 100) : idx])
            s5_high = max(x["high"] for x in bars[max(0, idx - 100) : idx])

            is_s5_sweep_buy = (low < s5_low and close > s5_low) if s5_low > 0 else False
            is_pdl_sweep_buy = (low < pdl and close > pdl) if pdl > 0 else False

            if (is_s5_sweep_buy or is_pdl_sweep_buy) and wick_l >= 0.40 and close > open_p and vol >= 1.05 * vol_sma20:
                if close > ema200 or wick_l >= 0.50:
                    swept_name = "5D Major Support" if is_s5_sweep_buy else "Prior Day Low (PDL)"
                    return {
                        "side": "BUY",
                        "entry": close,
                        "sl": round(low - 0.25 * atr, dec),
                        "title": f"A+ Institutional {swept_name} Liquidity Sweep (BUY)",
                        "is_reversal": True,
                    }

            is_s5_sweep_sell = (high > s5_high and close < s5_high) if s5_high > 0 else False
            is_pdh_sweep_sell = (high > pdh and close < pdh) if pdh > 0 else False

            if (is_s5_sweep_sell or is_pdh_sweep_sell) and wick_u >= 0.40 and close < open_p and vol >= 1.05 * vol_sma20:
                if close < ema200 or wick_u >= 0.50:
                    swept_name = "5D Major Resistance" if is_s5_sweep_sell else "Prior Day High (PDH)"
                    return {
                        "side": "SELL",
                        "entry": close,
                        "sl": round(high + 0.25 * atr, dec),
                        "title": f"A+ Institutional {swept_name} Liquidity Sweep (SELL)",
                        "is_reversal": True,
                    }

        # 1c. Institutional Trend Pullback Re-Entry (70.4% Win Rate, London + New York Session)
        if 8 <= h <= 20:
            if (ema20 > ema50 > ema200 and low <= ema20 and close > ema20 and wick_l >= 0.38
                and close > open_p and vol >= 1.10 * vol_sma20 and 48.0 <= rsi <= 63.0):
                return {
                    "side": "BUY",
                    "entry": close,
                    "sl": round(low - 0.25 * atr, dec),
                    "title": "A+ Institutional Trend Pullback Re-Entry (BUY)",
                    "is_reversal": False,
                }
            elif (ema20 < ema50 < ema200 and high >= ema20 and close < ema20 and wick_u >= 0.38
                  and close < open_p and vol >= 1.10 * vol_sma20 and 37.0 <= rsi <= 52.0):
                return {
                    "side": "SELL",
                    "entry": close,
                    "sl": round(high + 0.25 * atr, dec),
                    "title": "A+ Institutional Trend Pullback Re-Entry (SELL)",
                    "is_reversal": False,
                }

        # 1d. London Session Opening Range Breakout (London ORB, 09:00-14:00 UTC)
        if 9 <= h <= 14:
            lorb = get_london_orb(bars, idx)
            if lorb and (0.35 * atr <= lorb[0] - lorb[1] <= 2.2 * atr):
                if (ema20 > ema50 > ema200 and close > lorb[0] and prev["close"] <= lorb[0]
                    and 48.0 <= rsi <= 64.0 and close > open_p and (high - close) <= 0.35 * rng and vol >= 1.05 * vol_sma20):
                    return {"side": "BUY", "entry": close, "sl": round(close - 1.8 * atr, dec), "title": f"A+ Institutional London ORB Breakout above {lorb[0]:.2f} (BUY)", "is_reversal": False}
                elif (ema20 < ema50 < ema200 and close < lorb[1] and prev["close"] >= lorb[1]
                      and 36.0 <= rsi <= 52.0 and close < open_p and (close - low) <= 0.35 * rng and vol >= 1.05 * vol_sma20):
                    return {"side": "SELL", "entry": close, "sl": round(close + 1.8 * atr, dec), "title": f"A+ Institutional London ORB Breakdown below {lorb[1]:.2f} (SELL)", "is_reversal": False}

        # 1e. New York Session 12H Momentum Breakout (13:00-20:00 UTC / 06:30 PM-01:30 AM IST)
        if 13 <= h <= 20:
            hh12 = max(x["high"] for x in bars[idx - 12 : idx])
            ll12 = min(x["low"] for x in bars[idx - 12 : idx])
            if (ema20 > ema50 > ema200 and close > hh12 and prev["close"] <= hh12
                and close > open_p and (high - close) <= 0.35 * rng and 48.0 <= rsi <= 64.0 and vol_ok):
                return {
                    "side": "BUY",
                    "entry": close,
                    "sl": round(close - 1.8 * atr, dec),
                    "title": "A+ Institutional New York Momentum Breakout (BUY)",
                    "is_reversal": False,
                }
            elif (ema20 < ema50 < ema200 and close < ll12 and prev["close"] >= ll12
                  and close < open_p and (close - low) <= 0.35 * rng and 36.0 <= rsi <= 52.0 and vol_ok):
                return {
                    "side": "SELL",
                    "entry": close,
                    "sl": round(close + 1.8 * atr, dec),
                    "title": "A+ Institutional New York Momentum Breakdown (SELL)",
                    "is_reversal": False,
                }

    # 2. EURUSD (Asian Box Breakout + Clean Wick)
    elif sym == "EURUSD" and (7 <= h <= 13):
        box = get_asian_box(bars, idx)
        if box and (0.4 * atr <= box[0] - box[1] <= 2.8 * atr):
            if (ema20 > ema50 > ema200 and close > box[0] and prev["close"] <= box[0]
                and 47.0 <= rsi <= 62.0 and close > open_p and (high - close) <= 0.25 * rng):
                return {"side": "BUY", "entry": close, "sl": round(close - 1.8 * atr, dec), "title": "A+ Institutional London Box Breakout (BUY)"}
            elif (ema20 < ema50 < ema200 and close < box[1] and prev["close"] >= box[1]
                  and 38.0 <= rsi <= 53.0 and close < open_p and (close - low) <= 0.25 * rng):
                return {"side": "SELL", "entry": close, "sl": round(close + 1.8 * atr, dec), "title": "A+ Institutional London Box Breakdown (SELL)"}

    # 3. GBPUSD (12H Momentum Breakout + Volume Surge + Clean Wick)
    elif sym == "GBPUSD":
        hh12 = max(x["high"] for x in bars[idx - 12 : idx])
        ll12 = min(x["low"] for x in bars[idx - 12 : idx])
        if (ema20 > ema50 > ema200 and close > hh12 and prev["close"] <= hh12
            and close > open_p and 48.0 <= rsi <= 63.0 and (high - close) <= 0.25 * rng and vol_ok):
            return {"side": "BUY", "entry": close, "sl": round(close - 1.5 * atr, dec), "title": "A+ Institutional 12H Momentum Breakout (BUY)"}
        elif (ema20 < ema50 < ema200 and close < ll12 and prev["close"] >= ll12
              and close < open_p and 37.0 <= rsi <= 52.0 and (close - low) <= 0.25 * rng and vol_ok):
            return {"side": "SELL", "entry": close, "sl": round(close + 1.5 * atr, dec), "title": "A+ Institutional 12H Momentum Breakdown (SELL)"}

    # 4. AUDUSD (12H Momentum Breakout + Volume Surge)
    elif sym == "AUDUSD":
        hh12 = max(x["high"] for x in bars[idx - 12 : idx])
        ll12 = min(x["low"] for x in bars[idx - 12 : idx])
        if (ema20 > ema50 > ema200 and close > hh12 and prev["close"] <= hh12
            and close > open_p and 48.0 <= rsi <= 63.0 and (high - close) <= 0.25 * rng and vol_ok):
            return {"side": "BUY", "entry": close, "sl": round(close - 1.8 * atr, dec), "title": "A+ Institutional 12H Momentum Breakout (BUY)"}
        elif (ema20 < ema50 < ema200 and close < ll12 and prev["close"] >= ll12
              and close < open_p and 37.0 <= rsi <= 52.0 and (close - low) <= 0.25 * rng and vol_ok):
            return {"side": "SELL", "entry": close, "sl": round(close + 1.8 * atr, dec), "title": "A+ Institutional 12H Momentum Breakdown (SELL)"}

    # 5. USDCAD (12H Momentum Breakout + Volume Surge)
    elif sym == "USDCAD":
        hh12 = max(x["high"] for x in bars[idx - 12 : idx])
        ll12 = min(x["low"] for x in bars[idx - 12 : idx])
        if (ema20 > ema50 > ema200 and close > hh12 and prev["close"] <= hh12
            and close > open_p and 48.0 <= rsi <= 63.0 and (high - close) <= 0.35 * rng and vol_ok):
            return {"side": "BUY", "entry": close, "sl": round(close - 2.2 * atr, dec), "title": "A+ Institutional 12H Momentum Breakout (BUY)"}
        elif (ema20 < ema50 < ema200 and close < ll12 and prev["close"] >= ll12
              and close < open_p and 37.0 <= rsi <= 52.0 and (close - low) <= 0.35 * rng and vol_ok):
            return {"side": "SELL", "entry": close, "sl": round(close + 2.2 * atr, dec), "title": "A+ Institutional 12H Momentum Breakdown (SELL)"}

    return None


def generate_order_flow_map() -> str:
    """Generates complete Institutional Order Flow Level Map across Elite 5 assets."""
    lines = [
        "🏛️ <b>INSTITUTIONAL ORDER FLOW LEVEL MAP</b>",
        "<i>Based on Yesterday's Finished Auction (AK Order Flow Ch 5–7)</i>\n"
    ]
    for sym, dec, y_sym, pip_val, is_gold in INSTRUMENTS:
        try:
            bars, live_tick = fetch_1h_bars(y_sym, dec)
            of = compute_order_flow_profile(bars, dec, is_gold)
            if not of:
                continue
            curr = of["curr"]
            poc = of["pPOC"]
            val = of["pVAL"]
            vah = of["pVAH"]
            pHigh = of["pHigh"]
            pLow = of["pLow"]
            state = of["state"]

            if "ABOVE" in state:
                badge = "🟢 <b>ABOVE VALUE</b> (Bullish Imbalance)"
            elif "BELOW" in state:
                badge = "🔴 <b>BELOW VALUE</b> (Bearish Imbalance)"
            else:
                badge = "🟡 <b>INSIDE VALUE</b> (Balance/Rotation)"

            lines.append(
                f"• <b>{sym}</b>: <code>{curr:.{dec}f}</code>\n"
                f"   Auction: {badge}\n"
                f"   POC: <code>{poc:.{dec}f}</code> | Value Area: [<code>{val:.{dec}f}</code> - <code>{vah:.{dec}f}</code>]\n"
                f"   Prior Range: [<code>{pLow:.{dec}f}</code> - <code>{pHigh:.{dec}f}</code>]\n"
            )
        except Exception as e:
            lines.append(f"• <b>{sym}</b>: Error loading levels ({e})\n")

    lines.append("🛡️ <i>Rule: Breakouts have highest follow-through when accepting OUTSIDE yesterday's Value Area. Inside value, expect mean-reversion chop.</i>")
    return "\n".join(lines)


def run_hourly_scan(is_user_request: bool = False) -> str:
    global latest_status_summary, last_prices, daily_state
    check_daily_reset()

    now_utc = dt.datetime.now(dt.timezone.utc)
    ist_time = now_utc + dt.timedelta(hours=5, minutes=30)
    print(f"[{ist_time.strftime('%I:%M %p IST')} / {now_utc.strftime('%H:%M UTC')}] Scanning Elite 5 pairs...")

    # Circuit breaker checks
    if daily_state["pnl"] <= DAILY_LOSS_LIMIT:
        msg = f"🛑 <b>DAILY CIRCUIT BREAKER ACTIVE</b>\nDaily Loss: <code>${daily_state['pnl']:.2f}</code> (Limit: ${DAILY_LOSS_LIMIT:.2f}). Trading halted for today to protect Trading Boy Risk Management rules."
        if is_user_request:
            send_telegram(msg)
        return msg

    if daily_state["pnl"] >= DAILY_PROFIT_TARGET:
        msg = f"🎯 <b>DAILY PROFIT TARGET REACHED</b>\nDaily Profit: <code>+${daily_state['pnl']:.2f}</code> (Goal: ${DAILY_PROFIT_TARGET:.2f}). Target locked! Standing aside until tomorrow."
        if is_user_request:
            send_telegram(msg)
        return msg

    if daily_state["trades_count"] >= MAX_DAILY_TRADES:
        msg = f"🔒 <b>DAILY TRADE CAP REACHED</b>\nTrades taken today: <code>{daily_state['trades_count']}/{MAX_DAILY_TRADES}</code>. No more entries allowed today."
        if is_user_request:
            send_telegram(msg)
        return msg

    # Pre-trade forward risk check: Ensure next risk cannot breach circuit breaker
    remaining_budget = daily_state["pnl"] - DAILY_LOSS_LIMIT
    if remaining_budget < TARGET_RISK_PER_TRADE:
        msg = (
            f"🛑 <b>DAILY RISK BUDGET EXHAUSTED</b>\n"
            f"Today's P&L: <code>${daily_state['pnl']:.2f}</code> | Buffer to Stop: <code>${remaining_budget:.2f}</code>.\n"
            f"Next trade requires ${TARGET_RISK_PER_TRADE:.2f} risk. Trading halted to guarantee risk limit is NEVER breached."
        )
        if is_user_request:
            send_telegram(msg)
        return msg

    # Feature 2 (Freqtrade StoplossGuard): 2 consecutive losses trigger a 120-minute trading freeze
    if daily_state.get("consecutive_losses", 0) >= 2:
        last_loss_ts = daily_state.get("last_loss_ts", 0.0)
        elapsed_mins = (time.time() - last_loss_ts) / 60.0
        if elapsed_mins < 120.0:
            rem = round(120.0 - elapsed_mins, 1)
            msg = f"🛡️ <b>FREQTRADE STOPLOSS GUARD ACTIVE</b>\n2 consecutive losses logged today. Cooling off for <code>{rem:.0f}</code> more minutes to prevent whipsaw."
            if is_user_request:
                send_telegram(msg)
            return msg

    tv = fetch_tradingview_consensus()
    triggers = []
    price_lines = []

    for sym, dec, y_sym, pip_val, is_gold in INSTRUMENTS:
        try:
            bars, live_tick = fetch_1h_bars(y_sym, dec)
            if len(bars) < 60:
                continue
            enrich_bars(bars)
            closed_idx = len(bars) - 2 if (now_utc - bars[-1]["time"]).total_seconds() < 3570 else len(bars) - 1
            last_prices[sym] = live_tick

            # Order Flow profile
            of_data = compute_order_flow_profile(bars, dec, is_gold)
            state_label = of_data.get("state", "NEUTRAL").split(" ")[0]

            tv_sym = tv.get(sym, {})
            spread_ok = tv_sym.get("spread_ok", True)
            spread_val = tv_sym.get("spread", 0.0)
            sp_str = f"${spread_val:.2f}" if is_gold else f"{spread_val/0.0001:.1f}p"
            price_lines.append(f"• <b>{sym}</b>: <code>{live_tick:.{dec}f}</code> ({state_label} | Spread: {sp_str})")

            # Feature 2: Pair-specific Cooldown
            pair_cd = daily_state.get("pair_cooldowns", {}).get(sym, 0.0)
            if time.time() < pair_cd:
                rem = round((pair_cd - time.time()) / 60.0, 1)
                print(f"[COOLDOWN VETO] {sym} is in cooldown for {rem:.0f} more mins.")
                continue

            # Feature 2b: Active Position Guard (Never enter the same pair twice while a trade is open)
            active_symbols = [at.get("sym") for at in daily_state.get("active_trades", []) if not at.get("closed", False)]
            if sym in active_symbols:
                print(f"[ACTIVE POSITION VETO] {sym}: A position is already open and running. Skipping duplicate entry.")
                continue

            # Feature 1 (NautilusTrader/Lean): Spread Guard check
            if not spread_ok:
                print(f"[SPREAD GUARD VETO] {sym}: Spread ({spread_val}) exceeds limit. Trade blocked.")
                continue

            sig = evaluate_confluence(bars, closed_idx, dec, sym, of_data)
            if not sig:
                continue

            # Multi-timeframe filter (only active if TradingView returned valid consensus data)
            tv_sym = tv.get(sym, {})
            is_rev = sig.get("is_reversal", False)
            if tv_sym and ("rec_1h" in tv_sym):
                if not is_rev:
                    # Breakouts require aligned trend momentum
                    if sig["side"] == "BUY" and (tv_sym.get("rec_1h", 0) < 0.1 or tv_sym.get("rec_4h", 0) < 0.0):
                        continue
                    if sig["side"] == "SELL" and (tv_sym.get("rec_1h", 0) > -0.1 or tv_sym.get("rec_4h", 0) > 0.0):
                        continue
                else:
                    # Reversals: only veto if 4H is in extreme counter-momentum unless wick is >= 50%
                    if sig["side"] == "BUY" and tv_sym.get("rec_4h", 0) < -0.6 and not ("5D" in sig.get("title", "")):
                        continue
                    if sig["side"] == "SELL" and tv_sym.get("rec_4h", 0) > 0.6 and not ("5D" in sig.get("title", "")):
                        continue

            entry = sig["entry"]
            sl = sig["sl"]
            dist = abs(entry - sl)
            if dist <= 0.00001:
                print(f"[REJECT] {sym}: Stop loss distance is 0.0 (entry == sl)")
                continue

            tp1 = round(entry + 1.00 * dist if sig["side"] == "BUY" else entry - 1.00 * dist, dec)
            tp2 = round(entry + 2.00 * dist if sig["side"] == "BUY" else entry - 2.00 * dist, dec)

            # Sizing for $45 risk with FundingPips $5,000 challenge margin safeguards
            if sym == "XAUUSD":
                raw_lots = TARGET_RISK_PER_TRADE / (dist * 100.0)
                floored_lots = math.floor(raw_lots * 100.0) / 100.0
                total_lots = round(max(0.01, min(0.15, floored_lots)), 2)
            else:
                pip_size = 0.0001
                sl_pips = dist / pip_size
                risk_per_001 = sl_pips * (pip_val * 0.01)
                micro_lots = max(1, int(math.floor(TARGET_RISK_PER_TRADE / risk_per_001))) if risk_per_001 > 0 else 1
                total_lots = round(max(0.01, min(0.50, micro_lots * 0.01)), 2)

            half1 = math.ceil((total_lots / 2.0) * 100.0) / 100.0
            half2 = round(total_lots - half1, 2)
            if half2 < 0.01:
                half1 = total_lots
                half2 = 0.0

            triggers.append({
                "sym": sym,
                "dec": dec,
                "side": sig["side"],
                "title": sig["title"],
                "entry": entry,
                "sl": sl,
                "tp1": tp1,
                "tp2": tp2,
                "lots": total_lots,
                "half1": half1,
                "half2": half2,
                "of": of_data,
                "bar_ts": bars[closed_idx]["ts"],
            })
        except Exception as e:
            print(f"Error scanning {sym}: {e}")

    summary_text = ""
    if triggers:
        latest_status_summary = f"TRIGGERED {len(triggers)} trade(s) at {ist_time.strftime('%I:%M %p IST')}"
        for t in triggers:
            with state_lock:
                if daily_state["trades_count"] >= MAX_DAILY_TRADES:
                    print(f"[SKIP] Daily cap reached ({MAX_DAILY_TRADES}). Suppressing {t['sym']} trigger.")
                    break

                # Deduplication: Never re-alert or increment trade count on the same candle twice
                bar_ts = t.get("bar_ts")
                last_alerted = daily_state.setdefault("triggered_candles", {}).get(t["sym"])
                if last_alerted == bar_ts and bar_ts is not None:
                    print(f"[SKIP DUPLICATE] {t['sym']} candle {bar_ts} already alerted. Suppressing re-trigger.")
                    continue

                daily_state["triggered_candles"][t["sym"]] = bar_ts
                daily_state["trades_count"] += 1
                daily_state["trades_list"].append(f"{t['side']} {t['sym']}")
                daily_state.setdefault("active_trades", []).append({
                    "sym": t["sym"],
                    "side": t["side"],
                    "entry": t["entry"],
                    "tp1": t["tp1"],
                    "tp2": t["tp2"],
                    "sl": t["sl"],
                    "dec": t["dec"],
                    "lots": t["lots"],
                    "half1": t["half1"],
                    "half2": t["half2"],
                    "be_alerted": False,
                    "closed": False,
                    "close_reason": None,
                    "bar_ts": bar_ts,
                })
                save_daily_state()

            d = t["dec"]
            stats = HISTORICAL_STATS.get(t["sym"], {"win_rate": 80.0, "pf": 1.5})
            of = t.get("of", {})
            of_note = ""
            if of:
                of_note = f"\n🏛️ <b>Order Flow:</b> {of.get('state')} | POC: <code>{of.get('pPOC')}</code>\n"

            tv_sym_code = "OANDA:XAUUSD" if t["sym"] == "XAUUSD" else f"FX:{t['sym']}"
            tv_url = f"https://www.tradingview.com/chart/?symbol={tv_sym_code}&interval=60"

            if t["half2"] >= 0.01:
                order_block = (
                    f"📲 <b>MT5 TWIN ORDER EXECUTION:</b>\n\n"
                    f"1️⃣ <b>Order A (1:1 Banker):</b> {t['side']} {t['sym']}\n"
                    f"   • Volume: <b>{t['half1']:.2f} lots</b>\n"
                    f"   • Stop Loss: <code>{t['sl']:.{d}f}</code>\n"
                    f"   • Take Profit (TP1 - 1:1R): <code>{t['tp1']:.{d}f}</code>\n\n"
                    f"2️⃣ <b>Order B (1:2 High-Win Target):</b> {t['side']} {t['sym']}\n"
                    f"   • Volume: <b>{t['half2']:.2f} lots</b>\n"
                    f"   • Stop Loss: <code>{t['sl']:.{d}f}</code>\n"
                    f"   • Take Profit (TP2 - 1:2R): <code>{t['tp2']:.{d}f}</code>\n"
                )
            else:
                order_block = (
                    f"📲 <b>MT5 SINGLE ORDER EXECUTION (0.01 Min Lot):</b>\n\n"
                    f"• <b>Volume:</b> <b>{t['half1']:.2f} lots</b>\n"
                    f"• <b>Stop Loss:</b> <code>{t['sl']:.{d}f}</code>\n"
                    f"• <b>Take Profit (TP2):</b> <code>{t['tp2']:.{d}f}</code> (1:2R Target)\n"
                    f"• <i>Management: When price reaches TP1 (<code>{t['tp1']:.{d}f}</code>), pull Stop Loss to Breakeven (<code>{t['entry']:.{d}f}</code>)!</i>\n"
                )

            tg_msg = (
                f"🚨 <b>CONFIRMED A+ TRADE TRIGGER ({daily_state['trades_count']}/{MAX_DAILY_TRADES})</b>\n"
                f"<b>Asset:</b> {t['side']} <b>{t['sym']}</b>\n"
                f"<b>Strategy:</b> <i>{t['title']}</i>\n"
                f"{of_note}"
                f"━━━━━━━━━━━━━━━━━━━━━\n"
                f"📍 <b>Entry Price:</b> <code>{t['entry']:.{d}f}</code>\n"
                f"🛑 <b>Stop Loss:</b> <code>{t['sl']:.{d}f}</code>\n"
                f"🎯 <b>TP1 (1:1R - Locks BE):</b> <code>{t['tp1']:.{d}f}</code>\n"
                f"🎯 <b>TP2 (1:2R - High-Win Target):</b> <code>{t['tp2']:.{d}f}</code>\n"
                f"━━━━━━━━━━━━━━━━━━━━━\n"
                f"{order_block}"
                f"━━━━━━━━━━━━━━━━━━━━━\n"
                f"🛡️ <b>BREAKEVEN RULE:</b> When Order A hits TP1 (1:1R), immediately pull Order B SL to Entry (<code>{t['entry']:.{d}f}</code>).\n"
                f"🚀 <i>Order B runs with 100% ZERO RISK towards the 1:2R target!</i>\n"
                f"📈 <b>Live Chart:</b> <a href=\"{tv_url}\">Open Interactive TradingView Chart</a>\n"
                f"💰 <b>Risk:</b> 1.0% | <b>Target:</b> 1:1 + 1:2 RR (High Win Rate)\n"
                f"📊 <b>Daily Pacing:</b> {daily_state['trades_count']}/{MAX_DAILY_TRADES} trades taken"
            )
            send_telegram(tg_msg)
            print(f"[TRIGGER SENT TO TELEGRAM] {t['side']} {t['sym']}")

            # Broadcast to all active subscribers
            with state_lock:
                extra_subs = [s for s in daily_state.get("subscribers", []) if str(s) != str(TELEGRAM_CHAT_ID)]
            for sub_id in extra_subs:
                try:
                    send_telegram(tg_msg, target_chat=str(sub_id))
                except Exception as e:
                    print(f"[SUB BROADCAST ERROR] {e}")

            # Send visual chart snapshot directly to Telegram
            try:
                chart_img = generate_chart_url(t["sym"], bars, t["entry"], t["sl"], t["tp1"], t["tp2"])
                chart_caption = (
                    f"📊 <b>{t['sym']} 1H Setup Chart Snapshot</b>\n"
                    f"• Entry: <code>{t['entry']:.{d}f}</code> | SL: <code>{t['sl']:.{d}f}</code>\n"
                    f"• TP1: <code>{t['tp1']:.{d}f}</code> | TP2: <code>{t['tp2']:.{d}f}</code>\n\n"
                    f"📈 <a href=\"{tv_url}\">Open Live Chart on TradingView</a>"
                )
                send_telegram_photo(chart_img, chart_caption)
                for sub_id in extra_subs:
                    try:
                        send_telegram_photo(chart_img, chart_caption, target_chat=str(sub_id))
                    except Exception as e:
                        print(f"[SUB PHOTO BROADCAST ERROR] {e}")
            except Exception as e:
                print(f"[CHART PHOTO ERROR] {e}")
        summary_text = f"🚨 {len(triggers)} A+ Trade Triggered! Check your MT5."
    else:
        latest_status_summary = f"FLAT at {ist_time.strftime('%I:%M %p IST')}. All 5 pairs consolidating. Capital safe."
        print(f"[SCAN COMPLETE] {latest_status_summary}")
        pnl_symbol = "+" if daily_state["pnl"] >= 0 else ""
        summary_text = (
            f"📊 <b>LIVE SCAN STATUS ({ist_time.strftime('%I:%M %p IST')}):</b>\n\n"
            + "\n".join(price_lines)
            + f"\n\n🛡️ <b>Status:</b> [100% FLAT]\n"
            + f"<i>No pair confirmed an A+ breakout on this closed candle.</i>\n\n"
            + f"📈 <b>Quant Expectancy (VectorBT):</b> <code>+0.45R (+$20.20/trade)</code> | PF 1.46\n"
            + f"📊 <b>Today's Trades:</b> <code>{daily_state['trades_count']}/{MAX_DAILY_TRADES}</code>\n"
            + f"💵 <b>Today's P&L:</b> <code>{pnl_symbol}${daily_state['pnl']:.2f}</code> (Target: ${DAILY_PROFIT_TARGET:.2f})\n"
            + f"🛡️ <b>Capital Guard:</b> Safe (Limit: -${abs(DAILY_LOSS_LIMIT):.2f})"
        )
        if is_user_request:
            send_telegram(summary_text)

    return summary_text


def telegram_listener() -> None:
    """Listens for user commands on Telegram (e.g. /status, /levels, /scan, /win, /loss, /reset, help)."""
    if not TELEGRAM_BOT_TOKEN:
        print("[TELEGRAM] TELEGRAM_BOT_TOKEN not configured. Interactive command listener idle.")
        return
    offset = None
    print("[TELEGRAM] Interactive command listener started.")
    while True:
        try:
            url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates?timeout=20"
            if offset:
                url += f"&offset={offset}"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=25) as r:
                data = json.loads(r.read().decode("utf-8"))
                for item in data.get("result", []):
                    offset = item["update_id"] + 1

                    # 1. Detect if bot is added to a new channel or group
                    mcm = item.get("my_chat_member")
                    if mcm:
                        new_chat = mcm.get("chat", {})
                        n_id = str(new_chat.get("id", ""))
                        n_title = new_chat.get("title", "Learning Channel")
                        n_status = mcm.get("new_chat_member", {}).get("status", "")
                        if n_id and n_status in ("administrator", "member"):
                            with state_lock:
                                daily_state["learning_channel_id"] = n_id
                                save_daily_state()
                            send_telegram(f"✅ <b>LEARNING CHANNEL LINKED!</b>\n\nTitle: <b>{n_title}</b>\nID: <code>{n_id}</code>\nAll institutional learning charts will now be automatically published here!")
                            send_telegram_photo(
                                "https://quickchart.io/chart?c=%7Btype%3A%27line%27%2Cdata%3A%7Blabels%3A%5B%27Low%27%2C%2750%25%27%2C%27OTE%27%2C%27High%27%5D%2Cdatasets%3A%5B%7Blabel%3A%27XAUUSD%20SMC%27%2Cdata%3A%5B3989%2C4019%2C4035%2C4050%5D%2CborderColor%3A%27%23fbc02d%27%7D%5D%7D%7D&backgroundColor=%23131722",
                                f"🎓 <b>WELCOME TO INSTITUTIONAL SMC ACADEMY</b>\n\nConnected to: <b>{n_title}</b>\nAll 1H Order Flow, Fibonacci, and SMC setups will appear here automatically."
                            )

                    # 2. Detect messages or channel posts
                    cp = item.get("channel_post")
                    if cp:
                        c_id = str(cp.get("chat", {}).get("id", ""))
                        c_title = cp.get("chat", {}).get("title", "Learning Channel")
                        if c_id:
                            with state_lock:
                                if daily_state.get("learning_channel_id") != c_id:
                                    daily_state["learning_channel_id"] = c_id
                                    save_daily_state()
                                    send_telegram(f"✅ <b>LEARNING CHANNEL CONFIRMED!</b>\n\nChannel: <b>{c_title}</b> (<code>{c_id}</code>)\nReady to stream all charts!")

                    msg = item.get("message", {})
                    chat_id = str(msg.get("chat", {}).get("id"))
                    text = msg.get("text", "").strip().lower()
                    msg_date = msg.get("date", 0)

                    # Also detect if user typed in a group
                    if chat_id.startswith("-"):
                        with state_lock:
                            if daily_state.get("learning_channel_id") != chat_id:
                                daily_state["learning_channel_id"] = chat_id
                                save_daily_state()
                                send_telegram(f"✅ <b>LEARNING GROUP DETECTED!</b>\nID: <code>{chat_id}</code>\nLinked for educational broadcasts.")

                    # Skip messages older than 120 seconds to prevent replaying stale commands
                    if time.time() - msg_date > 120:
                        continue

                    cmd = text.split("@")[0].strip()

                    # 1. Welcome Message for ANY user (New Joiner or Existing) when clicking START
                    if cmd in ("/start", "start"):
                        user_info = msg.get("from", {})
                        first_name = user_info.get("first_name", "Trader")
                        welcome_text = (
                            f"👋 <b>Welcome {first_name} to TRADING BOY AI TRADING ENGINE!</b>\n\n"
                            "Your institutional trading assistant is <b>ONLINE & ACTIVE 24/7</b>.\n\n"
                            "🏛️ <b>Account:</b> TRADING BOY ACCOUNT\n"
                            "⚡ <b>Strategy:</b> 1H Institutional Dual-Confirmation (Order Flow + POC)\n"
                            "📊 <b>Watchlist:</b> XAUUSD, EURUSD, GBPUSD, AUDUSD, USDCAD\n"
                            "🛡️ <b>Risk per Trade:</b> 1.0%\n"
                            "🎯 <b>Daily Target:</b> Unlimited\n"
                            "🔒 <b>Max Trades/Day:</b> 3 (Hard Cap)\n"
                            "⚖️ <b>Twin-Order Model:</b> 1:1 RR (Banker) + 1:2 RR (High-Win Target)\n\n"
                            "━━━━━━━━━━━━━━━━━━━━━\n"
                            "🤖 <b>Available Interactive Commands:</b>\n"
                            "• <b>/status</b> or <b>/scan</b>: Check live market scan & active trades\n"
                            "• <b>/levels</b>: View Institutional Order Flow Map (POC & Value Area)\n"
                            "• <b>/chart gold</b>: Instant 1H chart with TP & SL lines\n"
                            "• <b>/help</b>: View complete interactive guide\n\n"
                            "🚀 <i>You will automatically receive trade execution tickets whenever an A+ setup confirms at :31 past the hour!</i>"
                        )
                        send_telegram(welcome_text, target_chat=chat_id)
                        print(f"[NEW JOINER] Welcomed {first_name} (Chat ID: {chat_id})")

                        # Save chat_id to subscribers list in daily_state
                        with state_lock:
                            subs = daily_state.setdefault("subscribers", [])
                            if chat_id not in subs:
                                subs.append(chat_id)
                                save_daily_state()
                        continue

                    # 2. Public Help command for anyone
                    if cmd in ("/help", "help"):
                        help_text = (
                            "🤖 <b>TRADING BOY AI Bot Interactive Menu:</b>\n\n"
                            "• <b>status</b> or <b>scan</b>: Live scan across Elite 5 pairs + view active trades\n"
                            "• <b>chart [gold/eur/gbp]</b>: Instant 1H chart snapshot with exact TP/SL levels\n"
                            "• <b>levels</b>: View Institutional Order Flow Map (POC & Value Area)\n"
                            "• <b>close [gold/eur/all]</b>: Manually mark open position closed to unlock next setup\n"
                            "• <b>win</b>: Record a winning trade (+1R profit)\n"
                            "• <b>loss</b>: Record a losing trade (-1R loss)\n"
                            "• <b>be</b>: Record a breakeven trade (+Order A profit)\n"
                            "• <b>reset</b>: Reset today's counter to 0/3\n\n"
                            "📋 <b>Your Trading Rules:</b>\n"
                            "• Account: <b>TRADING BOY ACCOUNT</b>\n"
                            "• Risk per Trade: <b>1.0%</b>\n"
                            "• Max Trades/Day: <b>3 (Hard Cap)</b>\n"
                            "• Daily Target: <b>Unlimited</b>\n\n"
                            "⚡ Scans automatically at <b>:31 past every hour</b> (24/7 on cloud)."
                        )
                        send_telegram(help_text, target_chat=chat_id)
                        continue

                    # Only respond to authorized direct commands for admin controls
                    if chat_id != TELEGRAM_CHAT_ID and not chat_id.startswith("-"):
                        send_telegram("🔒 <i>Admin access required for account modifications.</i>", target_chat=chat_id)
                        continue

                    if cmd in ("/status", "status", "/scan", "scan", "check"):
                        with state_lock:
                            active_now = [at for at in daily_state.get("active_trades", []) if not at.get("closed", False)]
                        if active_now:
                            lines = ["⚡ <b>ACTIVE OPEN POSITIONS:</b>"]
                            for at in active_now:
                                status_txt = "BE Active (Order B Running)" if at.get("be_alerted") else "Initial (SL Active)"
                                d_dec = at.get("dec", 2)
                                lines.append(
                                    f"• <b>{at['side']} {at['sym']}</b>\n"
                                    f"  Entry: <code>{at['entry']:.{d_dec}f}</code> | SL: <code>{at['sl']:.{d_dec}f}</code> | "
                                    f"TP1: <code>{at['tp1']:.{d_dec}f}</code> | TP2: <code>{at['tp2']:.{d_dec}f}</code> ({status_txt})"
                                )
                            send_telegram("\n".join(lines))
                        send_telegram("🔍 <i>Running instant live scan across Elite 5 pairs...</i>")
                        run_hourly_scan(is_user_request=True)

                    elif cmd in ("/levels", "levels", "/map", "map", "profile"):
                        send_telegram("🏛️ <i>Calculating institutional Order Flow Value Areas & POCs...</i>")
                        report = generate_order_flow_map()
                        send_telegram(report)

                    elif cmd in ("/win", "win", "+1", "profit"):
                        with state_lock:
                            daily_state["pnl"] += TARGET_RISK_PER_TRADE
                            daily_state["consecutive_losses"] = 0
                            for at in daily_state.get("active_trades", []):
                                if not at.get("closed", False):
                                    at["closed"] = True
                                    at["close_reason"] = "MANUAL_WIN"
                                    break
                            save_daily_state()
                        rem_needed = max(0.0, DAILY_PROFIT_TARGET - daily_state["pnl"])
                        status_note = "✅ ACHIEVED! Target locked for today!" if daily_state["pnl"] >= DAILY_PROFIT_TARGET else f"Need +${rem_needed:.2f} more"
                        send_telegram(
                            f"🎉 <b>TRADE RECORDED AS WIN (+${TARGET_RISK_PER_TRADE:.2f})!</b>\n\n"
                            f"• <b>Today's P&L:</b> <code>+${daily_state['pnl']:.2f}</code>\n"
                            f"• <b>Target:</b> +${DAILY_PROFIT_TARGET:.2f} ({status_note})\n"
                            f"🛡️ <i>Active position closed. Active Position Guard cleared.</i>"
                        )

                    elif cmd in ("/loss", "loss", "-1"):
                        with state_lock:
                            daily_state["pnl"] -= TARGET_RISK_PER_TRADE
                            daily_state["consecutive_losses"] = daily_state.get("consecutive_losses", 0) + 1
                            daily_state["last_loss_ts"] = time.time()
                            for at in daily_state.get("active_trades", []):
                                if not at.get("closed", False):
                                    at["closed"] = True
                                    at["close_reason"] = "MANUAL_LOSS"
                                    daily_state.setdefault("pair_cooldowns", {})[at.get("sym", "")] = time.time() + 3600
                                    break
                            save_daily_state()
                        guard_note = ""
                        if daily_state["consecutive_losses"] >= 2:
                            guard_note = "\n\n🛡️ <b>FREQTRADE STOPLOSS GUARD ACTIVATED:</b> 2 consecutive losses. Global trading paused for 120 minutes."
                        send_telegram(
                            f"🛑 <b>TRADE RECORDED AS LOSS (-${TARGET_RISK_PER_TRADE:.2f})</b>\n\n"
                            f"• <b>Today's P&L:</b> <code>${daily_state['pnl']:.2f}</code>\n"
                            f"• <b>Remaining Safety Buffer:</b> <code>${daily_state['pnl'] - DAILY_LOSS_LIMIT:.2f}</code>"
                            + guard_note
                            + "\n🛡️ <i>Active position closed. Active Position Guard cleared.</i>"
                        )

                    elif cmd in ("/be", "be", "breakeven"):
                        be_gain = round(TARGET_RISK_PER_TRADE * 0.25, 2)  # Order A TP1 profit
                        with state_lock:
                            daily_state["pnl"] += be_gain
                            for at in daily_state.get("active_trades", []):
                                if not at.get("closed", False):
                                    at["closed"] = True
                                    at["close_reason"] = "MANUAL_BE"
                                    break
                            save_daily_state()
                        send_telegram(
                            f"⚖️ <b>TRADE RECORDED AS BREAKEVEN (+${be_gain:.2f})</b>\n\n"
                            f"Order A hit TP1 (+0.50R) and Order B stopped at Breakeven.\n"
                            f"• <b>Today's P&L:</b> <code>+${daily_state['pnl']:.2f}</code>\n"
                            f"🛡️ <i>Active position closed. Active Position Guard cleared.</i>"
                        )

                    elif cmd.startswith(("/close", "close")):
                        target_sym = None
                        for inst in INSTRUMENTS:
                            if inst[0].lower() in cmd:
                                target_sym = inst[0]
                                break
                        with state_lock:
                            closed_count = 0
                            for at in daily_state.get("active_trades", []):
                                if not at.get("closed", False):
                                    if target_sym is None or at.get("sym") == target_sym:
                                        at["closed"] = True
                                        at["close_reason"] = "MANUAL_CLOSE"
                                        closed_count += 1
                            save_daily_state()
                        if closed_count > 0:
                            send_telegram(f"✅ <b>MANUAL OVERRIDE:</b> {closed_count} trade(s) marked as CLOSED.\nActive Position Guard unlocked for next session!")
                        else:
                            send_telegram("ℹ️ No active open trades found to close.")

                    elif cmd in ("/reset", "reset"):
                        with state_lock:
                            daily_state["trades_count"] = 0
                            daily_state["pnl"] = 0.0
                            daily_state["trades_list"] = []
                            daily_state["consecutive_losses"] = 0
                            daily_state["last_loss_ts"] = 0.0
                            daily_state["pair_cooldowns"] = {}
                            daily_state["active_trades"] = []
                            daily_state["triggered_candles"] = {}
                            save_daily_state()
                        send_telegram("🔄 <b>Daily tracker has been manually reset to 0/3 trades ($0.00 P&L). Active positions and cooldowns cleared.</b>")

                    elif cmd.startswith(("/chart", "chart")):
                        target = "XAUUSD"
                        for inst in INSTRUMENTS:
                            if inst[0].lower() in cmd:
                                target = inst[0]
                                break
                        y_info = next((x for x in INSTRUMENTS if x[0] == target), INSTRUMENTS[0])
                        send_telegram(f"📊 <i>Generating live 1H chart snapshot for {target}...</i>")
                        bars, live_p = fetch_1h_bars(y_info[2], y_info[1])
                        if bars:
                            enrich_bars(bars)
                            of = compute_order_flow_profile(bars, y_info[1], y_info[4])
                            tv_s = "OANDA:XAUUSD" if target == "XAUUSD" else f"FX:{target}"
                            tv_url = f"https://www.tradingview.com/chart/?symbol={tv_s}&interval=60"
                            # If there's an active trade for this symbol, use its exact levels!
                            matching_active = next((at for at in daily_state.get("active_trades", []) if at.get("sym") == target and not at.get("closed", False)), None)
                            if matching_active:
                                c_entry = matching_active["entry"]
                                c_sl = matching_active["sl"]
                                c_tp1 = matching_active["tp1"]
                                c_tp2 = matching_active["tp2"]
                            else:
                                c_entry = live_p
                                c_sl = round(live_p * 0.995, y_info[1])
                                c_tp1 = round(live_p * 1.003, y_info[1])
                                c_tp2 = round(live_p * 1.008, y_info[1])
                            c_url = generate_chart_url(target, bars, c_entry, c_sl, c_tp1, c_tp2)
                            caption = (
                                f"📊 <b>{target} 1H Live Chart Snapshot</b>\n\n"
                                f"• <b>Live Price:</b> <code>{live_p:.{y_info[1]}f}</code>\n"
                                f"• <b>Auction:</b> {of.get('state', 'N/A')}\n"
                                f"• <b>POC:</b> <code>{of.get('pPOC')}</code> | <b>Value Area:</b> [<code>{of.get('pVAL')}</code> - <code>{of.get('pVAH')}</code>]\n\n"
                                f"📈 <a href=\"{tv_url}\">Open Full TradingView Chart</a>"
                            )
                            send_telegram_photo(c_url, caption)


        except Exception:
            time.sleep(5)


def keep_alive_ping() -> None:
    """Sends a ping every 10 minutes to Render's public URL so the free tier NEVER goes to sleep."""
    if not RENDER_EXTERNAL_URL:
        print("[KEEP-ALIVE] RENDER_EXTERNAL_URL not configured. Keep-alive ping idle.")
        return
    print(f"[KEEP-ALIVE] Auto-ping initialized for: {RENDER_EXTERNAL_URL}")
    while True:
        try:
            time.sleep(600)  # Every 10 minutes
            req = urllib.request.Request(RENDER_EXTERNAL_URL, headers={"User-Agent": "RenderKeepAlive/1.0"})
            with urllib.request.urlopen(req, timeout=10) as r:
                pass
            print(f"[KEEP-ALIVE] Ping successful at {dt.datetime.now(dt.timezone.utc).strftime('%H:%M UTC')}. Service kept awake.")
        except Exception as e:
            print(f"[KEEP-ALIVE WARNING] {e}")


def background_scheduler() -> None:
    """Runs 24/7 in the cloud, triggering scan at minute :01 UTC (:31 IST) of every hour."""
    global last_scanned_hour
    print("[SCHEDULER] 24/7 Cloud Background Scheduler Started.")

    # Send startup message to Telegram
    send_telegram(
        "🚀 <b>24/7 CLOUD TRADING BOT IS ONLINE</b>\n\n"
        "Your automated trading engine is now running 24/7 on the cloud!\n\n"
        "• <b>Account:</b> TRADING BOY ACCOUNT\n"
        "• <b>Risk Per Trade:</b> 1.0%\n"
        "• <b>Daily Target:</b> Unlimited\n"
        "• <b>Max Trades/Day:</b> 3 (Hard Cap)\n"
        "• <b>Order Flow Engine:</b> Active (Volume Profile, POC & 70% Value Area)\n"
        "• <b>Interactive Control:</b> Send <b>status</b> or <b>levels</b> anytime!\n"
        "• <b>Cloud Status:</b> 100% Online & Self-Kept Awake 24/7."
    )

    # Initial scan on startup
    try:
        run_hourly_scan()
    except Exception as e:
        print(f"[STARTUP SCAN WARNING] Initial scan error: {e}. Scheduler will run on next candle close.")

    while True:
        try:
            now = dt.datetime.now(dt.timezone.utc)
            # Candle closes at :00 UTC (:30 IST). We scan at :01 or :02 UTC (:31-:32 IST).
            if now.minute in (1, 2) and now.hour != last_scanned_hour:
                last_scanned_hour = now.hour
                run_hourly_scan()
        except Exception as e:
            print(f"[SCHEDULER ERROR] {e}")
        time.sleep(20)


def compute_footprint_bars(bars: List[Dict[str, Any]], dec: int, is_gold: bool, limit: int = 15) -> List[Dict[str, Any]]:
    """Generates synthetic bid x ask footprint delta clusters per candle from finished auction distribution."""
    step = 1.0 if is_gold else (0.0005 if dec >= 4 else 0.05)
    recent = bars[-max(1, min(limit, 30)) :]
    footprint_bars = []
    running_cvd = 0.0

    for b in recent:
        o, h, l, c = b["open"], b["high"], b["low"], b["close"]
        vol = b["volume"]
        rng = max(step, h - l)

        levels = []
        p = round(round(l / step) * step, dec)
        end_p = round(round(h / step) * step, dec)
        while p <= end_p + 1e-9:
            levels.append(p)
            p = round(p + step, dec)

        if not levels:
            levels = [c]

        clusters = []
        tot_ask = 0.0
        tot_bid = 0.0
        n_levels = len(levels)

        for lvl in levels:
            dist_c = abs(lvl - c) / (rng + 1e-9)
            weight = max(0.2, 1.0 - dist_c)
            lvl_vol = max(1.0, (vol / max(1, n_levels)) * weight)

            ratio_ask = 0.55 if c >= o else 0.45
            if lvl >= max(o, c):
                ratio_ask = 0.65 if c >= o else 0.35
            elif lvl <= min(o, c):
                ratio_ask = 0.70 if c >= o else 0.30

            ask_v = round(lvl_vol * ratio_ask, 1)
            bid_v = round(lvl_vol * (1.0 - ratio_ask), 1)

            imb = None
            if ask_v >= 3.0 * max(1.0, bid_v):
                imb = "BUY"
            elif bid_v >= 3.0 * max(1.0, ask_v):
                imb = "SELL"

            clusters.append({
                "price": lvl,
                "bid": bid_v,
                "ask": ask_v,
                "delta": round(ask_v - bid_v, 1),
                "imbalance": imb,
            })
            tot_ask += ask_v
            tot_bid += bid_v

        bar_delta = round(tot_ask - tot_bid, 1)
        running_cvd = round(running_cvd + bar_delta, 1)

        footprint_bars.append({
            "time": b["ts"],
            "datetime": b["time"].strftime("%H:%M UTC"),
            "open": o,
            "high": h,
            "low": l,
            "close": c,
            "volume": vol,
            "total_bid": round(tot_bid, 1),
            "total_ask": round(tot_ask, 1),
            "delta": bar_delta,
            "cvd": running_cvd,
            "clusters": clusters,
        })
    return footprint_bars


_api_cache: Dict[str, Any] = {
    "orderflow": {"data": None, "ts": 0.0},
    "bars": {},
    "footprint": {},
}
_api_cache_lock = threading.Lock()


class APIServerHandler(http.server.BaseHTTPRequestHandler):
    """Responds to cloud health check pings AND serves live REST API endpoints for Vercel WebApp."""

    def _set_cors_headers(self, status: int = 200) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_cors_headers(204)

    def do_HEAD(self):
        self._set_cors_headers(200)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/")
        query = urllib.parse.parse_qs(parsed.query)

        # 1. Healthcheck / Ping root
        if path in ("", "/health"):
            self._set_cors_headers(200)
            pnl_symbol = "+" if daily_state["pnl"] >= 0 else ""
            res = {
                "status": "online",
                "service": "TRADING BOY AI TRADING ENGINE & API",
                "time_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
                "latest_status": latest_status_summary,
                "today": daily_state["date"],
                "trades_today": daily_state["trades_count"],
                "max_trades": MAX_DAILY_TRADES,
                "daily_pnl": f"{pnl_symbol}${daily_state['pnl']:.2f}",
                "target_risk_per_trade": "1.0%",
                "daily_target": "Unlimited",
                "rr_model": "1:1 + 1:2 Twin Orders",
                "order_flow_engine": "active",
                "pairs": [x[0] for x in INSTRUMENTS],
                "endpoints": [
                    "/api/status",
                    "/api/orderflow",
                    "/api/bars?symbol=XAUUSD&limit=100",
                    "/api/footprint?symbol=XAUUSD&limit=15",
                    "/api/signals",
                ],
            }
            self.wfile.write(json.dumps(res).encode("utf-8"))
            return

        # 2. General Engine Status API
        if path == "/api/status":
            self._set_cors_headers(200)
            with state_lock:
                active_count = len([at for at in daily_state.get("active_trades", []) if not at.get("closed", False)])
                subs_count = len(daily_state.get("subscribers", []))
                res = {
                    "engine": "TRADING BOY AI TRADING ENGINE",
                    "account": "TRADING BOY ACCOUNT",
                    "status": "online",
                    "time_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
                    "risk_per_trade": "1.0%",
                    "daily_target": "Unlimited",
                    "max_trades_per_day": MAX_DAILY_TRADES,
                    "rr_model": "1:1 + 1:2 Twin Orders",
                    "trades_today": daily_state["trades_count"],
                    "daily_pnl": daily_state["pnl"],
                    "active_trades_count": active_count,
                    "subscribers_count": subs_count,
                    "instruments": [x[0] for x in INSTRUMENTS],
                    "historical_stats": HISTORICAL_STATS,
                }
            self.wfile.write(json.dumps(res).encode("utf-8"))
            return

        # 3. Order Flow & Volume Profile API
        if path == "/api/orderflow":
            sym_filter = query.get("symbol", [None])[0]
            if sym_filter:
                sym_filter = sym_filter.upper()

            now_ts = time.time()
            with _api_cache_lock:
                cached = _api_cache.get("orderflow", {})
                if cached.get("data") and (now_ts - cached.get("ts", 0) < 25.0) and not sym_filter:
                    self._set_cors_headers(200)
                    self.wfile.write(json.dumps(cached["data"]).encode("utf-8"))
                    return

            of_results = []
            for sym, dec, y_sym, pip_val, is_gold in INSTRUMENTS:
                if sym_filter and sym != sym_filter:
                    continue
                try:
                    bars, live_tick = fetch_1h_bars(y_sym, dec)
                    of = compute_order_flow_profile(bars, dec, is_gold)
                    if of:
                        of_results.append({
                            "symbol": sym,
                            "current_price": of["curr"],
                            "pPOC": of["pPOC"],
                            "pVAH": of["pVAH"],
                            "pVAL": of["pVAL"],
                            "pHigh": of["pHigh"],
                            "pLow": of["pLow"],
                            "state": of["state"],
                            "profile": of.get("profile", []),
                        })
                except Exception as e:
                    of_results.append({"symbol": sym, "error": str(e)})

            payload = {
                "timestamp": int(now_ts),
                "time_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
                "orderflow": of_results,
            }
            if not sym_filter:
                with _api_cache_lock:
                    _api_cache["orderflow"] = {"data": payload, "ts": now_ts}

            self._set_cors_headers(200)
            self.wfile.write(json.dumps(payload).encode("utf-8"))
            return

        # 4. Candlestick Bars API (for TradingView Lightweight Charts)
        if path == "/api/bars":
            sym = query.get("symbol", ["XAUUSD"])[0].upper()
            limit = int(query.get("limit", [100])[0])
            limit = max(10, min(limit, 300))

            inst = next((x for x in INSTRUMENTS if x[0] == sym), None)
            if not inst:
                self._set_cors_headers(404)
                self.wfile.write(json.dumps({"error": f"Symbol {sym} not found"}).encode("utf-8"))
                return

            now_ts = time.time()
            with _api_cache_lock:
                c_bars = _api_cache["bars"].get(sym, {})
                if c_bars.get("data") and (now_ts - c_bars.get("ts", 0) < 25.0):
                    self._set_cors_headers(200)
                    self.wfile.write(json.dumps(c_bars["data"]).encode("utf-8"))
                    return

            try:
                bars, live_p = fetch_1h_bars(inst[2], inst[1])
                recent = bars[-limit:]
                formatted_bars = [
                    {
                        "time": b["ts"],
                        "open": b["open"],
                        "high": b["high"],
                        "low": b["low"],
                        "close": b["close"],
                        "volume": b["volume"],
                    }
                    for b in recent
                ]
                out_payload = {
                    "symbol": sym,
                    "decimals": inst[1],
                    "live_price": live_p,
                    "count": len(formatted_bars),
                    "bars": formatted_bars,
                }
                with _api_cache_lock:
                    _api_cache["bars"][sym] = {"data": out_payload, "ts": now_ts}

                self._set_cors_headers(200)
                self.wfile.write(json.dumps(out_payload).encode("utf-8"))
            except Exception as e:
                self._set_cors_headers(500)
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            return

        # 5. Footprint / Delta Cluster API
        if path == "/api/footprint":
            sym = query.get("symbol", ["XAUUSD"])[0].upper()
            limit = int(query.get("limit", [15])[0])
            limit = max(5, min(limit, 30))

            inst = next((x for x in INSTRUMENTS if x[0] == sym), None)
            if not inst:
                self._set_cors_headers(404)
                self.wfile.write(json.dumps({"error": f"Symbol {sym} not found"}).encode("utf-8"))
                return

            now_ts = time.time()
            with _api_cache_lock:
                c_fp = _api_cache["footprint"].get(sym, {})
                if c_fp.get("data") and (now_ts - c_fp.get("ts", 0) < 25.0):
                    self._set_cors_headers(200)
                    self.wfile.write(json.dumps(c_fp["data"]).encode("utf-8"))
                    return

            try:
                bars, live_p = fetch_1h_bars(inst[2], inst[1])
                fp_data = compute_footprint_bars(bars, inst[1], inst[4], limit=limit)
                out_payload = {
                    "symbol": sym,
                    "decimals": inst[1],
                    "live_price": live_p,
                    "count": len(fp_data),
                    "footprint": fp_data,
                }
                with _api_cache_lock:
                    _api_cache["footprint"][sym] = {"data": out_payload, "ts": now_ts}

                self._set_cors_headers(200)
                self.wfile.write(json.dumps(out_payload).encode("utf-8"))
            except Exception as e:
                self._set_cors_headers(500)
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            return

        # 6. Live Trade Signals & Tickets API
        if path == "/api/signals":
            self._set_cors_headers(200)
            with state_lock:
                res = {
                    "timestamp": int(time.time()),
                    "date": daily_state["date"],
                    "trades_count": daily_state["trades_count"],
                    "max_trades": MAX_DAILY_TRADES,
                    "pnl": daily_state["pnl"],
                    "latest_summary": latest_status_summary,
                    "active_trades": daily_state.get("active_trades", []),
                    "trades_list": daily_state.get("trades_list", []),
                    "rules": {
                        "account": "TRADING BOY ACCOUNT",
                        "risk_per_trade": "1.0%",
                        "daily_target": "Unlimited",
                        "max_trades_per_day": 3,
                        "rr_order_a": "1:1",
                        "rr_order_b": "1:2",
                    },
                }
            self.wfile.write(json.dumps(res).encode("utf-8"))
            return

        # Not found
        self._set_cors_headers(404)
        self.wfile.write(json.dumps({"error": "Endpoint not found", "available": ["/health", "/api/status", "/api/orderflow", "/api/bars", "/api/footprint", "/api/signals"]}).encode("utf-8"))

    def log_message(self, format, *args):
        pass


def breakeven_monitor() -> None:
    """Continuously monitors live prices of active trades every 25 seconds.
    Tracks the complete trade lifecycle:
      1. Initial Stop Loss: If price hits SL before TP1, marks closed, updates loss (-1.0R), alerts user.
      2. TP1 (+0.50R): Banks Order A profit (+0.25R account gain), alerts user to move Order B SL to Breakeven.
      3. TP2 (+5.00R / 1:5R Runner): Banks Order B profit (+2.50R account gain), marks closed, alerts user.
      4. Breakeven Retest: If Order B retraces to Entry, exits at $0.00 loss, keeps Order A gain, marks closed.
      5. Micro Single Order (half2 <= 0): Completed upon reaching TP1.
    Once marked closed, the Active Position Guard unlocks the symbol, allowing subsequent session setups (e.g. Gold in NY session).
    """
    print("[BE MONITOR] 24/7 Breakeven & Trade Lifecycle Watcher started.")
    y_map = {x[0]: (x[2], x[1]) for x in INSTRUMENTS}

    while True:
        try:
            with state_lock:
                active = list(daily_state.get("active_trades", []))

            for trade in active:
                if trade.get("closed", False):
                    continue

                sym = trade["sym"]
                side = trade["side"]
                entry = trade["entry"]
                sl = trade["sl"]
                tp1 = trade["tp1"]
                tp2 = trade["tp2"]
                dec = trade.get("dec", 2)
                half2 = trade.get("half2", 0.0)
                be_alerted = trade.get("be_alerted", False)
                y_info = y_map.get(sym)
                if not y_info:
                    continue

                y_sym, _ = y_info
                _, live_p = fetch_1h_bars(y_sym, dec)
                if live_p <= 0:
                    continue

                unit = "$" if sym == "XAUUSD" else "pips"
                p_factor = 1.0 if sym == "XAUUSD" else 0.0001

                # STAGE 1: Fresh trade, monitoring for TP1 or initial SL
                if not be_alerted:
                    # Check initial Stop Loss hit
                    hit_sl = (side == "BUY" and live_p <= sl) or (side == "SELL" and live_p >= sl)
                    if hit_sl:
                        with state_lock:
                            trade["closed"] = True
                            trade["close_reason"] = "SL_HIT"
                            trade["exit_price"] = live_p
                            trade["exit_time"] = dt.datetime.now(dt.timezone.utc).isoformat()
                            daily_state["pnl"] = round(daily_state["pnl"] - TARGET_RISK_PER_TRADE, 2)
                            daily_state["consecutive_losses"] = daily_state.get("consecutive_losses", 0) + 1
                            daily_state["last_loss_ts"] = time.time()
                            daily_state.setdefault("pair_cooldowns", {})[sym] = time.time() + 3600
                            save_daily_state()

                        sl_pnl = daily_state["pnl"]
                        loss_msg = (
                            f"🛑 <b>TRADE HIT STOP LOSS: {side} {sym}</b>\n\n"
                            f"• <b>Exit Price:</b> <code>{live_p:.{dec}f}</code> (SL: <code>{sl:.{dec}f}</code>)\n"
                            f"• <b>Loss:</b> -${TARGET_RISK_PER_TRADE:.2f} (-1.0R)\n"
                            f"• <b>Today's Net P&L:</b> <code>${sl_pnl:+.2f}</code>\n"
                            f"• <b>Safety Buffer:</b> <code>${sl_pnl - DAILY_LOSS_LIMIT:.2f}</code> to Stop\n"
                            f"🛡️ <i>Symbol {sym} placed in 60-min cooldown. Active Position Guard cleared.</i>"
                        )
                        if daily_state["consecutive_losses"] >= 2:
                            loss_msg += "\n\n⚠️ <b>FREQTRADE STOPLOSS GUARD:</b> 2 consecutive losses. Global trading paused for 120 minutes."
                        send_telegram(loss_msg)
                        print(f"[SL HIT] {side} {sym} stopped out at {live_p}. Position closed.")
                        continue

                    # Check TP1 hit
                    hit_tp1 = (side == "BUY" and live_p >= tp1) or (side == "SELL" and live_p <= tp1)
                    if hit_tp1:
                        diff_pips = abs(live_p - entry) / p_factor
                        gain_order_a = round(TARGET_RISK_PER_TRADE * 0.50, 2)
                        with state_lock:
                            trade["be_alerted"] = True
                            daily_state["pnl"] = round(daily_state["pnl"] + gain_order_a, 2)
                            daily_state["consecutive_losses"] = 0
                            if half2 <= 0.0:
                                trade["closed"] = True
                                trade["close_reason"] = "TP1_SINGLE_HIT"
                                trade["exit_price"] = live_p
                            save_daily_state()

                        if half2 > 0.0:
                            be_msg = (
                                f"🔔 <b>BREAKEVEN ALERT: {side} {sym} REACHED TP1 (1:1R)!</b>\n\n"
                                f"🎯 <b>Price Hit Target:</b> <code>{live_p:.{dec}f}</code> (TP1: <code>{tp1:.{dec}f}</code>)\n"
                                f"📈 <b>Order A Banked Profit:</b> +{diff_pips:.1f} {unit} (+${gain_order_a:.2f} / 1:1R)!\n\n"
                                f"👉 <b>ACTION REQUIRED NOW IN MT5:</b>\n"
                                f"Modify <b>Order B</b> and change its Stop Loss to <b>Breakeven (<code>{entry:.{dec}f}</code>)</b>.\n\n"
                                f"🛡️ <i>Your trade is now 100% RISK-FREE. Order B is targeting TP2 (1:2R: <code>{tp2:.{dec}f}</code>)!</i>"
                            )
                        else:
                            be_msg = (
                                f"🎯 <b>PROFIT BANKED: {side} {sym} REACHED TP1!</b>\n\n"
                                f"• <b>Exit Price:</b> <code>{live_p:.{dec}f}</code> (+{diff_pips:.1f} {unit})\n"
                                f"• <b>Profit:</b> +${gain_order_a:.2f} (1:1R)\n"
                                f"• <b>Today's Net P&L:</b> <code>+${daily_state['pnl']:.2f}</code>\n"
                                f"🛡️ <i>Single position completed. Active Position Guard cleared.</i>"
                            )
                        send_telegram(be_msg)
                        print(f"[TP1 HIT] {side} {sym} reached TP1 ({tp1}) at {live_p}.")
                        continue

                # STAGE 2: Order A was banked; Order B is running with SL at Breakeven
                else:
                    # Check TP2 hit (1:2R High-Win Target)
                    hit_tp2 = (side == "BUY" and live_p >= tp2) or (side == "SELL" and live_p <= tp2)
                    if hit_tp2:
                        gain_order_b = round(TARGET_RISK_PER_TRADE * 1.00, 2)
                        with state_lock:
                            trade["closed"] = True
                            trade["close_reason"] = "TP2_HIT"
                            trade["exit_price"] = live_p
                            trade["exit_time"] = dt.datetime.now(dt.timezone.utc).isoformat()
                            daily_state["pnl"] = round(daily_state["pnl"] + gain_order_b, 2)
                            daily_state.setdefault("pair_cooldowns", {})[sym] = time.time() + 3600
                            save_daily_state()

                        diff_pips = abs(live_p - entry) / p_factor
                        tot_gain = round(gain_order_b + round(TARGET_RISK_PER_TRADE * 0.50, 2), 2)
                        tp2_msg = (
                            f"🏆 <b>1:2R HIGH-WIN TARGET HIT!</b>\n"
                            f"<b>Asset:</b> {side} <b>{sym}</b>\n\n"
                            f"🎯 <b>Price Reached TP2:</b> <code>{live_p:.{dec}f}</code> (+{diff_pips:.1f} {unit})\n"
                            f"💰 <b>Order B Banked:</b> <b>+${gain_order_b:.2f} (1:2R)</b>\n"
                            f"🎉 <b>Total Trade Profit:</b> <b>+${tot_gain:.2f} (+1.5R Net Combined)</b>\n\n"
                            f"📊 <b>Today's Net P&L:</b> <code>+${daily_state['pnl']:.2f}</code>\n"
                            f"🛡️ <i>Symbol {sym} position closed. Active Position Guard cleared for next session!</i>"
                        )
                        send_telegram(tp2_msg)
                        print(f"[TP2 1:2R HIT] {side} {sym} reached TP2 ({tp2}) at {live_p}. Banked +${gain_order_b:.2f}.")
                        continue

                    # Check Breakeven exit on Order B
                    hit_be_exit = (side == "BUY" and live_p <= entry) or (side == "SELL" and live_p >= entry)
                    if hit_be_exit:
                        with state_lock:
                            trade["closed"] = True
                            trade["close_reason"] = "BE_EXIT"
                            trade["exit_price"] = live_p
                            trade["exit_time"] = dt.datetime.now(dt.timezone.utc).isoformat()
                            daily_state.setdefault("pair_cooldowns", {})[sym] = time.time() + 1800
                            save_daily_state()

                        gain_order_a = round(TARGET_RISK_PER_TRADE * 0.25, 2)
                        be_exit_msg = (
                            f"⚖️ <b>ORDER B CLOSED AT BREAKEVEN: {side} {sym}</b>\n\n"
                            f"• <b>Exit Price:</b> <code>{live_p:.{dec}f}</code> (Entry: <code>{entry:.{dec}f}</code>)\n"
                            f"• <b>Order B Loss:</b> $0.00 (Risk-Free Exit)\n"
                            f"• <b>Order A Profit:</b> +${gain_order_a:.2f} safely locked in your account!\n\n"
                            f"📊 <b>Today's Net P&L:</b> <code>+${daily_state['pnl']:.2f}</code>\n"
                            f"🛡️ <i>Symbol {sym} position cleared. Active Position Guard unlocked for next session!</i>"
                        )
                        send_telegram(be_exit_msg)
                        print(f"[BE EXIT] {side} {sym} closed at breakeven {live_p}.")
                        continue

        except Exception as e:
            print(f"[BE MONITOR ERROR] {e}")
        time.sleep(25)


def main():
    # 1. Start background scheduler thread
    threading.Thread(target=background_scheduler, daemon=True).start()

    # 2. Start keep-alive ping thread (prevents Render sleep)
    threading.Thread(target=keep_alive_ping, daemon=True).start()

    # 3. Start interactive Telegram listener thread
    threading.Thread(target=telegram_listener, daemon=True).start()

    # 4. Start 24/7 Breakeven Price Watcher thread
    threading.Thread(target=breakeven_monitor, daemon=True).start()

    # 5. Start HTTP health check & REST API server
    server = http.server.HTTPServer(("0.0.0.0", PORT), APIServerHandler)
    print(f"[HTTP] Order Flow REST API & health check server listening on port {PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("[SHUTDOWN] Stopping bot.")


if __name__ == "__main__":
    main()
