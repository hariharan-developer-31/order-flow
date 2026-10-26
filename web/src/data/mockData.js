/**
 * High-fidelity fallback / demo data generator for TRADING BOY Terminal.
 * Supports multi-timeframe (5m, 15m, 1h, 4h), POC/Value Area levels,
 * Footprint clusters with buy/sell imbalances, and live signal tickets.
 */

const BASE_SPECS = {
  XAUUSD: {
    basePrice: 2742.5,
    volatility: 4.8,
    decimals: 2,
    tickSize: 0.5,
    poc: 2741.5,
    vah: 2749.0,
    val: 2736.0,
    pdh: 2754.2,
    pdl: 2730.8,
    typicalVolume: 24000,
  },
  EURUSD: {
    basePrice: 1.0825,
    volatility: 0.0018,
    decimals: 5,
    tickSize: 0.0001,
    poc: 1.0828,
    vah: 1.085,
    val: 1.0812,
    pdh: 1.0862,
    pdl: 1.0795,
    typicalVolume: 38000,
  },
  GBPUSD: {
    basePrice: 1.2985,
    volatility: 0.0025,
    decimals: 5,
    tickSize: 0.0001,
    poc: 1.298,
    vah: 1.3015,
    val: 1.296,
    pdh: 1.3028,
    pdl: 1.2945,
    typicalVolume: 32000,
  },
  AUDUSD: {
    basePrice: 0.6582,
    volatility: 0.0016,
    decimals: 5,
    tickSize: 0.0001,
    poc: 0.6585,
    vah: 0.6605,
    val: 0.6565,
    pdh: 0.6618,
    pdl: 0.6552,
    typicalVolume: 21000,
  },
  USDCAD: {
    basePrice: 1.3865,
    volatility: 0.002,
    decimals: 5,
    tickSize: 0.0001,
    poc: 1.386,
    vah: 1.389,
    val: 1.384,
    pdh: 1.3905,
    pdl: 1.3828,
    typicalVolume: 25000,
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
  const symbols = ['XAUUSD', 'EURUSD', 'GBPUSD', 'AUDUSD', 'USDCAD'];

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
 */
export function getFallbackFootprint(symbol = 'XAUUSD', count = 12, timeframe = '1h') {
  const spec = BASE_SPECS[symbol] || BASE_SPECS.XAUUSD;
  const dec = spec.decimals;
  const bars = getFallbackBars(symbol, count, timeframe);

  let runningCvd = 0;

  return bars.map((bar, idx) => {
    const isBull = bar.close >= bar.open;
    const d = new Date(bar.time * 1000);
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const hour = String(d.getUTCHours()).padStart(2, '0');
    const min = String(d.getUTCMinutes()).padStart(2, '0');
    const datetimeStr = timeframe === '5m' || timeframe === '15m' ? `${month}/${day} ${hour}:${min}` : `${month}/${day} ${hour}:00`;

    // 8-10 price levels within the bar's High-Low range
    const clusterCount = 8;
    const step = (bar.high - bar.low) / Math.max(1, clusterCount - 1);
    const clusters = [];

    let barBidTotal = 0;
    let barAskTotal = 0;

    for (let c = 0; c < clusterCount; c++) {
      const p = Number((bar.low + c * step).toFixed(dec));
      let baseBid = Math.round(40 + Math.abs(Math.sin(idx * 3 + c)) * 140);
      let baseAsk = Math.round(40 + Math.abs(Math.cos(idx * 3 + c)) * 140);

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
    trades_count: 1,
    max_trades: 3,
    pnl: 145.0,
    latest_summary: 'Twin-Order Execution Active. Order A hit TP1 (+1:1 RR banker). Order B stop loss safely moved to Breakeven.',
    active_trades: [
      {
        sym: 'XAUUSD',
        side: 'BUY',
        entry: 2738.5,
        sl: 2731.5,
        tp1: 2745.5,
        tp2: 2752.5,
        dec: 2,
        half1: 0.04,
        half2: 0.04,
        half1_lots: 0.04,
        half2_lots: 0.04,
        risk_usd: 50.0,
        be_alerted: true,
        closed: false,
        time: `${dateStr} 13:31:00 UTC`,
        setup: 'asian_range_breakout',
        reason: 'Institutional Liquidity Sweep & POC Acceptance above $2738.00 with >300% Delta Footprint Confirmation.',
      },
    ],
    trades_list: [
      {
        sym: 'EURUSD',
        side: 'SELL',
        entry: 1.0852,
        sl: 1.0872,
        tp1: 1.0832,
        tp2: 1.0812,
        dec: 5,
        gain: 95.0,
        closed: true,
        result: 'WIN (TP2 Hit)',
        time: `${dateStr} 08:31:00 UTC`,
      },
    ],
    rules: {
      account: 'TRADING BOY ACCOUNT',
      risk_per_trade: '1.0%',
      daily_target: 'Unlimited',
      max_trades_per_day: 3,
      rr_order_a: '1:1',
      rr_order_b: '1:2',
    },
  };
}
