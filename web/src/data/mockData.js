/**
 * High-fidelity fallback / demo data generator for TRADING BOY Terminal.
 * Supports multi-timeframe (5m, 15m, 1h, 4h), POC/Value Area levels,
 * Footprint clusters with buy/sell imbalances, and live signal tickets.
 */

const BASE_SPECS = {
  XAUUSD: {
    basePrice: 4028.5,
    volatility: 6.5,
    decimals: 2,
    tickSize: 0.5,
    poc: 4026.0,
    vah: 4034.0,
    val: 4018.0,
    pdh: 4038.5,
    pdl: 4012.0,
    typicalVolume: 24000,
  },
};

const TF_MAP = {
  '5m': { seconds: 300, volMult: 0.22, volQty: 0.08, waveP: 2.6, noiseP: 3.7, trendP: 14.0 },
  '15m': { seconds: 900, volMult: 0.45, volQty: 0.22, waveP: 5.1, noiseP: 2.7, trendP: 24.0 },
  '1h': { seconds: 3600, volMult: 1.0, volQty: 1.0, waveP: 8.5, noiseP: 1.8, trendP: 45.0 },
  '4h': { seconds: 14400, volMult: 2.2, volQty: 3.8, waveP: 16.5, noiseP: 1.1, trendP: 65.0 },
};

/**
 * Generate historical candlestick bars for any timeframe (5m, 15m, 1h, 4h).
 * Each timeframe features its own distinct market wave dynamics and microstructure.
 */
export function getFallbackBars(symbol = 'XAUUSD', count = 100, timeframe = '1h') {
  const spec = BASE_SPECS[symbol] || BASE_SPECS.XAUUSD;
  const tfKey = (timeframe || '1h').toLowerCase();
  const tf = TF_MAP[tfKey] || TF_MAP['1h'];

  const now = Math.floor(Date.now() / 1000);
  const step = tf.seconds;
  const startTs = Math.floor(now / step) * step - count * step;

  const adjustedVol = spec.volatility * tf.volMult;
  const bars = [];
  let currentPrice = spec.basePrice - (count / 2) * (adjustedVol * 0.08);

  for (let i = 0; i < count; i++) {
    const barTs = startTs + i * step;

    // Distinct waveform per timeframe
    const wave = Math.sin(i / tf.waveP) * adjustedVol * 1.25;
    const microNoise = Math.sin(i * tf.noiseP) * Math.cos(i * 1.2) * (adjustedVol * 0.45);
    const trend = Math.sin(i / tf.trendP) * adjustedVol * 1.6;

    const open = Number(currentPrice.toFixed(spec.decimals));
    const delta = wave + microNoise + (trend * 0.3);
    const close = Number((open + delta).toFixed(spec.decimals));

    const wickHigh = Math.abs(Math.sin(i * 2.5 + tf.waveP)) * adjustedVol * 0.65;
    const wickLow = Math.abs(Math.cos(i * 2.3 + tf.waveP)) * adjustedVol * 0.65;

    const high = Number((Math.max(open, close) + wickHigh).toFixed(spec.decimals));
    const low = Number((Math.min(open, close) - wickLow).toFixed(spec.decimals));
    const volume = Math.round(spec.typicalVolume * tf.volQty * (0.6 + Math.abs(Math.sin(i * 0.7)) * 0.7));

    bars.push({
      time: barTs,
      open,
      high,
      low,
      close,
      volume,
    });

    currentPrice = close;
  }

  return bars;
}

/**
 * Generate complete Order Flow & 24H Volume Profile data
 */
export function getFallbackOrderFlow(activeSymbol = 'XAUUSD') {
  const symbols = ['XAUUSD'];

  return symbols.map((sym) => {
    const spec = BASE_SPECS[sym] || BASE_SPECS.XAUUSD;
    const dec = spec.decimals;
    const bars = getFallbackBars(sym, 24, '1h');
    const lastBar = bars[bars.length - 1];
    const livePrice = lastBar ? lastBar.close : spec.basePrice;

    // Generate 26 horizontal volume profile bins around the price range
    const minP = spec.pdl - spec.volatility * 0.6;
    const maxP = spec.pdh + spec.volatility * 0.6;
    const step = (maxP - minP) / 26;

    const profile = [];
    for (let i = 0; i < 26; i++) {
      const price = Number((minP + i * step).toFixed(dec));
      const distToPOC = Math.abs(price - spec.poc);
      const normDist = distToPOC / (spec.volatility * 1.4);
      const binVol = Math.round(
        spec.typicalVolume * 0.95 * Math.exp(-0.5 * normDist * normDist) +
          spec.typicalVolume * 0.1 * (0.5 + Math.abs(Math.sin(i * 1.5)))
      );

      const isPOC = Math.abs(price - spec.poc) < step * 0.6;
      const inVA = price >= spec.val && price <= spec.vah;

      profile.push({
        price,
        volume: binVol,
        is_poc: isPOC,
        in_va: inVA,
      });
    }

    let auctionState = 'INSIDE VALUE AREA';
    if (livePrice > spec.vah) auctionState = 'ABOVE VALUE (BULLISH AUCTION)';
    else if (livePrice < spec.val) auctionState = 'BELOW VALUE (BEARISH AUCTION)';

    return {
      symbol: sym,
      decimals: dec,
      current_price: livePrice,
      pPOC: spec.poc,
      pVAH: spec.vah,
      pVAL: spec.val,
      pHigh: spec.pdh,
      pLow: spec.pdl,
      pVolume: spec.typicalVolume * 24,
      auction_state: auctionState,
      bias: livePrice >= spec.poc ? 'BUY' : 'SELL',
      dist_to_poc: livePrice - spec.poc,
      profile,
    };
  });
}

/**
 * Generate Footprint Bars with Bid x Ask cluster ladders & imbalances
 * Formatted in Indian Standard Time (IST, UTC+05:30) and scaled per Timeframe.
 */
export function getFallbackFootprint(symbol = 'XAUUSD', count = 12, timeframe = '1h') {
  const spec = BASE_SPECS[symbol] || BASE_SPECS.XAUUSD;
  const dec = spec.decimals;
  const bars = getFallbackBars(symbol, count, timeframe);

  let runningCvd = 0;

  return bars.map((bar, idx) => {
    const isBull = bar.close >= bar.open;
    // Format timestamp in Indian Standard Time (IST: UTC + 5:30 = +19800s)
    const d = new Date((bar.time + 19800) * 1000);
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const hour = String(d.getUTCHours()).padStart(2, '0');
    const min = String(d.getUTCMinutes()).padStart(2, '0');
    const datetimeStr = timeframe === '5m' || timeframe === '15m'
      ? `${day}/${month} ${hour}:${min} IST`
      : `${day}/${month} ${hour}:00 IST`;

    // Timeframe-adapted cluster granularity
    let clusterCount = 8;
    if (timeframe === '5m' || timeframe === '15m') clusterCount = 10;
    else if (timeframe === '4h') clusterCount = 12;

    const step = (bar.high - bar.low) / Math.max(1, clusterCount - 1);
    const clusters = [];

    let barBidTotal = 0;
    let barAskTotal = 0;

    for (let c = 0; c < clusterCount; c++) {
      const p = Number((bar.low + c * step).toFixed(dec));
      let baseBid = Math.round(35 + Math.abs(Math.sin(idx * 3 + c)) * 130);
      let baseAsk = Math.round(35 + Math.abs(Math.cos(idx * 3 + c)) * 130);

      let imbalance = null;
      if (isBull && c >= clusterCount - 2) {
        baseAsk = Math.round(baseBid * 3.4);
        imbalance = 'BUY';
      } else if (!isBull && c <= 1) {
        baseBid = Math.round(baseAsk * 3.4);
        imbalance = 'SELL';
      }

      barBidTotal += baseBid;
      barAskTotal += baseAsk;

      clusters.push({
        price: p,
        bid: baseBid,
        ask: baseAsk,
        delta: baseAsk - baseBid,
        imbalance,
      });
    }

    const barDelta = barAskTotal - barBidTotal;
    runningCvd += barDelta;

    return {
      time: bar.time,
      datetime: datetimeStr,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
      bid_volume: barBidTotal,
      ask_volume: barAskTotal,
      total_bid: barBidTotal,
      total_ask: barAskTotal,
      delta: barDelta,
      cvd: runningCvd,
      clusters,
    };
  });
}

/**
 * Generate realistic Live Signal Tickets & Rules
 */
export function getFallbackSignals() {
  const d = new Date();
  const dateStr = d.toISOString().split('T')[0];

  return {
    timestamp: Math.floor(Date.now() / 1000),
    date: dateStr,
    trades_count: 0,
    max_trades: 3,
    today_pnl: '+0.00%',
    daily_target: '+2.0% - 3.0%',
    capital_guard: '-2.5%',
    is_flat: true,
    latest_summary: 'Market 100% Flat: Scanning Gold XAUUSD for London and NY order flow confluences.',
    signals_stream: [
      {
        id: 'amt_80',
        strategy_id: 'amt_80',
        strategy_name: '1. AMT 80% Value Area Rule',
        symbol: 'XAUUSD',
        side: 'SELL',
        setup: 'Failed Auction Breakout above VAH (Rotation to POC)',
        timeframe: '5M Footprint / 15M Profile',
        entry: 4028.5,
        sl: 4034.5,
        tp1: 4022.5,
        tp2: 4014.7,
        status: 'WATCHLIST_LEVELS',
        is_triggered: false,
        target_risk: '0.5% risk | $6.00 Stop',
        time: `${dateStr} 14:15:00 IST`,
      },
      {
        id: 'vwap_fade',
        strategy_id: 'vwap_fade',
        strategy_name: '2. VWAP 2-SD Absorption Fade',
        symbol: 'XAUUSD',
        side: 'SELL',
        setup: '+2σ VWAP Band Exhaustion with CVD Divergence',
        timeframe: '5M Footprint + CVD',
        entry: 4030.0,
        sl: 4033.0,
        tp1: 4024.5,
        tp2: 4023.0,
        status: 'WATCHLIST_LEVELS',
        is_triggered: false,
        target_risk: '0.5% risk | $3.00 Stop',
        time: `${dateStr} 13:45:00 IST`,
      },
      {
        id: 'lvn_pullback',
        strategy_id: 'lvn_pullback',
        strategy_name: '3. LVN Trend Pullback',
        symbol: 'XAUUSD',
        side: 'BUY',
        setup: 'Trend Day LVN Valley Reload with 300%+ Stacked Imbalance',
        timeframe: '15M Profile / 5M Footprint',
        entry: 4026.7,
        sl: 4024.2,
        tp1: 4031.7,
        tp2: 4036.2,
        status: 'WATCHLIST_LEVELS',
        is_triggered: false,
        target_risk: '0.5% risk | $2.50 Stop',
        time: `${dateStr} 12:30:00 IST`,
      },
    ],
    rules: {
      asset: 'XAUUSD (Gold Spot Only)',
      risk_per_trade: '0.5% - 1.0%',
      max_trades_per_day: 3,
      scale_out_rule: 'Close 70% at Target 1, Move SL to BE',
      regime_switch: '2-Strike Daily Regime Switch',
    },
  };
}
