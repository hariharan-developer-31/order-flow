import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  Activity,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

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
  const [lwReady, setLwReady] = useState(() => !!window.LightweightCharts);

  // TradingView Drawing Tools State
  const [activeTool, setActiveTool] = useState('cursor'); // 'cursor' | 'trendline' | 'horizontal' | 'fib' | 'long' | 'short'
  const [drawings, setDrawings] = useState([]);
  const [drawingDraft, setDrawingDraft] = useState(null);

  const of = orderFlowData?.find((o) => o.symbol === symbol);

  // Poll for LightweightCharts CDN readiness
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
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // 1. Initialize Chart instance with Pristine White Theme
  // (NOTE: Volume indicator at bottom is COMPLETELY REMOVED per user request)
  useEffect(() => {
    if (!chartContainerRef.current || !window.LightweightCharts || chartView !== 'candles') return;

    if (chartRef.current) {
      try {
        chartRef.current.remove();
      } catch (e) {}
      chartRef.current = null;
    }

    const containerWidth = chartContainerRef.current.clientWidth || 800;
    const chartHeight = isFullscreen ? window.innerHeight - 110 : 540;

    const chart = window.LightweightCharts.createChart(chartContainerRef.current, {
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
        scaleMargins: { top: 0.08, bottom: 0.08 }, // Full vertical space for clean price action
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
        const newH = isFullscreen ? window.innerHeight - 110 : 540;
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
  }, [decimals, lwReady, chartView, isFullscreen]);

  // 2. Set Candlestick Bar Data
  useEffect(() => {
    if (!barsData || barsData.length === 0 || !candleSeriesRef.current || chartView !== 'candles') {
      return;
    }

    try {
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
      candleSeriesRef.current.setData(sortedBars);

      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }
      setTimeout(renderInChartProfile, 100);
    } catch (err) {
      console.warn('[CHART] Error applying bar data:', err);
    }
  }, [barsData, lwReady, chartView]);

  // 3. Render Institutional Price Lines (POC, VAH, VAL, PDH, PDL)
  useEffect(() => {
    if (!candleSeriesRef.current || !of || chartView !== 'candles') return;

    priceLinesRef.current.forEach((line) => {
      try {
        candleSeriesRef.current.removePriceLine(line);
      } catch (e) {}
    });
    priceLinesRef.current = [];

    // POC Solid Gold Line
    if (of.pPOC) {
      try {
        const line = candleSeriesRef.current.createPriceLine({
          price: of.pPOC,
          color: '#d97706',
          lineWidth: 2,
          lineStyle: 0,
          axisLabelVisible: true,
          title: `POC: ${of.pPOC.toFixed(decimals)}`,
        });
        priceLinesRef.current.push(line);
      } catch (e) {}
    }

    // VAH Dashed Blue Line
    if (of.pVAH) {
      try {
        const line = candleSeriesRef.current.createPriceLine({
          price: of.pVAH,
          color: '#2563eb',
          lineWidth: 1.5,
          lineStyle: 2,
          axisLabelVisible: true,
          title: `VAH: ${of.pVAH.toFixed(decimals)}`,
        });
        priceLinesRef.current.push(line);
      } catch (e) {}
    }

    // VAL Dashed Blue Line
    if (of.pVAL) {
      try {
        const line = candleSeriesRef.current.createPriceLine({
          price: of.pVAL,
          color: '#2563eb',
          lineWidth: 1.5,
          lineStyle: 2,
          axisLabelVisible: true,
          title: `VAL: ${of.pVAL.toFixed(decimals)}`,
        });
        priceLinesRef.current.push(line);
      } catch (e) {}
    }

    // PDH
    if (of.pHigh) {
      try {
        const line = candleSeriesRef.current.createPriceLine({
          price: of.pHigh,
          color: '#64748b',
          lineWidth: 1,
          lineStyle: 1,
          axisLabelVisible: true,
          title: `PDH: ${of.pHigh.toFixed(decimals)}`,
        });
        priceLinesRef.current.push(line);
      } catch (e) {}
    }

    // PDL
    if (of.pLow) {
      try {
        const line = candleSeriesRef.current.createPriceLine({
          price: of.pLow,
          color: '#64748b',
          lineWidth: 1,
          lineStyle: 1,
          axisLabelVisible: true,
          title: `PDL: ${of.pLow.toFixed(decimals)}`,
        });
        priceLinesRef.current.push(line);
      } catch (e) {}
    }
  }, [of, decimals, lwReady, chartView]);

  // 4. Draw In-Chart Volume Profile Overlaid on Canvas (VPVR)
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

    const profile = of?.profile || [];
    if (profile.length === 0) return;

    const maxVol = Math.max(...profile.map((p) => p.volume), 1);
    const maxBarWidth = Math.min(220, width * 0.26); // Occupy right edge of chart
    const rightMargin = 65; // Price scale offset

    profile.forEach((bin) => {
      const y = candleSeriesRef.current.priceToCoordinate(bin.price);
      if (y == null || y < 0 || y > height) return;

      const barWidth = Math.max(3, (bin.volume / maxVol) * maxBarWidth);
      const startX = width - rightMargin - barWidth;
      const barHeight = 8;

      if (bin.is_poc) {
        // Point of Control (Rich Gold)
        ctx.fillStyle = 'rgba(217, 119, 6, 0.85)';
        ctx.fillRect(startX, y - barHeight / 2, barWidth, barHeight);
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 1;
        ctx.strokeRect(startX, y - barHeight / 2, barWidth, barHeight);

        // POC Text Tag
        ctx.fillStyle = '#b45309';
        ctx.font = 'bold 10px monospace';
        ctx.fillText('POC', startX - 28, y + 3);
      } else if (bin.in_va) {
        // 70% Value Area (Institutional Blue)
        ctx.fillStyle = 'rgba(37, 99, 235, 0.40)';
        ctx.fillRect(startX, y - barHeight / 2, barWidth, barHeight);
      } else {
        // Outside Value Area (Soft Slate)
        ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
        ctx.fillRect(startX, y - barHeight / 2, barWidth, barHeight);
      }
    });
  }, [of, showInChartProfile]);

  useEffect(() => {
    renderInChartProfile();
  }, [renderInChartProfile, barsData]);

  // 5. Fullscreen Toggle
  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  // Close fullscreen on ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // 6. Interactive Drawing Canvas Clicks
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
          color: '#2563eb',
        },
      ]);
      setActiveTool('cursor');
    } else if (activeTool === 'long') {
      const riskDistance = (symbol === 'XAUUSD' ? 6.0 : 0.0025);
      const entry = price;
      const sl = entry - riskDistance;
      const tp1 = entry + riskDistance; // 1:1 RR Banker
      const tp2 = entry + riskDistance * 2; // 1:2 RR High-Win Target
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
      const riskDistance = (symbol === 'XAUUSD' ? 6.0 : 0.0025);
      const entry = price;
      const sl = entry + riskDistance;
      const tp1 = entry - riskDistance; // 1:1 RR Banker
      const tp2 = entry - riskDistance * 2; // 1:2 RR Target
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
              {symbol}
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

          {/* View Mode Toggle: Candlesticks vs Footprint Chart */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setChartView('candles')}
              className={`px-2.5 py-1 rounded-md transition ${
                chartView === 'candles'
                  ? 'bg-white text-slate-900 font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Candles
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
              Footprint Chart
            </button>
          </div>

          {/* In-Chart Volume Profile Toggle Button */}
          {chartView === 'candles' && (
            <button
              onClick={() => setShowInChartProfile((v) => !v)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition ${
                showInChartProfile
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-slate-50 text-slate-500 border-slate-200'
              }`}
              title="Toggle Volume Profile Overlay on Chart"
            >
              <BarChart3 className="w-3.5 h-3.5 text-amber-500" />
              <span>Volume Profile</span>
              {showInChartProfile ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            </button>
          )}

          {/* OHLC Bar Legend (Candles View) */}
          {chartView === 'candles' && displayBar && (
            <div className="hidden xl:flex items-center gap-3 text-xs font-mono text-slate-500">
              <span>O: <b className="text-slate-900">{displayBar.open?.toFixed(decimals)}</b></span>
              <span>H: <b className="text-emerald-700">{displayBar.high?.toFixed(decimals)}</b></span>
              <span>L: <b className="text-rose-700">{displayBar.low?.toFixed(decimals)}</b></span>
              <span>C: <b className="text-slate-900">{displayBar.close?.toFixed(decimals)}</b></span>
            </div>
          )}
        </div>

        {/* Right: Legend Pills & Fullscreen Toggle */}
        <div className="flex items-center gap-2">
          {chartView === 'candles' && (
            <div className="hidden md:flex items-center gap-2 text-[11px] font-semibold">
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

      {/* 2. Main Chart Layout with Left TradingView Toolbar */}
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
              title="Horizontal Support/Resistance Ray"
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

        {/* View 1: Candlestick Chart + Overlaid Volume Profile */}
        {chartView === 'candles' ? (
          <div className="flex-1 relative overflow-hidden" style={{ height: isFullscreen ? 'calc(100vh - 75px)' : '540px' }}>
            {/* Lightweight Charts Canvas (Pure Candles, no bottom volume histogram) */}
            <div ref={chartContainerRef} className="w-full h-full" />

            {/* In-Chart Volume Profile Canvas Overlay (VPVR) */}
            <canvas
              ref={profileCanvasRef}
              className="absolute inset-0 pointer-events-none z-10"
            />

            {/* TradingView Interactive Drawing Layer */}
            <svg
              onClick={handleCanvasClick}
              className={`absolute inset-0 w-full h-full z-15 ${
                activeTool !== 'cursor' ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'
              }`}
            >
              {/* Render Saved Drawings */}
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
                      {/* TP2 Zone (1:2 Runner) */}
                      <rect x={startX} y={yTP2} width={boxWidth} height={Math.abs(yTP1 - yTP2)} fill="rgba(16, 185, 129, 0.25)" stroke="#059669" strokeWidth="1" />
                      <text x={startX + 8} y={yTP2 + 15} fill="#065f46" fontSize="10" fontWeight="bold">
                        TP2 (+1:2 RR): {d.tp2?.toFixed(decimals)}
                      </text>

                      {/* TP1 Zone (1:1 Banker) */}
                      <rect x={startX} y={yTP1} width={boxWidth} height={Math.abs(yEntry - yTP1)} fill="rgba(16, 185, 129, 0.40)" stroke="#059669" strokeWidth="1.5" />
                      <text x={startX + 8} y={yTP1 + 15} fill="#065f46" fontSize="10" fontWeight="bold">
                        TP1 (+1:1 RR): {d.tp1?.toFixed(decimals)}
                      </text>

                      {/* Entry Line */}
                      <line x1={startX} y1={yEntry} x2={startX + boxWidth} y2={yEntry} stroke="#2563eb" strokeWidth="2" />
                      <text x={startX + 8} y={yEntry - 4} fill="#1d4ed8" fontSize="10" fontWeight="bold">
                        ENTRY: {d.entry?.toFixed(decimals)}
                      </text>

                      {/* Stop Loss Zone */}
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
                      {/* Stop Loss Zone (Above Entry) */}
                      <rect x={startX} y={ySL} width={boxWidth} height={Math.abs(yEntry - ySL)} fill="rgba(239, 68, 68, 0.25)" stroke="#dc2626" strokeWidth="1.5" />
                      <text x={startX + 8} y={ySL + 15} fill="#991b1b" fontSize="10" fontWeight="bold">
                        STOP LOSS: {d.sl?.toFixed(decimals)} (-1.0R)
                      </text>

                      {/* Entry Line */}
                      <line x1={startX} y1={yEntry} x2={startX + boxWidth} y2={yEntry} stroke="#2563eb" strokeWidth="2" />

                      {/* TP1 Zone (Below Entry) */}
                      <rect x={startX} y={yEntry} width={boxWidth} height={Math.abs(yTP1 - yEntry)} fill="rgba(16, 185, 129, 0.40)" stroke="#059669" strokeWidth="1.5" />
                      <text x={startX + 8} y={yTP1 - 6} fill="#065f46" fontSize="10" fontWeight="bold">
                        TP1 (1:1 RR): {d.tp1?.toFixed(decimals)}
                      </text>

                      {/* TP2 Zone */}
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
        ) : (
          /* View 2: Authentic In-Chart Footprint Chart View */
          <div className="flex-1 p-4 bg-slate-50/50 overflow-x-auto" style={{ height: isFullscreen ? 'calc(100vh - 75px)' : '540px' }}>
            <div className="flex items-start gap-3 min-w-max pb-2 h-full">
              {(footprintData || []).map((bar, bIdx) => {
                const isBull = bar.close >= bar.open;
                const delta = bar.delta || 0;
                const isDeltaPos = delta >= 0;

                let maxClusterVol = -1;
                let barPoc = null;
                (bar.clusters || []).forEach((c) => {
                  const tot = (c.bid || 0) + (c.ask || 0);
                  if (tot > maxClusterVol) {
                    maxClusterVol = tot;
                    barPoc = c.price;
                  }
                });

                const sortedClusters = [...(bar.clusters || [])].sort((a, b) => b.price - a.price);

                return (
                  <div
                    key={bar.time || bIdx}
                    className="w-56 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col hover:border-blue-400 transition"
                  >
                    {/* Footprint Bar Header */}
                    <div
                      className={`p-2 border-b text-xs font-mono flex items-center justify-between ${
                        isBull ? 'bg-emerald-50/80 border-emerald-200' : 'bg-rose-50/80 border-rose-200'
                      }`}
                    >
                      <span className="font-bold text-slate-800">{bar.datetime}</span>
                      <span className={`font-black flex items-center gap-0.5 ${isDeltaPos ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {isDeltaPos ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                        {delta > 0 ? `+${delta.toFixed(0)}` : delta.toFixed(0)}
                      </span>
                    </div>

                    {/* OHLC Mini Summary */}
                    <div className="px-2.5 py-1 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-500">
                      <span>O: {bar.open?.toFixed(decimals)}</span>
                      <span>C: {bar.close?.toFixed(decimals)}</span>
                      <span>Vol: {bar.volume ? Math.round(bar.volume).toLocaleString() : '---'}</span>
                    </div>

                    {/* Bid x Ask Cluster Ladder (Footprint on Chart) */}
                    <div className="p-2 space-y-1 flex-1 overflow-y-auto max-h-[380px]">
                      {sortedClusters.map((c, cIdx) => {
                        const isPOC = c.price === barPoc;
                        const isBuyImb = c.imbalance === 'BUY';
                        const isSellImb = c.imbalance === 'SELL';

                        return (
                          <div
                            key={cIdx}
                            className={`flex items-center text-[10px] font-mono rounded px-1 py-0.5 border transition ${
                              isPOC ? 'bg-amber-50 border-amber-300 font-bold' : 'bg-white border-slate-100 hover:bg-slate-50'
                            }`}
                          >
                            {/* Bid Volume */}
                            <div
                              className={`flex-1 text-right pr-2 py-0.5 rounded-l ${
                                isSellImb ? 'bg-rose-500 text-white font-black shadow-sm' : 'text-rose-700 bg-rose-50/50'
                              }`}
                            >
                              {c.bid}
                            </div>

                            {/* Center Price Tick */}
                            <div className={`px-1.5 font-bold text-center text-[10px] ${isPOC ? 'text-amber-800 font-extrabold' : 'text-slate-600'}`}>
                              {c.price?.toFixed(decimals)}
                            </div>

                            {/* Ask Volume */}
                            <div
                              className={`flex-1 text-left pl-2 py-0.5 rounded-r ${
                                isBuyImb ? 'bg-emerald-500 text-white font-black shadow-sm' : 'text-emerald-700 bg-emerald-50/50'
                              }`}
                            >
                              {c.ask}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Bottom Net Delta & CVD */}
                    <div className="p-2 border-t border-slate-100 bg-slate-50 text-[10px] font-mono flex items-center justify-between">
                      <span className="text-slate-500">Net Delta:</span>
                      <span className={`font-bold ${isDeltaPos ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {delta > 0 ? `+${delta}` : delta}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
