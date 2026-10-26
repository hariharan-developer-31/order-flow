/**
 * Calculate dynamic Volume Profile across candlestick bars.
 * Ensures the Volume Profile covers the full price height of active price action.
 * Exported so that the Chart and all Above Data Boxes share the exact same POC, VAH, VAL!
 */
export function calculateDynamicVolumeProfile(bars, numBins = 55) {
  if (!bars || bars.length === 0) return null;

  let minP = Infinity;
  let maxP = -Infinity;
  let totalVol = 0;

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    if (b.low < minP) minP = b.low;
    if (b.high > maxP) maxP = b.high;
    totalVol += b.volume || 1;
  }

  if (minP >= maxP || totalVol <= 0) return null;

  const range = maxP - minP;
  const binStep = range / numBins;

  const bins = [];
  for (let i = 0; i < numBins; i++) {
    const low = minP + i * binStep;
    const high = low + binStep;
    bins.push({
      price: (low + high) / 2,
      low,
      high,
      buyVol: 0,
      sellVol: 0,
      totalVol: 0,
    });
  }

  // Distribute volume per bar across overlapping price bins
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const bVol = b.volume || 1;
    const isBull = b.close >= b.open;
    const buyFrac = isBull ? 0.65 : 0.35;
    const sellFrac = 1.0 - buyFrac;

    const startBinIdx = Math.max(0, Math.min(numBins - 1, Math.floor((b.low - minP) / binStep)));
    const endBinIdx = Math.max(0, Math.min(numBins - 1, Math.floor((b.high - minP) / binStep)));
    const count = Math.max(1, endBinIdx - startBinIdx + 1);
    const volEach = bVol / count;

    for (let j = startBinIdx; j <= endBinIdx; j++) {
      bins[j].buyVol += volEach * buyFrac;
      bins[j].sellVol += volEach * sellFrac;
      bins[j].totalVol += volEach;
    }
  }

  // Find POC (Point of Control with maximum volume)
  let maxVol = 0;
  let pocIdx = 0;
  for (let i = 0; i < numBins; i++) {
    if (bins[i].totalVol > maxVol) {
      maxVol = bins[i].totalVol;
      pocIdx = i;
    }
  }

  // Compute 70% Value Area
  const targetVa = totalVol * 0.7;
  let vaSum = bins[pocIdx].totalVol;
  const vaSet = new Set([pocIdx]);
  let up = pocIdx + 1;
  let dn = pocIdx - 1;

  while (vaSum < targetVa && (up < numBins || dn >= 0)) {
    const vUp = up < numBins ? bins[up].totalVol : -1;
    const vDn = dn >= 0 ? bins[dn].totalVol : -1;
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

  const vaArr = Array.from(vaSet);
  const minVaIdx = Math.min(...vaArr);
  const maxVaIdx = Math.max(...vaArr);

  for (let i = 0; i < numBins; i++) {
    bins[i].isPOC = i === pocIdx;
    bins[i].inVA = vaSet.has(i);
  }

  return {
    bins,
    pocPrice: bins[pocIdx].price,
    vahPrice: bins[maxVaIdx].high,
    valPrice: bins[minVaIdx].low,
    maxVol,
    minP,
    maxP,
    pdh: maxP,
    pdl: minP,
    totalVol,
  };
}
