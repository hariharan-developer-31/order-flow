import React from 'react';
import AtasFootprintChart from './AtasFootprintChart';

export default function FootprintChart({
  symbol = 'XAUUSD',
  footprintData = [],
  currentPrice = null,
  timeframe = '1h',
  onSelectTimeframe = null,
  decimals = 2,
  barsData = [],
}) {
  return (
    <AtasFootprintChart
      symbol={symbol}
      footprintData={footprintData}
      currentPrice={currentPrice}
      timeframe={timeframe}
      onSelectTimeframe={onSelectTimeframe}
      decimals={decimals}
      barsData={barsData}
      height={580}
    />
  );
}
