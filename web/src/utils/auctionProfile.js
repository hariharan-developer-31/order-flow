/**
 * Institutional Auction Profile Calculator
 * Generates synchronized 3-column data:
 *   1. VOLUME PROFILE (with Dual Distributions, LVN & POC)
 *   2. BID/ASK DELTA (with Outlier Aggression Detection)
 *   3. TPO MARKET PROFILE (with Time Price Opportunity Blocks & Single Prints)
 */

export function calculateAuctionProfile(bars, footprintData = [], numBins = 26) {
  if (!bars || bars.length === 0) return null;

  // Use recent session bars (e.g. last 48 bars for 1h/15m)
  const sessionBars = bars.slice(-48);

  let minP = Infinity;
  let maxP = -Infinity;
  let totalSessionVol = 0;

  for (let i = 0; i < sessionBars.length; i++) {
    const b = sessionBars[i];
    if (b.low < minP) minP = b.low;
    if (b.high > maxP) maxP = b.high;
    totalSessionVol += (b.volume || 1);
  }

  if (minP >= maxP || totalSessionVol <= 0) return null;

  const range = maxP - minP;
  const binStep = range / numBins;

  // Initialize bins from lowest price to highest price
  const bins = [];
  for (let i = 0; i < numBins; i++) {
    const low = minP + i * binStep;
    const high = low + binStep;
    bins.push({
      index: i,
      price: (low + high) / 2,
      low,
      high,
      volume: 0,
      buyVol: 0,
      sellVol: 0,
      delta: 0,
      tpoLetters: [],
      tpoCount: 0,
      isPoc: false,
      isLvn: false,
      isOutlier: false,
      isSinglePrint: false,
      distribution: 'lower', // 'upper' | 'lower'
      inVA: false,
    });
  }

  // Bracket letters for TPO periods: A, B, C, D, ...
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const getLetter = (idx) => letters[idx % letters.length];

  // Distribute Volume, Delta and TPOs across price bins
  sessionBars.forEach((bar, bIdx) => {
    const bVol = bar.volume || 1200;
    const isBull = bar.close >= bar.open;
    const bracket = getLetter(bIdx);

    const startIdx = Math.max(0, Math.min(numBins - 1, Math.floor((bar.low - minP) / binStep)));
    const endIdx = Math.max(0, Math.min(numBins - 1, Math.floor((bar.high - minP) / binStep)));
    const binCount = Math.max(1, endIdx - startIdx + 1);
    const volEach = bVol / binCount;

    for (let j = startIdx; j <= endIdx; j++) {
      let buyRatio = isBull ? 0.60 : 0.40;
      if (j === startIdx) buyRatio = isBull ? 0.72 : 0.45;
      if (j === endIdx) buyRatio = isBull ? 0.65 : 0.28;

      const buy = Math.round(volEach * buyRatio);
      const sell = Math.round(volEach * (1 - buyRatio));

      bins[j].volume += (buy + sell);
      bins[j].buyVol += buy;
      bins[j].sellVol += sell;
      bins[j].delta += (buy - sell);

      if (!bins[j].tpoLetters.includes(bracket)) {
        bins[j].tpoLetters.push(bracket);
        bins[j].tpoCount++;
      }
    }
  });

  // Blend actual footprint delta if available
  if (footprintData && footprintData.length > 0) {
    footprintData.forEach((fpBar) => {
      if (fpBar.clusters && fpBar.clusters.length > 0) {
        fpBar.clusters.forEach((c) => {
          const bIdx = Math.max(0, Math.min(numBins - 1, Math.floor((c.price - minP) / binStep)));
          if (bins[bIdx]) {
            bins[bIdx].delta += (c.delta || 0) * 0.35;
          }
        });
      }
    });
  }

  // 1. Identify POC (Point of Control with maximum volume)
  let maxVol = 0;
  let pocIdx = 0;
  for (let i = 0; i < numBins; i++) {
    if (bins[i].volume > maxVol) {
      maxVol = bins[i].volume;
      pocIdx = i;
    }
  }
  bins[pocIdx].isPoc = true;

  // 2. Identify 70% Value Area
  const targetVa = totalSessionVol * 0.70;
  let vaSum = bins[pocIdx].volume;
  const vaSet = new Set([pocIdx]);
  let up = pocIdx + 1;
  let dn = pocIdx - 1;

  while (vaSum < targetVa && (up < numBins || dn >= 0)) {
    const vUp = up < numBins ? bins[up].volume : -1;
    const vDn = dn >= 0 ? bins[dn].volume : -1;
    if (vUp >= vDn && vUp >= 0) {
      vaSet.add(up);
      vaSum += vUp;
      up++;
    } else if (vDn >= 0) {
      vaSet.add(dn);
      vaSum += vDn;
      dn--;
    } else {
      break;
    }
  }

  const vaIndices = Array.from(vaSet);
  const minVaIdx = Math.min(...vaIndices);
  const maxVaIdx = Math.max(...vaIndices);
  for (let i = 0; i < numBins; i++) {
    bins[i].inVA = vaSet.has(i);
  }

  // 3. Identify LVN (Low Volume Node): find natural trough between upper and lower nodes
  // Search in the middle 50% between 25% and 75% height
  let minVol = Infinity;
  let lvnIdx = Math.floor(numBins * 0.50);
  for (let i = Math.floor(numBins * 0.30); i <= Math.floor(numBins * 0.70); i++) {
    // Avoid POC
    if (i !== pocIdx && bins[i].volume < minVol) {
      minVol = bins[i].volume;
      lvnIdx = i;
    }
  }
  bins[lvnIdx].isLvn = true;

  // Assign Upper vs Lower distribution relative to LVN
  for (let i = 0; i < numBins; i++) {
    bins[i].distribution = i > lvnIdx ? 'upper' : 'lower';
  }

  // 4. Identify Delta OUTLIER: maximum positive delta aggression / absorption
  let maxPosDelta = -Infinity;
  let outlierIdx = Math.min(numBins - 1, lvnIdx + 1);
  for (let i = 0; i < numBins; i++) {
    if (bins[i].delta > maxPosDelta) {
      maxPosDelta = bins[i].delta;
      outlierIdx = i;
    }
  }
  // Ensure outlier is marked
  bins[outlierIdx].isOutlier = true;

  // 5. Identify Single Prints: low TPO brackets near the LVN fast-auction zone
  let foundSingle = false;
  for (let i = Math.max(0, lvnIdx - 2); i <= Math.min(numBins - 1, lvnIdx + 2); i++) {
    if (bins[i].tpoCount <= 3 && !bins[i].isPoc) {
      bins[i].isSinglePrint = true;
      foundSingle = true;
    }
  }
  // Fallback: at least LVN itself is marked as single print if no other bin qualified
  if (!foundSingle && bins[lvnIdx]) {
    bins[lvnIdx].isSinglePrint = true;
  }

  // Calculate maximum metrics for scaling bars
  const maxVolume = Math.max(...bins.map((b) => b.volume), 1);
  const maxAbsDelta = Math.max(...bins.map((b) => Math.abs(b.delta)), 1);
  const maxTpoCount = Math.max(...bins.map((b) => b.tpoCount), 1);
  const netCvd = bins.reduce((acc, b) => acc + b.delta, 0);

  // Return rows sorted from HIGHEST PRICE to LOWEST PRICE (natural price ladder)
  const rows = [...bins].reverse();

  return {
    rows,
    pocPrice: bins[pocIdx].price,
    lvnPrice: bins[lvnIdx].price,
    outlierPrice: bins[outlierIdx].price,
    vahPrice: bins[maxVaIdx].high,
    valPrice: bins[minVaIdx].low,
    maxVolume,
    maxAbsDelta,
    maxTpoCount,
    netCvd: Math.round(netCvd),
    totalSessionVol: Math.round(totalSessionVol),
    binStep,
    minP,
    maxP,
  };
}
