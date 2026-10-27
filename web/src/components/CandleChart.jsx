import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, CrosshairMode, CandlestickSeries } from 'lightweight-charts';
import {
  Maximize2,
  Minimize2,
  Crosshair,
  TrendingUp,
  Minus,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  Undo2,
  BarChart3,
  Eye,
  EyeOff,
  Flame,
  ArrowUp,
  ArrowDown,
  Clock,
} from 'lucide-react';

import { calculateDynamicVolumeProfile } from '../utils/volumeProfile';
import AtasFootprintChart from './AtasFootprintChart';

function toDate(time) {
  if (typeof time === 'number') return new Date(time * 1000);
  if (time && typeof time === 'object' && 'year' in time) {
    return new Date(Date.UTC(time.year, time.month - 1, time.day));
  }
  return new Date(time);
}

function formatISTCrosshair(time) {
  const d = toDate(time);
  if (isNaN(d.getTime())) return '';
  const dateStr = d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeStr = d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${dateStr}  ${timeStr}`;
}

function formatISTTickMark(time, tickMarkType) {
  const d = toDate(time);
  if (isNaN(d.getTime())) return null;

  if (tickMarkType === 3 || tickMarkType === 4) {
    return d.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
  if (tickMarkType === 2) {
    return d.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
    });
  }
  if (tickMarkType === 1) {
    return d.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
    });
  }
  if (tickMarkType === 0) {
    return d.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
    });
  }
  return d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

const TIMEFRAMES = [
  { id: '5m', label: '5m' },
  { id: '15m', label: '15m' },
  { id: '1h', label: '1H' },
  { id: '4h', label: '4H' },
];

export default function CandleChart({
  symbol,
  barsData,
  footprintData,
  orderFlowData,
  activeVP,
  timeframe = '1h',
  onSelectTimeframe,
  decimals = 2,
}) {
  const chartContainerRef = useRef(null);
  const chartWrapperRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const priceLinesRef = useRef([]);
  const profileCanvasRef = useRef(null);

  // States
  const [chartView, setChartView] = useState('candles'); // 'candles' | 'footprint'
  const [showInChartProfile, setShowInChartProfile] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoverData, setHoverData] = useState(null);

  // Live Candle Countdown Timer State (Right-Side Corner like TradingView)
  const [countdownText, setCountdownText] = useState('00:00');
  const [currentPriceY, setCurrentPriceY] = useState(null);

  // TradingView Drawing Tools State
  const [activeTool, setActiveTool] = useState('cursor');
  const [drawings, setDrawings] = useState([]);
  const [drawingDraft, setDrawingDraft] = useState(null);

  const of = orderFlowData?.find((o) => o.symbol === symbol);
  const symbolDisplay = symbol === 'XAUUSD' ? 'XAUUSD (OANDA)' : symbol;

  const getResponsiveHeight = useCallback(() => {
    if (isFullscreen) return Math.max(380, window.innerHeight - 110);
    const w = typeof window !== 'undefined' ? window.innerWidth : 1200;
    if (w >= 2560) return 740; // 4K / Ultrawide
    if (w >= 1920) return 620; // 1080p Full HD
    if (w < 640) return 420;  // Mobile
    return 540;               // Tablet & Laptop
  }, [isFullscreen]);

  // 1. Live Candle Countdown Timer (Second-by-Second Countdown)
  useEffect(() => {
    const updateCountdown = () => {
      const now = Math.floor(Date.now() / 1000);
      let tfSeconds = 3600;
      const tfLower = (timeframe || '1h').toLowerCase();
      if (tfLower === '5m') tfSeconds = 300;
      else if (tfLower === '15m') tfSeconds = 900;
      else if (tfLower === '1h') tfSeconds = 3600;
      else if (tfLower === '4h') tfSeconds = 14400;

      const elapsed = now % tfSeconds;
      const remaining = Math.max(0, tfSeconds - elapsed);

      if (remaining >= 3600) {
        const h = Math.floor(remaining / 3600);
        const m = Math.floor((remaining % 3600) / 60);
        const s = remaining % 60;
        setCountdownText(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
      } else {
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        setCountdownText(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
      }

      // Update current price coordinate for right-side corner badge
      if (candleSeriesRef.current && barsData && barsData.length > 0) {
        const lastClose = barsData[barsData.length - 1].close;
        const y = candleSeriesRef.current.priceToCoordinate(lastClose);
        if (y != null) {
          setCurrentPriceY(y);
        }
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [timeframe, barsData]);

  // 2. Initialize Lightweight Chart instance (Pure Candlestick Canvas, no bottom volume histogram)
  useEffect(() => {
    if (!chartContainerRef.current || chartView !== 'candles') return;

    if (chartRef.current) {
      try {
        chartRef.current.remove();
      } catch (e) {}
      chartRef.current = null;
    }

    const containerWidth = chartContainerRef.current.clientWidth || 800;
    const chartHeight = getResponsiveHeight();

    let chart;
    try {
      chart = createChart(chartContainerRef.current, {
        width: containerWidth,
        height: chartHeight,
        layout: {
          background: { type: 'solid', color: '#ffffff' },
          textColor: '#334155',
          fontFamily: 'Inter, sans-serif',
          fontSize: 12,
        },
        grid: {
          vertLines: { color: '#f8fafc' },
          horzLines: { color: '#f8fafc' },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
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
        localization: {
          locale: 'en-IN',
          dateFormat: 'dd/MM/yyyy',
          timeFormatter: (time) => formatISTCrosshair(time),
        },
        rightPriceScale: {
          borderColor: '#e2e8f0',
          scaleMargins: { top: 0.08, bottom: 0.08 },
        },
        timeScale: {
          borderColor: '#e2e8f0',
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 16,
          barSpacing: 9,
          tickMarkFormatter: (time, tickMarkType) => formatISTTickMark(time, tickMarkType),
        },
      });
    } catch (e) {
      console.error('[CHART] createChart error:', e);
      return;
    }

    // Candlestick Series (Crisp green / red - compatible with lightweight-charts v4 and v5)
    const candleOptions = {
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
    };

    const candleSeries = typeof chart.addSeries === 'function' && CandlestickSeries
      ? chart.addSeries(CandlestickSeries, candleOptions)
      : chart.addCandlestickSeries(candleOptions);

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

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
        if (cData) {
          setHoverData(cData);
        }
      }
    });

    // Redraw In-Chart Profile on range/scroll/zoom change
    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      renderInChartProfile();
    });

    // Resize observer
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        const newH = getResponsiveHeight();
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: newH,
        });
        renderInChartProfile();
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
  }, [decimals, chartView, isFullscreen]);

  // 3. Render Dynamic Session Volume Profile on the LEFT SIDE CORNER in Green & Red
  const renderInChartProfile = useCallback(() => {
    if (!profileCanvasRef.current || !candleSeriesRef.current || !chartContainerRef.current || !showInChartProfile) {
      if (profileCanvasRef.current) {
        const ctx = profileCanvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, profileCanvasRef.current.width, profileCanvasRef.current.height);
      }
      return;
    }

    const canvas = profileCanvasRef.current;
    const width = chartContainerRef.current.clientWidth;
    const height = chartContainerRef.current.clientHeight;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);

    if (!barsData || barsData.length === 0) return;

    // Use activeVP if provided, otherwise compute from barsData
    const vp = activeVP || calculateDynamicVolumeProfile(barsData, 55);
    if (!vp) return;

    // Anchor at LEFT SIDE CORNER (starting at x = 14)
    const startX = 14;
    const maxBarWidth = Math.min(230, width * 0.28);

    // A. Draw Horizontal Volume Bars (Two-Tone Green & Red Candlestick Colors)
    vp.bins.forEach((bin) => {
      const y = candleSeriesRef.current.priceToCoordinate(bin.price);
      if (y == null || y < -10 || y > height + 10) return;

      const yTop = candleSeriesRef.current.priceToCoordinate(bin.high);
      const yBtm = candleSeriesRef.current.priceToCoordinate(bin.low);
      const barH = Math.max(3, Math.abs((yBtm || 0) - (yTop || 0)));

      const totalW = (bin.totalVol / vp.maxVol) * maxBarWidth;
      const buyW = (bin.buyVol / bin.totalVol) * totalW;
      const sellW = Math.max(0, totalW - buyW);

      if (bin.inVA) {
        // Value Area (70% Volume Rule) - High Contrast Vivid Green & Red (Candlestick Colors)
        ctx.fillStyle = 'rgba(16, 185, 129, 0.85)'; // Up / Buy Vol (Green)
        ctx.fillRect(startX, y - barH / 2, buyW, barH - 0.7);

        ctx.fillStyle = 'rgba(239, 68, 68, 0.85)'; // Down / Sell Vol (Red)
        ctx.fillRect(startX + buyW, y - barH / 2, sellW, barH - 0.7);
      } else {
        // Outside Value Area (Tails / Rejection) - Translucent Soft Green & Red
        ctx.fillStyle = 'rgba(16, 185, 129, 0.28)'; // Soft Green
        ctx.fillRect(startX, y - barH / 2, buyW, barH - 0.7);

        ctx.fillStyle = 'rgba(239, 68, 68, 0.28)'; // Soft Red
        ctx.fillRect(startX + buyW, y - barH / 2, sellW, barH - 0.7);
      }

      // Highlight POC Bar with crisp outline
      if (bin.isPOC) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(startX, y - barH / 2, totalW, barH - 0.7);
      }
    });

    // B. Draw Prominent Red POC Line across the chart
    const yPOC = candleSeriesRef.current.priceToCoordinate(vp.pocPrice);
    if (yPOC != null && yPOC >= 0 && yPOC <= height) {
      // Solid Red Line across chart
      ctx.beginPath();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.6;
      ctx.moveTo(startX, yPOC);
      ctx.lineTo(width - 65, yPOC);
      ctx.stroke();

      // Red POC Tag at left corner
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(startX, yPOC - 8, 74, 16);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(`POC ${vp.pocPrice.toFixed(decimals)}`, startX + 4, yPOC + 3.5);
    }

    // C. Draw VAH Boundary Line across chart
    const yVAH = candleSeriesRef.current.priceToCoordinate(vp.vahPrice);
    if (yVAH != null && yVAH >= 0 && yVAH <= height) {
      ctx.beginPath();
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 1.0;
      ctx.setLineDash([5, 4]);
      ctx.moveTo(startX, yVAH);
      ctx.lineTo(width - 65, yVAH);
      ctx.stroke();
      ctx.setLineDash([]);

      // VAH Tag at left corner
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(startX, yVAH - 7, 68, 14);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8.5px monospace';
      ctx.fillText(`VAH ${vp.vahPrice.toFixed(decimals)}`, startX + 4, yVAH + 3.5);
    }

    // D. Draw VAL Boundary Line across chart
    const yVAL = candleSeriesRef.current.priceToCoordinate(vp.valPrice);
    if (yVAL != null && yVAL >= 0 && yVAL <= height) {
      ctx.beginPath();
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 1.0;
      ctx.setLineDash([5, 4]);
      ctx.moveTo(startX, yVAL);
      ctx.lineTo(width - 65, yVAL);
      ctx.stroke();
      ctx.setLineDash([]);

      // VAL Tag at left corner
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(startX, yVAL - 7, 68, 14);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8.5px monospace';
      ctx.fillText(`VAL ${vp.valPrice.toFixed(decimals)}`, startX + 4, yVAL + 3.5);
    }
  }, [barsData, activeVP, showInChartProfile, decimals]);

  // Tracking refs for high-speed sub-millisecond updates
  const prevSymbolTfRef = useRef('');
  const prevBarsLengthRef = useRef(0);
  const prevLastBarTimeRef = useRef(0);

  // 4. Set Candlestick Bar Data & Recalibrate Time Scale (Fast-Path GPU Updates)
  useEffect(() => {
    if (!barsData || barsData.length === 0 || !candleSeriesRef.current || chartView !== 'candles') {
      return;
    }

    try {
      const currentKey = `${symbol}_${timeframe}`;
      const isSwitch = prevSymbolTfRef.current !== currentKey;

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
      if (sortedBars.length === 0) return;

      const lastBar = sortedBars[sortedBars.length - 1];

      // Ultra-Fast Path: Live tick update on active candle (<0.1ms direct GPU render)
      if (!isSwitch && prevBarsLengthRef.current === sortedBars.length && prevLastBarTimeRef.current === lastBar.time) {
        candleSeriesRef.current.update(lastBar);
        const y = candleSeriesRef.current.priceToCoordinate(lastBar.close);
        if (y != null) setCurrentPriceY(y);
        renderInChartProfile();
      } else {
        // Full series load on timeframe/symbol switch or when a new candle bar opens
        candleSeriesRef.current.setData(sortedBars);
        if (isSwitch) {
          prevSymbolTfRef.current = currentKey;
          if (chartRef.current) {
            chartRef.current.timeScale().fitContent();
          }
        }
        prevBarsLengthRef.current = sortedBars.length;
        prevLastBarTimeRef.current = lastBar.time;
        const y = candleSeriesRef.current.priceToCoordinate(lastBar.close);
        if (y != null) setCurrentPriceY(y);
        renderInChartProfile();
      }
    } catch (err) {
      console.warn('[CHART] Error applying bar data:', err);
    }
  }, [barsData, chartView, timeframe, symbol, renderInChartProfile]);

  // 5. Render Subtle Prior Day Extremes (PDH / PDL only) to prevent right-axis crowding
  useEffect(() => {
    if (!candleSeriesRef.current || !of || chartView !== 'candles') return;

    priceLinesRef.current.forEach((line) => {
      try {
        candleSeriesRef.current.removePriceLine(line);
      } catch (e) {}
    });
    priceLinesRef.current = [];

    // Prior Day High (PDH)
    if (of.pHigh) {
      try {
        const line = candleSeriesRef.current.createPriceLine({
          price: of.pHigh,
          color: '#94a3b8',
          lineWidth: 1,
          lineStyle: 1,
          axisLabelVisible: true,
          title: `PDH`,
        });
        priceLinesRef.current.push(line);
      } catch (e) {}
    }

    // Prior Day Low (PDL)
    if (of.pLow) {
      try {
        const line = candleSeriesRef.current.createPriceLine({
          price: of.pLow,
          color: '#94a3b8',
          lineWidth: 1,
          lineStyle: 1,
          axisLabelVisible: true,
          title: `PDL`,
        });
        priceLinesRef.current.push(line);
      } catch (e) {}
    }
  }, [of, decimals, chartView]);

  useEffect(() => {
    renderInChartProfile();
  }, [renderInChartProfile, barsData, activeVP]);

  // Fullscreen Toggle
  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Interactive Drawing Canvas Clicks
  const handleCanvasClick = (e) => {
    if (activeTool === 'cursor' || chartView !== 'candles') return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const price = candleSeriesRef.current?.coordinateToPrice(y);
    if (price == null) return;

    if (activeTool === 'horizontal') {
      setDrawings((prev) => [
        ...prev,
        {
          id: Date.now(),
          type: 'horizontal',
          price,
          y,
        },
      ]);
      setActiveTool('cursor');
    } else if (activeTool === 'long') {
      const riskDistance = symbol === 'XAUUSD' ? 6.0 : 0.0025;
      const entry = price;
      const sl = entry - riskDistance;
      const tp1 = entry + riskDistance;
      const tp2 = entry + riskDistance * 2;
      setDrawings((prev) => [
        ...prev,
        {
          id: Date.now(),
          type: 'long',
          entry,
          sl,
          tp1,
          tp2,
          x,
        },
      ]);
      setActiveTool('cursor');
    } else if (activeTool === 'short') {
      const riskDistance = symbol === 'XAUUSD' ? 6.0 : 0.0025;
      const entry = price;
      const sl = entry + riskDistance;
      const tp1 = entry - riskDistance;
      const tp2 = entry - riskDistance * 2;
      setDrawings((prev) => [
        ...prev,
        {
          id: Date.now(),
          type: 'short',
          entry,
          sl,
          tp1,
          tp2,
          x,
        },
      ]);
      setActiveTool('cursor');
    } else if (activeTool === 'trendline' || activeTool === 'fib') {
      if (!drawingDraft) {
        setDrawingDraft({ type: activeTool, x1: x, y1: y, price1: price });
      } else {
        setDrawings((prev) => [
          ...prev,
          {
            id: Date.now(),
            type: activeTool,
            x1: drawingDraft.x1,
            y1: drawingDraft.y1,
            price1: drawingDraft.price1,
            x2: x,
            y2: y,
            price2: price,
          },
        ]);
        setDrawingDraft(null);
        setActiveTool('cursor');
      }
    }
  };

  const handleClearDrawings = () => {
    setDrawings([]);
    setDrawingDraft(null);
  };

  const handleUndoDrawing = () => {
    setDrawings((prev) => prev.slice(0, -1));
  };

  const latestBar = barsData && barsData.length > 0 ? barsData[barsData.length - 1] : null;
  const displayBar = hoverData || latestBar;

  return (
    <div
      ref={chartWrapperRef}
      className={`bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none border-none p-4' : 'relative'
      }`}
    >
      {/* 1. Chart Toolbar & Timeframe Controls */}
      <div className="px-4 py-2.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white">
        {/* Left: Symbol & Timeframe Selectors */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-slate-900 text-sm tracking-tight">
              {symbolDisplay}
            </span>
          </div>

          {/* Timeframe Buttons: 5m, 15m, 1h, 4h */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.id}
                onClick={() => onSelectTimeframe && onSelectTimeframe(tf.id)}
                className={`px-2.5 py-1 rounded-md transition ${
                  timeframe.toLowerCase() === tf.id
                    ? 'bg-blue-600 text-white font-bold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* View Mode Toggle: Candles vs Footprint */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setChartView('candles')}
              className={`px-2.5 py-1 rounded-md transition ${
                chartView === 'candles'
                  ? 'bg-white text-slate-900 font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Candles + VP
            </button>
            <button
              onClick={() => setChartView('footprint')}
              className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 ${
                chartView === 'footprint'
                  ? 'bg-white text-slate-900 font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              Footprint
            </button>
          </div>

          {/* In-Chart Volume Profile Toggle Button */}
          {chartView === 'candles' && (
            <button
              onClick={() => setShowInChartProfile((v) => !v)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition ${
                showInChartProfile
                  ? 'bg-blue-50 text-blue-700 border-blue-200 font-bold'
                  : 'bg-slate-50 text-slate-500 border-slate-200'
              }`}
              title="Toggle Left-Corner Volume Profile"
            >
              <BarChart3 className="w-3.5 h-3.5 text-amber-500" />
              <span>Left-Corner VP</span>
              {showInChartProfile ? <Eye className="w-3 h-3 text-blue-600" /> : <EyeOff className="w-3 h-3" />}
            </button>
          )}

          {/* OHLC Bar Legend & Active Timeframe Badge */}
          {chartView === 'candles' && displayBar && (
            <div className="hidden xl:flex items-center gap-2.5 text-xs font-mono text-slate-500">
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 uppercase">
                {timeframe} Candle
              </span>
              <span>O: <b className="text-slate-900">{displayBar.open?.toFixed(decimals)}</b></span>
              <span>H: <b className="text-emerald-700">{displayBar.high?.toFixed(decimals)}</b></span>
              <span>L: <b className="text-rose-700">{displayBar.low?.toFixed(decimals)}</b></span>
              <span>C: <b className="text-slate-900">{displayBar.close?.toFixed(decimals)}</b></span>
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                LIVE STREAM
              </span>
            </div>
          )}
        </div>

        {/* Right: Candle Countdown Timer & Fullscreen Toggle */}
        <div className="flex items-center gap-2">
          {/* Live Candle Countdown Pill (Top Right Corner - Clean, no IST text) */}
          <div
            className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 shadow-xs"
            title={`Time remaining until current ${timeframe.toUpperCase()} candle closes`}
          >
            <Clock className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
            <span className="text-[10px] font-semibold text-slate-500 uppercase">{timeframe}:</span>
            <span className="text-slate-900">{countdownText}</span>
          </div>

          {chartView === 'candles' && (
            <div className="hidden md:flex items-center gap-2 text-[11px] font-semibold">
              <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <span className="w-2 h-2 bg-emerald-500 rounded-sm"></span> Buy Vol
              </span>
              <span className="flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                <span className="w-2 h-2 bg-rose-500 rounded-sm"></span> Sell Vol
              </span>
              <span className="flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                <span className="w-2.5 h-0.5 bg-rose-500 rounded"></span> POC Line
              </span>
              <span className="flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                <span className="w-2.5 h-0.5 bg-blue-600 rounded"></span> 70% VA
              </span>
            </div>
          )}

          {/* Full Screen Toggle Button */}
          <button
            onClick={toggleFullscreen}
            className="w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-700 transition"
            title={isFullscreen ? 'Exit Full Screen (ESC)' : 'Full Screen Chart'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. Main Chart Layout */}
      <div className="flex-1 flex items-stretch relative min-h-[500px]">
        {/* TradingView Left Drawing Toolbar */}
        {chartView === 'candles' && (
          <div className="w-11 border-r border-slate-100 bg-slate-50/70 p-1 flex flex-col items-center gap-1 z-20">
            <button
              onClick={() => setActiveTool('cursor')}
              title="Cursor / Crosshair"
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                activeTool === 'cursor' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Crosshair className="w-4 h-4" />
            </button>

            <button
              onClick={() => setActiveTool('trendline')}
              title="Trendline Tool (Click 2 points)"
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                activeTool === 'trendline' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
            </button>

            <button
              onClick={() => setActiveTool('horizontal')}
              title="Horizontal Support/Resistance Line"
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                activeTool === 'horizontal' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Minus className="w-4 h-4" />
            </button>

            <button
              onClick={() => setActiveTool('fib')}
              title="Fibonacci Retracement (Low to High)"
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                activeTool === 'fib' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Layers className="w-4 h-4" />
            </button>

            <div className="w-6 h-px bg-slate-200 my-1" />

            <button
              onClick={() => setActiveTool('long')}
              title="Long Position Tool (1:1 + 1:2 Twin RR Box)"
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                activeTool === 'long' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => setActiveTool('short')}
              title="Short Position Tool (1:1 + 1:2 Twin RR Box)"
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                activeTool === 'short' ? 'bg-rose-600 text-white shadow-sm' : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              <ArrowDownRight className="w-4 h-4" />
            </button>

            <div className="mt-auto flex flex-col gap-1 pb-1">
              {drawings.length > 0 && (
                <>
                  <button
                    onClick={handleUndoDrawing}
                    title="Undo Drawing"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200 transition"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleClearDrawings}
                    title="Clear All Drawings"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-500 hover:bg-rose-50 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* View 1: Candlestick Chart + Left-Corner Volume Profile + Right Corner Countdown */}
        {chartView === 'candles' && (
          <div className="flex-1 relative overflow-hidden" style={{ height: isFullscreen ? 'calc(100vh - 75px)' : `${getResponsiveHeight()}px` }}>
            {/* Pure Candlestick Canvas */}
            <div ref={chartContainerRef} className="w-full h-full" />

            {/* In-Chart Left-Corner Volume Profile Canvas (Green & Red) */}
            <canvas
              ref={profileCanvasRef}
              className="absolute inset-0 pointer-events-none z-10"
            />

            {/* TradingView-Style Candle Countdown on the Right-Side Price Scale */}
            {currentPriceY != null && (
              <div
                className="absolute z-30 pointer-events-none transition-all duration-300 flex items-center"
                style={{
                  top: `${Math.max(15, Math.min(isFullscreen ? window.innerHeight - 150 : 500, currentPriceY - 11))}px`,
                  right: '68px',
                }}
              >
                <div className="bg-slate-900/95 text-white font-mono text-[10px] font-extrabold px-2 py-0.5 rounded-l shadow-lg border border-r-0 border-slate-700 flex items-center gap-1.5 backdrop-blur-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>{countdownText}</span>
                </div>
              </div>
            )}

            {/* TradingView Interactive Drawing Layer */}
            <svg
              onClick={handleCanvasClick}
              className={`absolute inset-0 w-full h-full z-15 ${
                activeTool !== 'cursor' ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'
              }`}
            >
              {drawings.map((d) => {
                if (d.type === 'horizontal') {
                  const y = candleSeriesRef.current?.priceToCoordinate(d.price) || d.y;
                  return (
                    <g key={d.id}>
                      <line x1="0" y1={y} x2="100%" y2={y} stroke="#2563eb" strokeWidth="1.5" strokeDasharray="4 3" />
                      <rect x="10" y={y - 10} width="80" height="20" rx="4" fill="#2563eb" />
                      <text x="50" y={y + 4} textAnchor="middle" fill="#ffffff" fontSize="10" fontFamily="monospace" fontWeight="bold">
                        {d.price?.toFixed(decimals)}
                      </text>
                    </g>
                  );
                }

                if (d.type === 'long') {
                  const yEntry = candleSeriesRef.current?.priceToCoordinate(d.entry) || 250;
                  const ySL = candleSeriesRef.current?.priceToCoordinate(d.sl) || 300;
                  const yTP1 = candleSeriesRef.current?.priceToCoordinate(d.tp1) || 200;
                  const yTP2 = candleSeriesRef.current?.priceToCoordinate(d.tp2) || 150;
                  const boxWidth = 240;
                  const startX = Math.max(10, d.x - 30);

                  return (
                    <g key={d.id}>
                      <rect x={startX} y={yTP2} width={boxWidth} height={Math.abs(yTP1 - yTP2)} fill="rgba(16, 185, 129, 0.25)" stroke="#059669" strokeWidth="1" />
                      <text x={startX + 8} y={yTP2 + 15} fill="#065f46" fontSize="10" fontWeight="bold">
                        TP2 (+1:2 RR): {d.tp2?.toFixed(decimals)}
                      </text>

                      <rect x={startX} y={yTP1} width={boxWidth} height={Math.abs(yEntry - yTP1)} fill="rgba(16, 185, 129, 0.40)" stroke="#059669" strokeWidth="1.5" />
                      <text x={startX + 8} y={yTP1 + 15} fill="#065f46" fontSize="10" fontWeight="bold">
                        TP1 (+1:1 RR): {d.tp1?.toFixed(decimals)}
                      </text>

                      <line x1={startX} y1={yEntry} x2={startX + boxWidth} y2={yEntry} stroke="#2563eb" strokeWidth="2" />
                      <text x={startX + 8} y={yEntry - 4} fill="#1d4ed8" fontSize="10" fontWeight="bold">
                        ENTRY: {d.entry?.toFixed(decimals)}
                      </text>

                      <rect x={startX} y={yEntry} width={boxWidth} height={Math.abs(ySL - yEntry)} fill="rgba(239, 68, 68, 0.25)" stroke="#dc2626" strokeWidth="1.5" />
                      <text x={startX + 8} y={ySL - 6} fill="#991b1b" fontSize="10" fontWeight="bold">
                        STOP LOSS: {d.sl?.toFixed(decimals)} (-1.0R)
                      </text>
                    </g>
                  );
                }

                if (d.type === 'short') {
                  const yEntry = candleSeriesRef.current?.priceToCoordinate(d.entry) || 250;
                  const ySL = candleSeriesRef.current?.priceToCoordinate(d.sl) || 200;
                  const yTP1 = candleSeriesRef.current?.priceToCoordinate(d.tp1) || 300;
                  const yTP2 = candleSeriesRef.current?.priceToCoordinate(d.tp2) || 350;
                  const boxWidth = 240;
                  const startX = Math.max(10, d.x - 30);

                  return (
                    <g key={d.id}>
                      <rect x={startX} y={ySL} width={boxWidth} height={Math.abs(yEntry - ySL)} fill="rgba(239, 68, 68, 0.25)" stroke="#dc2626" strokeWidth="1.5" />
                      <text x={startX + 8} y={ySL + 15} fill="#991b1b" fontSize="10" fontWeight="bold">
                        STOP LOSS: {d.sl?.toFixed(decimals)} (-1.0R)
                      </text>

                      <line x1={startX} y1={yEntry} x2={startX + boxWidth} y2={yEntry} stroke="#2563eb" strokeWidth="2" />

                      <rect x={startX} y={yEntry} width={boxWidth} height={Math.abs(yTP1 - yEntry)} fill="rgba(16, 185, 129, 0.40)" stroke="#059669" strokeWidth="1.5" />
                      <text x={startX + 8} y={yTP1 - 6} fill="#065f46" fontSize="10" fontWeight="bold">
                        TP1 (1:1 RR): {d.tp1?.toFixed(decimals)}
                      </text>

                      <rect x={startX} y={yTP1} width={boxWidth} height={Math.abs(yTP2 - yTP1)} fill="rgba(16, 185, 129, 0.25)" stroke="#059669" strokeWidth="1" />
                      <text x={startX + 8} y={yTP2 - 6} fill="#065f46" fontSize="10" fontWeight="bold">
                        TP2 (1:2 RR): {d.tp2?.toFixed(decimals)}
                      </text>
                    </g>
                  );
                }

                if (d.type === 'trendline') {
                  return (
                    <line
                      key={d.id}
                      x1={d.x1}
                      y1={d.y1}
                      x2={d.x2}
                      y2={d.y2}
                      stroke="#0284c7"
                      strokeWidth="2"
                    />
                  );
                }

                if (d.type === 'fib') {
                  const fibs = [
                    { level: 0.0, color: '#64748b' },
                    { level: 0.236, color: '#94a3b8' },
                    { level: 0.382, color: '#38bdf8' },
                    { level: 0.5, color: '#10b981' },
                    { level: 0.618, color: '#f59e0b', label: 'Golden Pocket (61.8%)' },
                    { level: 0.786, color: '#6366f1' },
                    { level: 1.0, color: '#64748b' },
                  ];

                  const minY = Math.min(d.y1, d.y2);
                  const maxY = Math.max(d.y1, d.y2);
                  const span = maxY - minY;

                  return (
                    <g key={d.id}>
                      {fibs.map((f, fIdx) => {
                        const curY = minY + span * f.level;
                        return (
                          <g key={fIdx}>
                            <line x1="0" y1={curY} x2="100%" y2={curY} stroke={f.color} strokeWidth={f.level === 0.618 ? 2 : 1} strokeDasharray={f.level === 0.618 ? 'none' : '3 2'} />
                            <text x="15" y={curY - 3} fill={f.color} fontSize="9" fontWeight="bold" fontFamily="monospace">
                              {f.label || `${f.level * 100}%`}
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  );
                }

                return null;
              })}
            </svg>
          </div>
        )}

        {/* In-Chart Interactive ATAS Footprint View */}
        {chartView === 'footprint' && (
          <div className="flex-1 w-full overflow-hidden">
            <AtasFootprintChart
              symbol={symbol}
              footprintData={footprintData}
              currentPrice={barsData && barsData.length > 0 ? barsData[barsData.length - 1].close : null}
              timeframe={timeframe}
              onSelectTimeframe={onSelectTimeframe}
              decimals={decimals}
              isFullscreen={isFullscreen}
              onToggleFullscreen={toggleFullscreen}
              height={getResponsiveHeight()}
            />
          </div>
        )}

      </div>
    </div>
  );
}
