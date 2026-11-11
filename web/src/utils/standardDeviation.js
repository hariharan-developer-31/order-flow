/**
 * Daily Standard Deviation & Institutional VWAP Volatility Engine
 * Calculates Daily Volume-Weighted Average Price (VWAP) and Standard Deviation Bands (±0.5σ, ±1σ, ±1.5σ, ±2σ, ±3σ).
 * Used by institutional quantitative desks for expected moves, fair value equilibrium, and statistical exhaustion.
 */

export function calculateDailyStandardDeviation(bars, livePrice, symbol = 'XAUUSD') {
  if (!bars || bars.length === 0) {
    const fallbackPrice = livePrice || 4050.0;
    const fallbackSd = symbol === 'XAUUSD' ? 22.50 : 0.0085;
    return generateStaticSdLevels(fallbackPrice, fallbackSd, symbol);
  }

  // 1. Isolate the current trading session bars (or trailing 24 bars for 24/7 Gold continuity)
  // Gold trades 23 hours/day. If current day's bars are few (e.g. session start), use trailing 24 hours.
  const sessionWindow = Math.min(bars.length, 24);
  const sessionBars = bars.slice(-sessionWindow);

  let sumPv = 0;
  let sumV = 0;
  let highDay = -Infinity;
  let lowDay = Infinity;

  for (let i = 0; i < sessionBars.length; i++) {
    const b = sessionBars[i];
    const typicalPrice = (b.high + b.low + b.close) / 3.0;
    const vol = Math.max(1, b.volume || 1);

    sumPv += typicalPrice * vol;
    sumV += vol;

    if (b.high > highDay) highDay = b.high;
    if (b.low < lowDay) lowDay = b.low;
  }

  const vwap = sumV > 0 ? sumPv / sumV : (sessionBars[sessionBars.length - 1].close || 4050.0);

  // 2. Compute Volume-Weighted Variance and Standard Deviation (σ)
  let sumWeightedSquaredDiff = 0;
  for (let i = 0; i < sessionBars.length; i++) {
    const b = sessionBars[i];
    const typicalPrice = (b.high + b.low + b.close) / 3.0;
    const vol = Math.max(1, b.volume || 1);
    sumWeightedSquaredDiff += vol * Math.pow(typicalPrice - vwap, 2);
  }

  const variance = sumV > 0 ? sumWeightedSquaredDiff / sumV : 0;
  let stdDev = Math.sqrt(variance);

  // Fallback sanity floor based on asset ATR
  const minSd = symbol === 'XAUUSD' ? 4.50 : 0.0015;
  if (!stdDev || stdDev < minSd || isNaN(stdDev)) {
    const avgRange = sessionBars.reduce((acc, b) => acc + (b.high - b.low), 0) / sessionBars.length;
    stdDev = Math.max(minSd, avgRange * 1.5);
  }

  const dec = symbol === 'XAUUSD' ? 2 : 5;
  const current = Number(livePrice != null ? livePrice : sessionBars[sessionBars.length - 1].close);

  // 3. Compute Standard Deviation Levels (±0.5σ, ±1.0σ, ±1.5σ, ±2.0σ, ±3.0σ)
  const round = (val) => Number(val.toFixed(dec));

  const sd3Upper = round(vwap + 3.0 * stdDev);
  const sd2Upper = round(vwap + 2.0 * stdDev);
  const sd15Upper = round(vwap + 1.5 * stdDev);
  const sd1Upper = round(vwap + 1.0 * stdDev);
  const sd05Upper = round(vwap + 0.5 * stdDev);
  const mean = round(vwap);
  const sd05Lower = round(vwap - 0.5 * stdDev);
  const sd1Lower = round(vwap - 1.0 * stdDev);
  const sd15Lower = round(vwap - 1.5 * stdDev);
  const sd2Lower = round(vwap - 2.0 * stdDev);
  const sd3Lower = round(vwap - 3.0 * stdDev);

  // 4. Compute Live Z-Score and Volatility Regime
  const zScore = stdDev > 0 ? Number(((current - vwap) / stdDev).toFixed(2)) : 0;
  const distFromVWAP = round(current - vwap);

  let regime = 'Fair Value Equilibrium';
  let regimeColor = '#0D0D0C';
  let regimeAction = 'Balance / Rotation inside ±0.5σ equilibrium';

  if (zScore >= 3.0) {
    regime = 'Extreme Statistical Outlier (+3σ+)';
    regimeColor = '#F2772F';
    regimeAction = 'High-probability reversal / exhaustion fade watch';
  } else if (zScore >= 2.0) {
    regime = 'Overbought Extension (+2σ to +3σ)';
    regimeColor = '#E9C22E';
    regimeAction = 'Institutional mean-reversion fade zone';
  } else if (zScore >= 1.0) {
    regime = 'Bullish Volatility Expansion (+1σ to +2σ)';
    regimeColor = '#C564C4';
    regimeAction = 'Trend momentum continuation towards +2σ';
  } else if (zScore >= 0.5) {
    regime = 'Upper Balance Range (+0.5σ to +1σ)';
    regimeColor = '#3FB874';
    regimeAction = 'Acceptance above value; testing upper expected move';
  } else if (zScore <= -3.0) {
    regime = 'Extreme Statistical Capitulation (-3σ-)';
    regimeColor = '#F2772F';
    regimeAction = 'Climactic sell exhaustion / capitulation bounce watch';
  } else if (zScore <= -2.0) {
    regime = 'Oversold Underextension (-2σ to -3σ)';
    regimeColor = '#3FB874';
    regimeAction = 'Institutional absorption / mean-reversion bounce zone';
  } else if (zScore <= -1.0) {
    regime = 'Bearish Volatility Expansion (-1σ to -2σ)';
    regimeColor = '#C564C4';
    regimeAction = 'Trend momentum continuation towards -2σ';
  } else if (zScore <= -0.5) {
    regime = 'Lower Balance Range (-0.5σ to -1σ)';
    regimeColor = '#3FB874';
    regimeAction = 'Acceptance below value; testing lower expected move';
  }

  // 5. Build structured levels array for UI tables and meters
  const levels = [
    {
      sigma: '+3.0σ',
      name: 'Extreme Outlier Ceiling',
      price: sd3Upper,
      dist: round(sd3Upper - current),
      probability: '99.7% Normal Distribution Limit',
      type: 'resistance_extreme',
      color: '#F2772F',
    },
    {
      sigma: '+2.0σ',
      name: 'Major Resistance / Exhaustion Fade',
      price: sd2Upper,
      dist: round(sd2Upper - current),
      probability: '95.4% Expected Range Bound',
      type: 'resistance_major',
      color: '#E9C22E',
    },
    {
      sigma: '+1.5σ',
      name: 'Extended Expansion Level',
      price: sd15Upper,
      dist: round(sd15Upper - current),
      probability: '86.6% Cumulative Probability',
      type: 'resistance_minor',
      color: '#C564C4',
    },
    {
      sigma: '+1.0σ',
      name: 'Upper Expected Move (Value Area)',
      price: sd1Upper,
      dist: round(sd1Upper - current),
      probability: '68.2% Normal Volatility Range',
      type: 'expected_upper',
      color: '#C564C4',
    },
    {
      sigma: '+0.5σ',
      name: 'Half Standard Expansion',
      price: sd05Upper,
      dist: round(sd05Upper - current),
      probability: '38.3% Expansion Pivot',
      type: 'pivot_upper',
      color: '#0D0D0C',
    },
    {
      sigma: '0.0σ',
      name: 'Daily Session VWAP (Fair Value)',
      price: mean,
      dist: round(mean - current),
      probability: 'Central Mean Equilibrium',
      type: 'mean',
      color: '#0D0D0C',
      isMean: true,
    },
    {
      sigma: '-0.5σ',
      name: 'Half Standard Contraction',
      price: sd05Lower,
      dist: round(sd05Lower - current),
      probability: '38.3% Contraction Pivot',
      type: 'pivot_lower',
      color: '#0D0D0C',
    },
    {
      sigma: '-1.0σ',
      name: 'Lower Expected Move (Value Area)',
      price: sd1Lower,
      dist: round(sd1Lower - current),
      probability: '68.2% Normal Volatility Range',
      type: 'expected_lower',
      color: '#3FB874',
    },
    {
      sigma: '-1.5σ',
      name: 'Extended Contraction Level',
      price: sd15Lower,
      dist: round(sd15Lower - current),
      probability: '86.6% Cumulative Probability',
      type: 'support_minor',
      color: '#3FB874',
    },
    {
      sigma: '-2.0σ',
      name: 'Major Support / Absorption Bounce',
      price: sd2Lower,
      dist: round(sd2Lower - current),
      probability: '95.4% Expected Range Bound',
      type: 'support_major',
      color: '#3FB874',
    },
    {
      sigma: '-3.0σ',
      name: 'Extreme Capitulation Floor',
      price: sd3Lower,
      dist: round(sd3Lower - current),
      probability: '99.7% Normal Distribution Limit',
      type: 'support_extreme',
      color: '#F2772F',
    },
  ];

  return {
    symbol,
    livePrice: current,
    vwap: mean,
    stdDev: round(stdDev),
    zScore,
    distFromVWAP,
    regime,
    regimeColor,
    regimeAction,
    levels,
    sd3Upper,
    sd2Upper,
    sd1Upper,
    sd05Upper,
    mean,
    sd05Lower,
    sd1Lower,
    sd2Lower,
    sd3Lower,
    dayHigh: round(highDay),
    dayLow: round(lowDay),
    dayRange: round(highDay - lowDay),
    decimals: dec,
  };
}

function generateStaticSdLevels(price, sd, symbol) {
  const dec = symbol === 'XAUUSD' ? 2 : 5;
  const round = (val) => Number(val.toFixed(dec));
  const vwap = round(price);
  const stdDev = round(sd);

  return {
    symbol,
    livePrice: vwap,
    vwap,
    stdDev,
    zScore: 0.0,
    distFromVWAP: 0.0,
    regime: 'Fair Value Equilibrium',
    regimeColor: '#0D0D0C',
    regimeAction: 'Balance / Rotation inside ±0.5σ equilibrium',
    levels: [],
    sd3Upper: round(vwap + 3 * stdDev),
    sd2Upper: round(vwap + 2 * stdDev),
    sd1Upper: round(vwap + 1 * stdDev),
    sd05Upper: round(vwap + 0.5 * stdDev),
    mean: vwap,
    sd05Lower: round(vwap - 0.5 * stdDev),
    sd1Lower: round(vwap - 1 * stdDev),
    sd2Lower: round(vwap - 2 * stdDev),
    sd3Lower: round(vwap - 3 * stdDev),
    dayHigh: round(vwap + stdDev),
    dayLow: round(vwap - stdDev),
    dayRange: round(2 * stdDev),
    decimals: dec,
  };
}
