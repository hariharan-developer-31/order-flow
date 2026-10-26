import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, BarChart2 } from 'lucide-react';

export default function CandleChart({ symbol, barsData, orderFlowData, decimals = 2 }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const priceLinesRef = useRef([]);

  const [hoverData, setHoverData] = useState(null);
  const [lwReady, setLwReady] = useState(() => !!window.LightweightCharts);

  const of = orderFlowData?.find((o) => o.symbol === symbol);

  // Poll for window.LightweightCharts if it was slow to load from CDN
  useEffect(() => {
    if (window.LightweightCharts) {
      setLwReady(true);
      return;
    }
    const interval = setInterval(() => {
      if (window.LightweightCharts) {
        setLwReady(true);
        clearInterval(interval);
      }
    }, 150);
    return () => clearInterval(interval);
  }, []);

  // 1. Initialize Chart instance with Pristine White Theme
  useEffect(() => {
    if (!chartContainerRef.current || !window.LightweightCharts) return;

    // Clean up previous instance
    if (chartRef.current) {
      try {
        chartRef.current.remove();
      } catch (e) {}
      chartRef.current = null;
    }

    const containerWidth = chartContainerRef.current.clientWidth || 800;

    const chart = window.LightweightCharts.createChart(chartContainerRef.current, {
      width: containerWidth,
      height: 480,
      layout: {
        background: { type: 'solid', color: '#ffffff' },
        textColor: '#334155',
        fontFamily: 'Inter, sans-serif',
        fontSize: 12,
      },
      grid: {
        vertLines: { color: '#f1f5f9' },
        horzLines: { color: '#f1f5f9' },
      },
      crosshair: {
        mode: window.LightweightCharts.CrosshairMode.Normal,
        vertLine: {
          color: '#cbd5e1',
          width: 1,
          style: 3,
          labelBackgroundColor: '#0f172a',
        },
        horzLine: {
          color: '#cbd5e1',
          width: 1,
          style: 3,
          labelBackgroundColor: '#0f172a',
        },
      },
      rightPriceScale: {
        borderColor: '#e2e8f0',
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: '#e2e8f0',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    // Candlestick Series (Crisp green / red)
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: true,
      borderUpColor: '#059669',
      borderDownColor: '#dc2626',
      wickUpColor: '#059669',
      wickDownColor: '#dc2626',
      priceFormat: {
        type: 'price',
        precision: decimals,
        minMove: 1 / Math.pow(10, decimals),
      },
    });

    // Volume Histogram at bottom
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      scaleMargins: {
        top: 0.82,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Crosshair move handler
    chart.subscribeCrosshairMove((param) => {
      if (
        !param.time ||
        param.point?.x < 0 ||
        param.point?.x > chartContainerRef.current?.clientWidth ||
        param.point?.y < 0 ||
        param.point?.y > chartContainerRef.current?.clientHeight
      ) {
        setHoverData(null);
      } else {
        const cData = param.seriesData.get(candleSeries);
        const vData = param.seriesData.get(volumeSeries);
        if (cData) {
          setHoverData({
            ...cData,
            volume: vData?.value,
          });
        }
      }
    });

    // Resize observer
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        try {
          chartRef.current.remove();
        } catch (e) {}
        chartRef.current = null;
      }
    };
  }, [decimals, lwReady]);

  // 2. Update Candlestick and Volume Data
  useEffect(() => {
    if (!barsData || barsData.length === 0 || !candleSeriesRef.current || !volumeSeriesRef.current) {
      return;
    }

    try {
      // Deduplicate and strictly sort bars ascending by timestamp
      const timeMap = new Map();
      barsData.forEach((b) => {
        const t = Math.floor(Number(b.time));
        if (!isNaN(t) && b.open != null && b.close != null) {
          timeMap.set(t, {
            time: t,
            open: Number(b.open),
            high: Number(b.high),
            low: Number(b.low),
            close: Number(b.close),
            volume: Number(b.volume || 1),
          });
        }
      });

      const sortedBars = Array.from(timeMap.values()).sort((a, b) => a.time - b.time);

      const formattedBars = sortedBars.map((b) => ({
        time: b.time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      }));

      const formattedVolumes = sortedBars.map((b) => ({
        time: b.time,
        value: b.volume || 1.0,
        color: b.close >= b.open ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)',
      }));

      candleSeriesRef.current.setData(formattedBars);
      volumeSeriesRef.current.setData(formattedVolumes);

      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }
    } catch (err) {
      console.warn('[CHART] Error applying bar data:', err);
    }
  }, [barsData, lwReady]);

  // 3. Update Institutional Order Flow Price Lines (POC, VAH, VAL, PDH, PDL)
  useEffect(() => {
    if (!candleSeriesRef.current || !of) return;

    // Remove previous lines
    priceLinesRef.current.forEach((line) => {
      try {
        candleSeriesRef.current.removePriceLine(line);
      } catch (e) {}
    });
    priceLinesRef.current = [];

    // 1. Point of Control (Gold Solid Line)
    if (of.pPOC) {
      try {
        const pocLine = candleSeriesRef.current.createPriceLine({
          price: of.pPOC,
          color: '#d97706',
          lineWidth: 2,
          lineStyle: 0, // Solid
          axisLabelVisible: true,
          title: `POC: ${of.pPOC.toFixed(decimals)}`,
        });
        priceLinesRef.current.push(pocLine);
      } catch (e) {}
    }

    // 2. Value Area High (VAH - Blue Line)
    if (of.pVAH) {
      try {
        const vahLine = candleSeriesRef.current.createPriceLine({
          price: of.pVAH,
          color: '#2563eb',
          lineWidth: 1.5,
          lineStyle: 2, // Dashed
          axisLabelVisible: true,
          title: `VAH: ${of.pVAH.toFixed(decimals)}`,
        });
        priceLinesRef.current.push(vahLine);
      } catch (e) {}
    }

    // 3. Value Area Low (VAL - Blue Line)
    if (of.pVAL) {
      try {
        const valLine = candleSeriesRef.current.createPriceLine({
          price: of.pVAL,
          color: '#2563eb',
          lineWidth: 1.5,
          lineStyle: 2, // Dashed
          axisLabelVisible: true,
          title: `VAL: ${of.pVAL.toFixed(decimals)}`,
        });
        priceLinesRef.current.push(valLine);
      } catch (e) {}
    }

    // 4. Prior Day High (PDH - Slate Dashed)
    if (of.pHigh) {
      try {
        const pdhLine = candleSeriesRef.current.createPriceLine({
          price: of.pHigh,
          color: '#64748b',
          lineWidth: 1,
          lineStyle: 1, // Dotted
          axisLabelVisible: true,
          title: `PDH: ${of.pHigh.toFixed(decimals)}`,
        });
        priceLinesRef.current.push(pdhLine);
      } catch (e) {}
    }

    // 5. Prior Day Low (PDL - Slate Dashed)
    if (of.pLow) {
      try {
        const pdlLine = candleSeriesRef.current.createPriceLine({
          price: of.pLow,
          color: '#64748b',
          lineWidth: 1,
          lineStyle: 1, // Dotted
          axisLabelVisible: true,
          title: `PDL: ${of.pLow.toFixed(decimals)}`,
        });
        priceLinesRef.current.push(pdlLine);
      } catch (e) {}
    }
  }, [of, decimals, lwReady]);

  const latestBar = barsData && barsData.length > 0 ? barsData[barsData.length - 1] : null;
  const displayBar = hoverData || latestBar;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
      {/* Chart Top Header & Legend */}
      <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-slate-900 text-sm tracking-tight">
              {symbol}
            </span>
            <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
              1H Candle
            </span>
          </div>

          {/* OHLC Bar Legend */}
          {displayBar && (
            <div className="hidden sm:flex items-center gap-3 text-xs font-mono">
              <span className="text-slate-500">
                O: <b className="text-slate-900">{displayBar.open?.toFixed(decimals)}</b>
              </span>
              <span className="text-slate-500">
                H: <b className="text-emerald-700">{displayBar.high?.toFixed(decimals)}</b>
              </span>
              <span className="text-slate-500">
                L: <b className="text-rose-700">{displayBar.low?.toFixed(decimals)}</b>
              </span>
              <span className="text-slate-500">
                C: <b className="text-slate-900">{displayBar.close?.toFixed(decimals)}</b>
              </span>
              {displayBar.volume && (
                <span className="text-slate-500">
                  Vol: <b className="text-slate-900">{displayBar.volume.toLocaleString()}</b>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Legend Pills */}
        <div className="flex items-center gap-2 text-[11px] font-semibold">
          <span className="flex items-center gap-1 text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            <span className="w-2 h-0.5 bg-amber-500 rounded"></span> POC
          </span>
          <span className="flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
            <span className="w-2 h-0.5 bg-blue-600 rounded"></span> VAH/VAL (70%)
          </span>
          <span className="flex items-center gap-1 text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
            <span className="w-2 h-0.5 bg-slate-400 rounded"></span> PDH/PDL
          </span>
        </div>
      </div>

      {/* Chart Canvas Container */}
      <div className="relative w-full" style={{ height: 480 }}>
        <div ref={chartContainerRef} className="w-full h-full" />
      </div>
    </div>
  );
}
