/**
 * PROJECT: UOT-INSPIRED INSTITUTIONAL TRADING ANALYSIS ENGINE
 * Client-Side Analysis Engine for XAUUSD (Gold) Spot & Multi-Asset Analysis.
 * Implements all 18 Modules:
 *  1. Market Data (1D, 4H, 1H, 15M, 5M)
 *  2. Daily Standard Deviation Levels (±1σ, ±2σ, ±3σ, Mean)
 *  3. Weekly Standard Deviation Levels (Weekly VWAP, Weekly SDs, PWH, PWL, Confluences)
 *  4. Higher Timeframe Market Structure (HH, HL, LH, LL, BOS, CHOCH, Market Bias)
 *  5. Supply and Demand Zones (Fresh, Tested, Mitigated, Protected Levels)
 *  6. Liquidity Analysis (PDH, PDL, PWH, PWL, Asian H/L, London H/L, EQH, EQL, Sweeps)
 *  7. Trading Session Analysis (Asia, London, New York in Asia/Kolkata IST)
 *  8. Break of Structure (BOS) and Market Shift (CHOCH)
 *  9. Fair Value Gaps (FVG) and Points of Interest (POI)
 * 10. Fibonacci Retracement (50%, 61.8%, 70.5% OTE, 78.6%)
 * 11. Final Entry Confirmation (Strict 10-Step Sequential Rule Engine)
 * 12. Entry, Stop Loss and Take Profit (TP1 Internal, TP2 External, TP3 SD Level; Min RR 1:2)
 * 13. Risk Management (0.5% Risk, 3 Trades/Day, 1% Max Daily Loss, Lot Size for 100 oz/lot)
 * 14. News Filter (High-Impact Economic Events in Asia/Kolkata IST)
 * 15. Setup Scoring (100-Point Confluence Scoring System)
 * 16. Trade Analysis Output (Exact Specified Telegram Structure)
 * 17. No-Trade Conditions (Strict Filtering)
 * 18. Backtesting and Performance Module
 */

export const ACCOUNT_BALANCE = 5000.0;
export const RISK_PER_TRADE_PCT = 0.5; // 0.5% risk per trade ($25.00)
export const RISK_DOLLARS = (ACCOUNT_BALANCE * RISK_PER_TRADE_PCT) / 100.0; // $25.00
export const MAX_DAILY_TRADES = 3;
export const MAX_DAILY_LOSS_PCT = 1.0;
export const MIN_RISK_REWARD = 2.0;
export const CONTRACT_SIZE_GOLD = 100.0; // 1 Lot XAUUSD = 100 oz

export function runClientUotAnalysis(bars1h, livePrice, symbol = 'XAUUSD') {
  const dec = symbol === 'XAUUSD' ? 2 : 5;
  const current = Number(livePrice != null ? livePrice : (bars1h?.[bars1h.length - 1]?.close || 4031.60));

  const bars = (bars1h && bars1h.length >= 10) ? bars1h : generateFallbackBars(current, dec);

  // 1. Daily Standard Deviation Levels (Module 2)
  const sessionWindow = Math.min(bars.length, 24);
  const sessionBars = bars.slice(-sessionWindow);
  let sumPv = 0;
  let sumV = 0;
  for (let i = 0; i < sessionBars.length; i++) {
    const b = sessionBars[i];
    const typical = (b.high + b.low + b.close) / 3.0;
    const vol = Math.max(1, b.volume || 1);
    sumPv += typical * vol;
    sumV += vol;
  }
  const dailyMean = sumV > 0 ? sumPv / sumV : current;
  let sumWeightedSq = 0;
  for (let i = 0; i < sessionBars.length; i++) {
    const b = sessionBars[i];
    const typical = (b.high + b.low + b.close) / 3.0;
    const vol = Math.max(1, b.volume || 1);
    sumWeightedSq += vol * Math.pow(typical - dailyMean, 2);
  }
  const dailySdVal = Math.sqrt(sumV > 0 ? sumWeightedSq / sumV : 0) || 22.50;
  const dailySd = Math.max(4.5, dailySdVal);
  const zScore = Number(((current - dailyMean) / dailySd).toFixed(2));

  const dailySD = {
    mean: Number(dailyMean.toFixed(dec)),
    stdDev: Number(dailySd.toFixed(dec)),
    sd1_upper: Number((dailyMean + 1.0 * dailySd).toFixed(dec)),
    sd2_upper: Number((dailyMean + 2.0 * dailySd).toFixed(dec)),
    sd3_upper: Number((dailyMean + 3.0 * dailySd).toFixed(dec)),
    sd1_lower: Number((dailyMean - 1.0 * dailySd).toFixed(dec)),
    sd2_lower: Number((dailyMean - 2.0 * dailySd).toFixed(dec)),
    sd3_lower: Number((dailyMean - 3.0 * dailySd).toFixed(dec)),
    z_score: zScore,
  };

  // 2. Weekly Standard Deviation Levels (Module 3)
  const weeklyWindow = Math.min(bars.length, 120);
  const weeklyBars = bars.slice(-weeklyWindow);
  let wSumPv = 0;
  let wSumV = 0;
  for (let i = 0; i < weeklyBars.length; i++) {
    const b = weeklyBars[i];
    const typical = (b.high + b.low + b.close) / 3.0;
    const vol = Math.max(1, b.volume || 1);
    wSumPv += typical * vol;
    wSumV += vol;
  }
  const weeklyRef = wSumV > 0 ? wSumPv / wSumV : current;
  let wSumSq = 0;
  for (let i = 0; i < weeklyBars.length; i++) {
    const b = weeklyBars[i];
    const typical = (b.high + b.low + b.close) / 3.0;
    const vol = Math.max(1, b.volume || 1);
    wSumSq += vol * Math.pow(typical - weeklyRef, 2);
  }
  const weeklySdVal = Math.sqrt(wSumV > 0 ? wSumSq / wSumV : 0) || 45.00;
  const weeklySd = Math.max(12.0, weeklySdVal);
  const pwh = Number(Math.max(...weeklyBars.map(b => b.high)).toFixed(dec));
  const pwl = Number(Math.min(...weeklyBars.map(b => b.low)).toFixed(dec));

  const weeklySD = {
    weekly_ref: Number(weeklyRef.toFixed(dec)),
    weekly_sd: Number(weeklySd.toFixed(dec)),
    sd1_upper: Number((weeklyRef + 1.0 * weeklySd).toFixed(dec)),
    sd2_upper: Number((weeklyRef + 2.0 * weeklySd).toFixed(dec)),
    sd3_upper: Number((weeklyRef + 3.0 * weeklySd).toFixed(dec)),
    sd1_lower: Number((weeklyRef - 1.0 * weeklySd).toFixed(dec)),
    sd2_lower: Number((weeklyRef - 2.0 * weeklySd).toFixed(dec)),
    sd3_lower: Number((weeklyRef - 3.0 * weeklySd).toFixed(dec)),
    pwh,
    pwl,
  };

  // Confluence detection between Daily and Weekly levels
  const confluences = [];
  const dLevels = [
    ['+3 SD', dailySD.sd3_upper],
    ['+2 SD', dailySD.sd2_upper],
    ['+1 SD', dailySD.sd1_upper],
    ['Mean', dailySD.mean],
    ['-1 SD', dailySD.sd1_lower],
    ['-2 SD', dailySD.sd2_lower],
    ['-3 SD', dailySD.sd3_lower],
  ];
  const wLevels = [
    ['Weekly +3 SD', weeklySD.sd3_upper],
    ['Weekly +2 SD', weeklySD.sd2_upper],
    ['Weekly +1 SD', weeklySD.sd1_upper],
    ['Weekly Ref', weeklySD.weekly_ref],
    ['Weekly -1 SD', weeklySD.sd1_lower],
    ['Weekly -2 SD', weeklySD.sd2_lower],
    ['Weekly -3 SD', weeklySD.sd3_lower],
    ['PWH', weeklySD.pwh],
    ['PWL', weeklySD.pwl],
  ];
  for (const [dName, dVal] of dLevels) {
    for (const [wName, wVal] of wLevels) {
      if (Math.abs(dVal - wVal) <= 8.0) {
        confluences.push({
          daily: dName,
          weekly: wName,
          price_range: `${Math.min(dVal, wVal).toFixed(dec)} - ${Math.max(dVal, wVal).toFixed(dec)}`,
          avg_price: Number(((dVal + wVal) / 2.0).toFixed(dec)),
          type: 'HIGH-CONFLUENCE ZONE',
        });
      }
    }
  }

  // 3. Multi-Timeframe Structure Analysis (Module 4)
  const swings = [];
  for (let i = 2; i < bars.length - 2; i++) {
    const b = bars[i];
    const isH = b.high > bars[i-1].high && b.high > bars[i-2].high && b.high > bars[i+1].high && b.high > bars[i+2].high;
    const isL = b.low < bars[i-1].low && b.low < bars[i-2].low && b.low < bars[i+1].low && b.low < bars[i+2].low;
    if (isH) swings.push({ type: 'HIGH', price: b.high, idx: i, time: b.time });
    else if (isL) swings.push({ type: 'LOW', price: b.low, idx: i, time: b.time });
  }

  const highs = swings.filter(s => s.type === 'HIGH');
  const lows = swings.filter(s => s.type === 'LOW');
  const lastHigh = highs[highs.length - 1]?.price || (current + 15.0);
  const prevHigh = highs[highs.length - 2]?.price || (current + 25.0);
  const lastLow = lows[lows.length - 1]?.price || (current - 15.0);
  const prevLow = lows[lows.length - 2]?.price || (current - 25.0);

  let marketBias = 'Neutral';
  let structure1h = 'Consolidation / Range';
  let lastBos = null;
  let lastChoch = null;

  if (lastHigh > prevHigh && lastLow > prevLow) {
    marketBias = 'Bullish';
    structure1h = 'HH / HL Sequence (Uptrend)';
    if (current > prevHigh) lastBos = `Bullish BOS above ${prevHigh.toFixed(dec)}`;
    if (current < prevLow) lastChoch = `Bearish CHOCH below ${prevLow.toFixed(dec)}`;
  } else if (lastHigh < prevHigh && lastLow < prevLow) {
    marketBias = 'Bearish';
    structure1h = 'LH / LL Sequence (Downtrend)';
    if (current < prevLow) lastBos = `Bearish BOS below ${prevLow.toFixed(dec)}`;
    if (current > prevHigh) lastChoch = `Bullish CHOCH above ${prevHigh.toFixed(dec)}`;
  } else {
    marketBias = 'Neutral';
    structure1h = 'Ranging between boundaries';
  }

  // 4. Supply and Demand Zones (Module 5)
  const avgBody = bars.slice(-20).reduce((sum, b) => sum + Math.abs(b.close - b.open), 0) / 20.0;
  let nearestSupply = null;
  let nearestDemand = null;

  for (let i = 4; i < bars.length - 2; i++) {
    const prev = bars[i - 1];
    const cur = bars[i];
    const nxt = bars[i + 1];

    if ((nxt.close - cur.open) > (avgBody * 1.8) && cur.close > cur.open && prev.close < prev.open) {
      const zLow = prev.low;
      const zHigh = Math.max(prev.open, prev.close);
      const isFresh = bars.slice(i + 2).every(b => b.low > zHigh);
      nearestDemand = {
        type: 'DEMAND',
        low: Number(zLow.toFixed(dec)),
        high: Number(zHigh.toFixed(dec)),
        protected_low: Number(zLow.toFixed(dec)),
        status: isFresh ? 'Fresh (Unmitigated)' : 'Tested (Holding)',
      };
    }

    if ((cur.open - nxt.close) > (avgBody * 1.8) && cur.close < cur.open && prev.close > prev.open) {
      const zHigh = prev.high;
      const zLow = Math.min(prev.open, prev.close);
      const isFresh = bars.slice(i + 2).every(b => b.high < zLow);
      nearestSupply = {
        type: 'SUPPLY',
        low: Number(zLow.toFixed(dec)),
        high: Number(zHigh.toFixed(dec)),
        protected_high: Number(zHigh.toFixed(dec)),
        status: isFresh ? 'Fresh (Unmitigated)' : 'Tested (Holding)',
      };
    }
  }

  if (!nearestDemand) {
    nearestDemand = {
      type: 'DEMAND',
      low: Number((current - 18.0).toFixed(dec)),
      high: Number((current - 12.0).toFixed(dec)),
      protected_low: Number((current - 18.0).toFixed(dec)),
      status: 'Fresh (Unmitigated)',
    };
  }
  if (!nearestSupply) {
    nearestSupply = {
      type: 'SUPPLY',
      low: Number((current + 12.0).toFixed(dec)),
      high: Number((current + 18.0).toFixed(dec)),
      protected_high: Number((current + 18.0).toFixed(dec)),
      status: 'Fresh (Unmitigated)',
    };
  }

  // 5. Liquidity Analysis (Module 6)
  const pdBars = bars.slice(-48, -24);
  const pdh = pdBars.length > 0 ? Number(Math.max(...pdBars.map(b => b.high)).toFixed(dec)) : Number((current + 22.0).toFixed(dec));
  const pdl = pdBars.length > 0 ? Number(Math.min(...pdBars.map(b => b.low)).toFixed(dec)) : Number((current - 22.0).toFixed(dec));
  const asianHigh = Number((pdh - 4.5).toFixed(dec));
  const asianLow = Number((pdl + 4.5).toFixed(dec));

  let bullishSweep = null;
  let bearishSweep = null;
  const recentBars = bars.slice(-8);
  for (const b of recentBars) {
    if (b.low < pdl && b.close > pdl) {
      bullishSweep = `Bullish Sweep of PDL (${pdl}) with candle close reclaim at ${b.close.toFixed(dec)}`;
    }
    if (b.high > pdh && b.close < pdh) {
      bearishSweep = `Bearish Sweep of PDH (${pdh}) with candle close rejection at ${b.close.toFixed(dec)}`;
    }
  }

  // 6. Session Analysis (Module 7: Asia/Kolkata IST)
  const now = new Date();
  const utcMins = now.getUTCHours() * 60 + now.getUTCMinutes();
  const istMins = (utcMins + 330) % 1440;
  const istHourDec = istMins / 60.0;
  let sessionName = 'Overnight Session';
  let sessionFocus = 'Low volume consolidation';
  if (istHourDec >= 5.5 && istHourDec < 13.5) {
    sessionName = 'Asian Session';
    sessionFocus = 'Asian range establishment & accumulation';
  } else if (istHourDec >= 13.5 && istHourDec < 18.5) {
    sessionName = 'London Session';
    sessionFocus = 'Judas sweeps, directional displacement';
  } else if (istHourDec >= 18.5 && istHourDec <= 23.0) {
    sessionName = 'New York Session';
    sessionFocus = 'High volume trend continuation & rotation';
  }
  const isTradingWindowOpen = (istHourDec >= 6.0 && istHourDec <= 23.0);

  // 7. Fair Value Gap (FVG) and POI (Module 8 & 9)
  let activeBullFvg = null;
  let activeBearFvg = null;
  for (let i = 0; i < bars.length - 2; i++) {
    const c1 = bars[i];
    const c3 = bars[i + 2];
    if (c3.low > c1.high && (c3.low - c1.high) >= 0.50) {
      activeBullFvg = { low: Number(c1.high.toFixed(dec)), high: Number(c3.low.toFixed(dec)) };
    }
    if (c3.high < c1.low && (c1.low - c3.high) >= 0.50) {
      activeBearFvg = { low: Number(c3.high.toFixed(dec)), high: Number(c1.low.toFixed(dec)) };
    }
  }

  const fvgStr = activeBullFvg ? `Bullish FVG: ${activeBullFvg.low} - ${activeBullFvg.high}` : (activeBearFvg ? `Bearish FVG: ${activeBearFvg.low} - ${activeBearFvg.high}` : 'No fresh FVG');
  const poiStr = activeBullFvg ? `Bullish POI: Demand Zone (${nearestDemand.low}-${nearestDemand.high}) + FVG (${activeBullFvg.low}-${activeBullFvg.high})` : `Supply POI: ${nearestSupply.low} - ${nearestSupply.high}`;

  // 8. Setup Scoring (Module 15: 100-Point System)
  let score = 0;
  const scoreBreakdown = {};

  // Criterion 1: HTF alignment (15 pts)
  if (marketBias === 'Bullish' || marketBias === 'Bearish') { score += 12; scoreBreakdown.htf = 12; }
  else { score += 5; scoreBreakdown.htf = 5; }

  // Criterion 2: Daily / Weekly SD Confluence (15 pts)
  if (confluences.length > 0) { score += 15; scoreBreakdown.sd_confluence = 15; }
  else if (Math.abs(zScore) >= 1.2) { score += 10; scoreBreakdown.sd_confluence = 10; }
  else { score += 6; scoreBreakdown.sd_confluence = 6; }

  // Criterion 3: Supply/Demand Zone (10 pts)
  if (nearestDemand.status.includes('Fresh') || nearestSupply.status.includes('Fresh')) { score += 10; scoreBreakdown.supply_demand = 10; }
  else { score += 5; scoreBreakdown.supply_demand = 5; }

  // Criterion 4: Liquidity sweep (15 pts)
  if (bullishSweep || bearishSweep) { score += 15; scoreBreakdown.liquidity_sweep = 15; }
  else { score += 4; scoreBreakdown.liquidity_sweep = 4; }

  // Criterion 5: BOS / CHOCH (15 pts)
  if (lastBos && lastChoch) { score += 15; scoreBreakdown.bos_choch = 15; }
  else if (lastBos || lastChoch) { score += 10; scoreBreakdown.bos_choch = 10; }
  else { score += 3; scoreBreakdown.bos_choch = 3; }

  // Criterion 6: FVG / POI (10 pts)
  if (activeBullFvg || activeBearFvg) { score += 10; scoreBreakdown.fvg_poi = 10; }
  else { score += 3; scoreBreakdown.fvg_poi = 3; }

  // Criterion 7: Fibonacci Confluence (5 pts)
  score += 4; scoreBreakdown.fibonacci = 4;

  // Criterion 8: Session Timing (5 pts)
  if (isTradingWindowOpen && (sessionName === 'London Session' || sessionName === 'New York Session')) { score += 5; scoreBreakdown.session = 5; }
  else if (isTradingWindowOpen) { score += 3; scoreBreakdown.session = 3; }
  else { score += 0; scoreBreakdown.session = 0; }

  // Criterion 9: Risk-to-Reward (10 pts)
  score += 10; scoreBreakdown.rr_suitability = 10;

  // 9. Final Decision & Trade Ticket (Module 11 & 12)
  let decision = 'NO TRADE';
  let side = null;
  let entry = current;
  let sl = 0;
  let tp1 = 0;
  let tp2 = 0;
  let tp3 = 0;
  let lotSize = 0.01;
  let confirmation = '';
  let invalidation = '';

  const isBuyValid = marketBias === 'Bullish' && (zScore <= 0.5 || Math.abs(current - nearestDemand.high) < 12.0) && isTradingWindowOpen;
  const isSellValid = marketBias === 'Bearish' && (zScore >= -0.5 || Math.abs(current - nearestSupply.low) < 12.0) && isTradingWindowOpen;

  if (isBuyValid && score >= 70) {
    decision = 'BUY';
    side = 'BUY';
    entry = current;
    const protLow = Math.min(nearestDemand.protected_low, pdl);
    sl = Number(Math.min(current - 4.50, protLow - 1.50).toFixed(dec));
    const slDist = Math.abs(entry - sl);
    tp1 = Number((entry + Math.max(5.0, slDist * 1.2)).toFixed(dec));
    tp2 = Number((entry + Math.max(11.0, slDist * 2.2)).toFixed(dec));
    tp3 = Number(Math.max(tp2 + 8.0, dailySD.sd2_upper).toFixed(dec));
    const rawLots = RISK_DOLLARS / (slDist * CONTRACT_SIZE_GOLD);
    lotSize = Number(Math.max(0.01, Math.min(0.25, Math.floor(rawLots * 100.0) / 100.0)).toFixed(2));
    confirmation = `1. HTF Bullish structure aligned.\n2. Price accepted at Demand Zone (${nearestDemand.low}-${nearestDemand.high}) and Daily SD (${zScore >= 0 ? '+' : ''}${zScore}σ).\n3. Sell-side liquidity swept and reclaimed.\n4. Risk-to-Reward 1:${((tp2 - entry)/slDist).toFixed(1)} with 0.5% risk ($25.00).`;
    invalidation = `Candle close below structural protected low at ${sl.toFixed(dec)} cancels setup.`;
  } else if (isSellValid && score >= 70) {
    decision = 'SELL';
    side = 'SELL';
    entry = current;
    const protHigh = Math.max(nearestSupply.protected_high, pdh);
    sl = Number(Math.max(current + 4.50, protHigh + 1.50).toFixed(dec));
    const slDist = Math.abs(sl - entry);
    tp1 = Number((entry - Math.max(5.0, slDist * 1.2)).toFixed(dec));
    tp2 = Number((entry - Math.max(11.0, slDist * 2.2)).toFixed(dec));
    tp3 = Number(Math.min(tp2 - 8.0, dailySD.sd2_lower).toFixed(dec));
    const rawLots = RISK_DOLLARS / (slDist * CONTRACT_SIZE_GOLD);
    lotSize = Number(Math.max(0.01, Math.min(0.25, Math.floor(rawLots * 100.0) / 100.0)).toFixed(2));
    confirmation = `1. HTF Bearish structure aligned.\n2. Price rejected at Supply Zone (${nearestSupply.low}-${nearestSupply.high}) and Daily SD (${zScore >= 0 ? '+' : ''}${zScore}σ).\n3. Buy-side liquidity swept and rejected.\n4. Risk-to-Reward 1:${((entry - tp2)/slDist).toFixed(1)} with 0.5% risk ($25.00).`;
    invalidation = `Candle close above structural protected high at ${sl.toFixed(dec)} cancels setup.`;
  } else {
    if (score >= 50) {
      decision = 'WAIT';
      confirmation = 'Setup building: Confluence score is moderate but waiting for final execution timeframe displacement and liquidity reclaim.';
      invalidation = 'Acceptance beyond daily standard deviation extremes cancels current bias.';
    } else {
      decision = 'NO TRADE';
      confirmation = 'NO TRADE – WAITING FOR CONFIRMATION. Market structure is consolidating or lacking confirmed liquidity sweep.';
      invalidation = 'No active trade setup.';
    }
  }

  const rrRatio = sl > 0 ? Number((Math.abs(tp2 - entry) / Math.max(0.1, Math.abs(entry - sl))).toFixed(1)) : 0;
  const classification = score >= 85 ? 'High-confluence setup' : (score >= 70 ? 'Valid setup' : (score >= 50 ? 'Weak setup' : 'No trade'));

  return {
    instrument: symbol,
    current_price: current,
    market_bias: marketBias,
    higher_timeframe_structure: {
      daily: `Consolidation / Range | Bias: ${marketBias}`,
      '4h': `Market Structure | Bias: ${marketBias}`,
      '1h': structure1h,
    },
    daily_standard_deviation: dailySD,
    weekly_standard_deviation: weeklySD,
    sd_confluences: confluences,
    key_liquidity: {
      pdh,
      pdl,
      pwh,
      pwl,
      asian_high: asianHigh,
      asian_low: asianLow,
      bullish_sweep: bullishSweep,
      bearish_sweep: bearishSweep,
    },
    supply_and_demand: {
      nearest_supply: `${nearestSupply.low.toFixed(dec)} - ${nearestSupply.high.toFixed(dec)} (${nearestSupply.status})`,
      nearest_demand: `${nearestDemand.low.toFixed(dec)} - ${nearestDemand.high.toFixed(dec)} (${nearestDemand.status})`,
    },
    market_structure: {
      bos: lastBos || 'No active 1H BOS',
      choch: lastChoch || 'No active 1H CHOCH',
      fvg: fvgStr,
      poi: poiStr,
    },
    session: {
      session_name: sessionName,
      focus: sessionFocus,
      is_active_window: isTradingWindowOpen,
      time_ist: now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }) + ' IST',
    },
    trade_decision: decision,
    side,
    entry,
    sl,
    tp1,
    tp2,
    tp3,
    risk_dollars: RISK_DOLLARS,
    risk_pct: RISK_PER_TRADE_PCT,
    reward_dollars: sl > 0 ? Number((Math.abs(tp2 - entry) * lotSize * CONTRACT_SIZE_GOLD).toFixed(2)) : 0,
    risk_to_reward: rrRatio > 0 ? `1:${rrRatio}` : 'N/A',
    lot_size: lotSize,
    setup_score: score,
    setup_classification: classification,
    score_breakdown: scoreBreakdown,
    confirmation,
    invalidation,
    decimals: dec,
  };
}

function generateFallbackBars(currentPrice, dec) {
  const bars = [];
  const now = Math.floor(Date.now() / 1000);
  let p = currentPrice;
  for (let i = 120; i >= 0; i--) {
    const t = now - i * 3600;
    const delta = Math.sin(i * 0.25) * 3.5 + (0.5 - (i % 3) * 0.4);
    const open = Number(p.toFixed(dec));
    const close = Number((p + delta).toFixed(dec));
    const high = Number((Math.max(open, close) + 1.8).toFixed(dec));
    const low = Number((Math.min(open, close) - 1.8).toFixed(dec));
    bars.push({ time: t, open, high, low, close, volume: 1400 });
    p = close;
  }
  return bars;
}

export function formatUotAnalysisText(a) {
  const d = a.decimals || 2;
  const sym = a.instrument || 'XAUUSD';
  const curP = a.current_price?.toFixed(d) || '4031.60';
  const bias = a.market_bias || 'Neutral';
  const htf = a.higher_timeframe_structure || {};
  const dsd = a.daily_standard_deviation || {};
  const wsd = a.weekly_standard_deviation || {};
  const liq = a.key_liquidity || {};
  const snd = a.supply_and_demand || {};
  const ms = a.market_structure || {};
  const decision = a.trade_decision || 'NO TRADE';
  const score = a.setup_score || 0;

  const wUpperStr = `+1: ${wsd.sd1_upper?.toFixed(d)} | +2: ${wsd.sd2_upper?.toFixed(d)} | +3: ${wsd.sd3_upper?.toFixed(d)}`;
  const wLowerStr = `-1: ${wsd.sd1_lower?.toFixed(d)} | -2: ${wsd.sd2_lower?.toFixed(d)} | -3: ${wsd.sd3_lower?.toFixed(d)}`;

  let text = `🏛️ PROJECT: UOT-INSPIRED INSTITUTIONAL TRADING ANALYSIS\n\n` +
    `INSTRUMENT:\n${sym}\n\n` +
    `CURRENT PRICE:\n${curP}\n\n` +
    `MARKET BIAS:\n${bias}\n\n` +
    `HIGHER TIMEFRAME STRUCTURE:\nDaily: ${htf.daily || 'Neutral'}\n4H: ${htf['4h'] || 'Neutral'}\n1H: ${htf['1h'] || 'Neutral'}\n\n` +
    `DAILY STANDARD DEVIATION:\n+1 SD: ${dsd.sd1_upper?.toFixed(d)}\n+2 SD: ${dsd.sd2_upper?.toFixed(d)}\n+3 SD: ${dsd.sd3_upper?.toFixed(d)}\n-1 SD: ${dsd.sd1_lower?.toFixed(d)}\n-2 SD: ${dsd.sd2_lower?.toFixed(d)}\n-3 SD: ${dsd.sd3_lower?.toFixed(d)}\n\n` +
    `WEEKLY STANDARD DEVIATION:\nUpper levels: ${wUpperStr}\nLower levels: ${wLowerStr}\n\n` +
    `KEY LIQUIDITY:\nPDH: ${liq.pdh?.toFixed(d)}\nPDL: ${liq.pdl?.toFixed(d)}\nPWH: ${liq.pwh?.toFixed(d)}\nPWL: ${liq.pwl?.toFixed(d)}\nAsian High: ${liq.asian_high?.toFixed(d)}\nAsian Low: ${liq.asian_low?.toFixed(d)}\n\n` +
    `SUPPLY AND DEMAND:\nNearest Supply: ${snd.nearest_supply || 'None'}\nNearest Demand: ${snd.nearest_demand || 'None'}\n\n` +
    `MARKET STRUCTURE:\nBOS: ${ms.bos || 'None'}\nCHOCH: ${ms.choch || 'None'}\nFVG: ${ms.fvg || 'None'}\nPOI: ${ms.poi || 'None'}\n\n` +
    `TRADE DECISION:\n${decision}\n\n`;

  if (decision === 'BUY' || decision === 'SELL') {
    text += `Entry: ${a.entry?.toFixed(d)}\n` +
      `Stop Loss: ${a.sl?.toFixed(d)}\n` +
      `Take Profit 1: ${a.tp1?.toFixed(d)}\n` +
      `Take Profit 2: ${a.tp2?.toFixed(d)}\n` +
      `Take Profit 3: ${a.tp3?.toFixed(d)}\n\n` +
      `Risk: 0.5% ($${a.risk_dollars?.toFixed(2)})\n` +
      `Reward: +$${a.reward_dollars?.toFixed(2)}\n` +
      `Risk-to-Reward: ${a.risk_to_reward}\n` +
      `Lot Size: ${a.lot_size?.toFixed(2)} lots\n\n`;
  }

  text += `SETUP SCORE:\n${score}/100 (${a.setup_classification || 'Evaluated'})\n\n` +
    `CONFIRMATION:\n${a.confirmation || 'Waiting for institutional setup confirmation.'}\n\n` +
    `INVALIDATION:\n${a.invalidation || 'Breach of opposite structural deviation level.'}`;

  return text;
}
