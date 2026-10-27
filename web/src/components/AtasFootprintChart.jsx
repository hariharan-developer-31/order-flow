import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  Flame,
  Layers,
  ArrowUp,
  ArrowDown,
  Info,
  Activity,
  Crosshair,
  TrendingUp,
} from 'lucide-react';

export default function AtasFootprintChart({
  symbol = 'XAUUSD',
  footprintData = [],
  currentPrice = null,
  timeframe = '15m',
  onSelectTimeframe = null,
  decimals = 2,
  isFullscreen = false,
  onToggleFullscreen = null,
  height = 560,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  // View modes: 'bid_ask' (ATAS classic side-by-side) | 'delta' (net delta) | 'volume' (total volume)
  const [displayMode, setDisplayMode] = useState('bid_ask');

  // Interactive Zoom & Pan State (Centered, fluid navigation)
  const [zoom, setZoom] = useState(1.15);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  // Dragging & Interaction Refs
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const [isCursorGrabbing, setIsCursorGrabbing] = useState(false);

  // Touch pinch interaction refs
  const touchStartDistRef = useRef(0);
  const touchStartZoomRef = useRef(1);

  // Interactive Hover State for Cluster Inspection Tooltip
  const [hoveredCluster, setHoveredCluster] = useState(null);
  const [mousePos, setMousePos] = useState({ x: -1, y: -1 });

  // Auto-fit view when symbol or timeframe changes
  useEffect(() => {
    setPanX(0);
    setPanY(0);
    setZoom(1.15);
    setHoveredCluster(null);
  }, [symbol, timeframe]);

  // Smooth Zoom In / Out / Reset
  const handleZoomIn = () => {
    setZoom((z) => Math.min(3.5, Number((z * 1.25).toFixed(2))));
  };

  const handleZoomOut = () => {
    setZoom((z) => Math.max(0.55, Number((z / 1.25).toFixed(2))));
  };

  const handleResetView = () => {
    setZoom(1.15);
    setPanX(0);
    setPanY(0);
    setHoveredCluster(null);
  };

  // Main Canvas Render Loop (60 FPS, High-DPI Retina, Pure White Theme)
  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth || 800;
    const chartHeight = height;

    if (canvas.width !== width * dpr || canvas.height !== chartHeight * dpr) {
      canvas.width = width * dpr;
      canvas.height = chartHeight * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${chartHeight}px`;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Pure Crisp White Canvas Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, chartHeight);

    if (!footprintData || footprintData.length === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Loading live ${symbol} footprint clusters...`, width / 2, chartHeight / 2);
      ctx.restore();
      return;
    }

    // Layout Dimensions
    const rightMargin = 85; // Space for Price Scale Ruler
    const bottomMargin = 50; // Space for Time & Delta Scale
    const plotWidth = width - rightMargin;
    const plotHeight = chartHeight - bottomMargin;

    // Zoom scaling metrics:
    // When zoomed in, bars become wider and rows become taller with bigger fonts
    const baseBarWidth = 96;
    const barWidth = Math.round(baseBarWidth * zoom);
    const barSpacing = Math.round(20 * zoom);

    // Determine global price range across visible bars
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    footprintData.forEach((b) => {
      if (b.low < minPrice) minPrice = b.low;
      if (b.high > maxPrice) maxPrice = b.high;
      (b.clusters || []).forEach((c) => {
        if (c.price < minPrice) minPrice = c.price;
        if (c.price > maxPrice) maxPrice = c.price;
      });
    });

    if (minPrice >= maxPrice || !isFinite(minPrice) || !isFinite(maxPrice)) {
      minPrice = 2740;
      maxPrice = 2765;
    }

    // Add 8% vertical padding
    const pRange = maxPrice - minPrice;
    const paddedMin = minPrice - pRange * 0.06;
    const paddedMax = maxPrice + pRange * 0.06;

    // Price to Y Coordinate Mapper
    const priceSpan = paddedMax - paddedMin;
    const priceToY = (p) => {
      const norm = (p - paddedMin) / (priceSpan || 1);
      const baseY = plotHeight - norm * plotHeight;
      const centerY = plotHeight / 2;
      return centerY + (baseY - centerY) * zoom + panY;
    };

    // 2. Subtle Background Grid (Light Slate #f8fafc / #f1f5f9)
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;

    const nPriceLines = 8;
    for (let i = 0; i <= nPriceLines; i++) {
      const gridP = paddedMin + (priceSpan / nPriceLines) * i;
      const y = priceToY(gridP);
      if (y >= 0 && y <= plotHeight) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(plotWidth, y);
        ctx.stroke();
      }
    }

    // 3. Render Footprint Candlestick Bars (Right-Aligned, scrolling left into history)
    const nBars = footprintData.length;
    const startX = plotWidth - barWidth - 16 + panX;

    // Clip to plot area for candlesticks & clusters
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, plotWidth, plotHeight);
    ctx.clip();

    footprintData.forEach((bar, idx) => {
      const barRightX = startX - (nBars - 1 - idx) * (barWidth + barSpacing);
      const barLeftX = barRightX;
      const barCenterX = barLeftX + barWidth / 2;

      // Skip bars outside viewport for maximum rendering performance
      if (barRightX + barWidth < -60 || barLeftX > plotWidth + 60) return;

      const isBull = bar.close >= bar.open;
      const oY = priceToY(bar.open);
      const cY = priceToY(bar.close);
      const hY = priceToY(bar.high);
      const lY = priceToY(bar.low);

      // A. Center Vertical Wick (Clean Slate)
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = Math.max(1.5, Math.round(2 * zoom));
      ctx.beginPath();
      ctx.moveTo(barCenterX, hY);
      ctx.lineTo(barCenterX, lY);
      ctx.stroke();

      // B. Left-Side Open-Close Body Bar (ATAS Edge Marker)
      const wickLeftX = barLeftX - Math.max(5, Math.round(7 * zoom));
      ctx.strokeStyle = isBull ? '#16a34a' : '#dc2626';
      ctx.lineWidth = Math.max(3.5, Math.round(5 * zoom));
      ctx.beginPath();
      ctx.moveTo(wickLeftX, oY);
      ctx.lineTo(wickLeftX, cY);
      ctx.stroke();

      // Small Open & Close ticks
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(wickLeftX - 3, oY);
      ctx.lineTo(wickLeftX, oY);
      ctx.moveTo(wickLeftX, cY);
      ctx.lineTo(wickLeftX + 3, cY);
      ctx.stroke();

      // Find Candle POC (Highest Traded Volume Level)
      let maxVol = -1;
      let pocPrice = null;
      (bar.clusters || []).forEach((c) => {
        const tot = (c.bid || 0) + (c.ask || 0);
        if (tot > maxVol) {
          maxVol = tot;
          pocPrice = c.price;
        }
      });

      // C. Draw Cluster Price Rows (Footprint Delta Cells)
      const clusters = bar.clusters || [];
      if (clusters.length > 0) {
        const sorted = [...clusters].sort((a, b) => a.price - b.price);
        const step = sorted.length > 1 ? Math.abs(sorted[1].price - sorted[0].price) : 0.5;
        const rowHeight = Math.max(12, Math.abs(priceToY(sorted[0].price) - priceToY(sorted[0].price + step)));

        // Dynamic font size: expands smoothly when zoomed in!
        const fontSize = Math.min(18, Math.max(9, Math.round(rowHeight * 0.62 * Math.min(1.4, zoom))));
        ctx.font = `bold ${fontSize}px "JetBrains Mono", Consolas, monospace`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';

        clusters.forEach((c) => {
          const cy = priceToY(c.price);
          const cellTop = cy - rowHeight / 2;
          const centerY = cellTop + rowHeight / 2;

          if (cellTop + rowHeight < 0 || cellTop > plotHeight) return;

          const isPOC = c.price === pocPrice;
          const bid = c.bid || 0;
          const ask = c.ask || 0;
          const tot = bid + ask;
          const delta = ask - bid;

          // Institutional Imbalance Rule (300%+ with minimum 30 contracts threshold)
          const isBuyImbalance = ask >= bid * 3 && ask >= 30;
          const isSellImbalance = bid >= ask * 3 && bid >= 30;
          const halfW = barWidth / 2;
          const bidX = barLeftX + halfW * 0.5;
          const askX = barLeftX + halfW * 1.5;

          if (displayMode === 'delta') {
            // Delta Heatmap View
            let cellFill;
            if (delta > 0) {
              const alpha = Math.min(0.85, 0.20 + (delta / 1200) * 0.65);
              cellFill = `rgba(22, 163, 74, ${alpha})`;
            } else if (delta < 0) {
              const alpha = Math.min(0.85, 0.20 + (Math.abs(delta) / 1200) * 0.65);
              cellFill = `rgba(220, 38, 38, ${alpha})`;
            } else {
              cellFill = 'rgba(241, 245, 249, 0.8)';
            }
            ctx.fillStyle = cellFill;
            ctx.fillRect(barLeftX, cellTop, barWidth, rowHeight - 1);

            if (rowHeight >= 11 && barWidth >= 40) {
              ctx.fillStyle = Math.abs(delta) > 300 ? '#ffffff' : (delta > 0 ? '#166534' : '#991b1b');
              const deltaStr = delta > 0 ? `+${delta}` : `${delta}`;
              ctx.fillText(deltaStr, barCenterX, centerY);
            }
          } else if (displayMode === 'volume') {
            // Total Volume View
            const vAlpha = Math.min(0.75, 0.15 + (tot / 2500) * 0.6);
            ctx.fillStyle = isPOC ? 'rgba(245, 158, 11, 0.35)' : `rgba(59, 130, 246, ${vAlpha})`;
            ctx.fillRect(barLeftX, cellTop, barWidth, rowHeight - 1);

            if (rowHeight >= 11 && barWidth >= 40) {
              ctx.fillStyle = '#0f172a';
              ctx.fillText(String(tot), barCenterX, centerY);
            }
          } else {
            // ATAS Dual Bid x Ask Half-Cell Rendering (White Theme)
            // Left Half: Bid Volume (Red Tones)
            let bidFill;
            if (isSellImbalance) {
              bidFill = '#ef4444'; // Solid Vivid Red on Sell Imbalance
            } else {
              const bAlpha = Math.min(0.35, 0.08 + (bid / 1500) * 0.27);
              bidFill = `rgba(239, 68, 68, ${bAlpha})`;
            }
            ctx.fillStyle = bidFill;
            ctx.fillRect(barLeftX, cellTop, halfW, rowHeight - 1);

            // Right Half: Ask Volume (Green Tones)
            let askFill;
            if (isBuyImbalance) {
              askFill = '#10b981'; // Solid Vivid Emerald on Buy Imbalance
            } else {
              const aAlpha = Math.min(0.35, 0.08 + (ask / 1500) * 0.27);
              askFill = `rgba(16, 185, 129, ${aAlpha})`;
            }
            ctx.fillStyle = askFill;
            ctx.fillRect(barLeftX + halfW, cellTop, halfW, rowHeight - 1);

            // Center vertical divider between Bid and Ask
            ctx.strokeStyle = 'rgba(203, 213, 225, 0.7)';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(barLeftX + halfW, cellTop);
            ctx.lineTo(barLeftX + halfW, cellTop + rowHeight - 1);
            ctx.stroke();

            // Bid & Ask Numbers (White Theme, High Contrast)
            if (rowHeight >= 10 && barWidth >= 38) {
              // Bid text
              ctx.fillStyle = isSellImbalance ? '#ffffff' : '#991b1b';
              ctx.fillText(String(bid), bidX, centerY);

              // Ask text
              ctx.fillStyle = isBuyImbalance ? '#ffffff' : '#14532d';
              ctx.fillText(String(ask), askX, centerY);
            }
          }

          // Subtle horizontal cell outline
          ctx.strokeStyle = 'rgba(226, 232, 240, 0.85)';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(barLeftX, cellTop, barWidth, rowHeight - 1);

          // Candle POC Outline (Glowing Amber Box)
          if (isPOC) {
            ctx.strokeStyle = '#d97706'; // Rich Amber / Gold
            ctx.lineWidth = Math.max(1.8, Math.round(2.2 * zoom));
            ctx.strokeRect(barLeftX - 0.5, cellTop - 0.5, barWidth + 1, rowHeight);

            // POC badge tag on right side when zoomed in
            if (zoom >= 0.95) {
              ctx.fillStyle = '#d97706';
              ctx.fillRect(barRightX + barWidth + 1, cellTop, 24, rowHeight - 1);
              ctx.fillStyle = '#ffffff';
              ctx.font = `bold ${Math.max(8, Math.round(fontSize * 0.75))}px monospace`;
              ctx.fillText('POC', barRightX + barWidth + 13, centerY);
              ctx.font = `bold ${fontSize}px "JetBrains Mono", Consolas, monospace`;
            }
          }

          // Interactive Hover Highlight on Cluster
          if (
            mousePos.x >= barLeftX &&
            mousePos.x <= barLeftX + barWidth &&
            mousePos.y >= cellTop &&
            mousePos.y <= cellTop + rowHeight
          ) {
            ctx.strokeStyle = '#2563eb';
            ctx.lineWidth = 2;
            ctx.strokeRect(barLeftX - 1, cellTop - 1, barWidth + 2, rowHeight + 1);
          }
        });
      }

      // E. Bottom Candle Metrics (Delta & Volume & IST Time)
      const deltaVal = bar.delta || 0;
      const isDeltaPos = deltaVal >= 0;

      // Delta Badge
      ctx.textAlign = 'center';
      ctx.font = `bold ${Math.min(13, Math.max(9, Math.round(11 * zoom)))}px monospace`;
      ctx.fillStyle = isDeltaPos ? '#16a34a' : '#dc2626';
      const deltaText = `Δ ${deltaVal > 0 ? `+${deltaVal}` : deltaVal}`;
      ctx.fillText(deltaText, barCenterX, plotHeight - 20);

      // Total Volume
      ctx.fillStyle = '#64748b';
      ctx.font = `${Math.min(11, Math.max(8, Math.round(9.5 * zoom)))}px monospace`;
      const volK = bar.volume ? (bar.volume >= 1000 ? `${(bar.volume / 1000).toFixed(1)}K` : Math.round(bar.volume)) : '---';
      ctx.fillText(`V: ${volK}`, barCenterX, plotHeight - 6);

      // IST Time Mark
      const timeStr = bar.datetime ? bar.datetime.split(' ')[1] || bar.datetime : '';
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(timeStr, barCenterX, chartHeight - 12);
    });

    ctx.restore(); // Restore clipping

    // 4. Live Gold Price Horizontal Line (Green Dashed + Right Price Pill)
    if (currentPrice != null) {
      const curY = priceToY(currentPrice);
      if (curY >= 0 && curY <= plotHeight) {
        ctx.strokeStyle = '#16a34a';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, curY);
        ctx.lineTo(plotWidth, curY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Pulsing Live Price Pill on Right Axis
        ctx.fillStyle = '#16a34a';
        ctx.fillRect(plotWidth + 2, curY - 11, rightMargin - 4, 22);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(currentPrice.toFixed(decimals), plotWidth + rightMargin / 2, curY + 4);
      }
    }

    // 5. Right Price Scale Ruler (Clean White / Soft Slate)
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(plotWidth, 0, rightMargin, plotHeight);

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotWidth, 0);
    ctx.lineTo(plotWidth, plotHeight);
    ctx.stroke();

    ctx.fillStyle = '#475569';
    ctx.font = 'bold 10.5px monospace';
    ctx.textAlign = 'left';

    for (let i = 0; i <= nPriceLines; i++) {
      const p = paddedMin + (priceSpan / nPriceLines) * i;
      const y = priceToY(p);
      if (y >= 8 && y <= plotHeight - 8) {
        ctx.beginPath();
        ctx.moveTo(plotWidth, y);
        ctx.lineTo(plotWidth + 4, y);
        ctx.stroke();
        ctx.fillText(p.toFixed(decimals), plotWidth + 7, y + 3.5);
      }
    }

    // 6. Bottom Time Scale Bar
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, plotHeight, width, bottomMargin);

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, plotHeight);
    ctx.lineTo(width, plotHeight);
    ctx.stroke();

    ctx.restore();
  }, [footprintData, symbol, timeframe, currentPrice, decimals, height, zoom, panX, panY, displayMode, mousePos]);

  // Request Animation Frame on state changes for 60 FPS fluid rendering
  useEffect(() => {
    const animId = requestAnimationFrame(drawChart);
    return () => cancelAnimationFrame(animId);
  }, [drawChart]);

  // Window resize observer
  useEffect(() => {
    const handleResize = () => drawChart();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawChart]);

  // Mouse Drag Panning Handlers
  const handleMouseDown = (e) => {
    isDraggingRef.current = true;
    setIsCursorGrabbing(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { x: panX, y: panY };
  };

  const handleMouseMove = (e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }

    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPanX(panStartRef.current.x + dx);
    setPanY(panStartRef.current.y + dy);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    setIsCursorGrabbing(false);
  };

  // Smooth Mouse Wheel Zoom (Anchored to Mouse Cursor Coordinates)
  const handleWheel = (e) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;

    setZoom((prevZoom) => {
      const nextZoom = Math.max(0.50, Math.min(3.5, Number((prevZoom * zoomFactor).toFixed(2))));
      const scaleChange = nextZoom / prevZoom;

      // Pan adjustment so the point under cursor remains stationary
      setPanX((prevX) => mouseX - (mouseX - prevX) * scaleChange);
      setPanY((prevY) => mouseY - (mouseY - prevY) * scaleChange);

      return nextZoom;
    });
  };

  // Touch Handlers for Mobile & Tablet (Pinch to Zoom & Drag to Pan)
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      setIsCursorGrabbing(true);
      dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      panStartRef.current = { x: panX, y: panY };
    } else if (e.touches.length === 2) {
      isDraggingRef.current = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStartDistRef.current = Math.hypot(dx, dy);
      touchStartZoomRef.current = zoom;
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 1 && isDraggingRef.current) {
      const dx = e.touches[0].clientX - dragStartRef.current.x;
      const dy = e.touches[0].clientY - dragStartRef.current.y;
      setPanX(panStartRef.current.x + dx);
      setPanY(panStartRef.current.y + dy);
    } else if (e.touches.length === 2 && touchStartDistRef.current > 0) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const scale = dist / touchStartDistRef.current;
      const nextZoom = Math.max(0.50, Math.min(3.5, Number((touchStartZoomRef.current * scale).toFixed(2))));
      setZoom(nextZoom);
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    setIsCursorGrabbing(false);
    touchStartDistRef.current = 0;
  };

  // Summary Metrics of the Latest Active Candle
  const latestBar = footprintData && footprintData.length > 0 ? footprintData[footprintData.length - 1] : null;
  const latestDelta = latestBar?.delta ?? 0;
  const latestVol = latestBar?.volume ? Math.round(latestBar.volume).toLocaleString() : '---';

  return (
    <div
      ref={containerRef}
      className={`bg-white text-slate-900 border border-slate-200/90 rounded-2xl overflow-hidden flex flex-col transition-all shadow-[0_2px_12px_rgba(0,0,0,0.03)] ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none border-none' : 'relative'
      }`}
    >
      {/* 1. Footprint Header & Control Toolbar (Pure White Theme) */}
      <div className="bg-white border-b border-slate-200/80 px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 shrink-0">
        {/* Left: Title & Live Pill */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 font-black text-xs sm:text-sm tracking-tight text-slate-900">
            <Flame className="w-4 h-4 text-emerald-600 fill-emerald-600 animate-pulse" />
            <span>XAUUSD (Gold Spot)</span>
          </div>

          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 uppercase font-mono">
            {timeframe} Footprint
          </span>

          <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
            ATAS ORDER FLOW (<span className="text-emerald-800">50ms Live</span>)
          </span>
        </div>

        {/* Center: Timeframe Switcher (White Theme) */}
        {onSelectTimeframe && (
          <div className="flex items-center p-0.5 rounded-lg border border-slate-200 bg-slate-100 text-xs font-semibold">
            {['5m', '15m', '1h', '4h'].map((tf) => (
              <button
                key={tf}
                onClick={() => onSelectTimeframe(tf)}
                className={`px-2 py-0.5 rounded-md transition ${
                  timeframe.toLowerCase() === tf
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {/* Right: Display Mode, Zoom Controls, Reset */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Display Mode: Bid x Ask vs Delta vs Volume */}
          <div className="flex items-center p-0.5 rounded-lg border border-slate-200 bg-slate-100 text-[11px] font-semibold">
            <button
              onClick={() => setDisplayMode('bid_ask')}
              className={`px-2 py-0.5 rounded transition ${
                displayMode === 'bid_ask'
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Show Bid x Ask Volume"
            >
              Bid × Ask
            </button>
            <button
              onClick={() => setDisplayMode('delta')}
              className={`px-2 py-0.5 rounded transition ${
                displayMode === 'delta'
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Show Cluster Net Delta"
            >
              Delta
            </button>
            <button
              onClick={() => setDisplayMode('volume')}
              className={`px-2 py-0.5 rounded transition ${
                displayMode === 'volume'
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Show Total Volume"
            >
              Volume
            </button>
          </div>

          {/* Zoom Buttons with Dynamic Text Scaling */}
          <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={handleZoomIn}
              className="w-7 h-7 flex items-center justify-center rounded text-slate-700 hover:bg-white hover:shadow-xs transition"
              title="Zoom In (Enlarge Numbers & Details)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleZoomOut}
              className="w-7 h-7 flex items-center justify-center rounded text-slate-700 hover:bg-white hover:shadow-xs transition"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetView}
              className="px-1.5 h-7 flex items-center gap-1 rounded text-[10px] font-bold text-slate-700 hover:bg-white hover:shadow-xs transition"
              title="Reset View & Snap to Live Candle"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>

          {/* Fullscreen Toggle */}
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className="p-1.5 rounded-lg border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Footprint'}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Metric Ribbon: Quick Institutional Read (White Theme) */}
      <div className="bg-slate-50 border-b border-slate-200 px-3 sm:px-5 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-500 font-sans">Active Candle:</span>
          <span className={`font-bold ${latestDelta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            Δ {latestDelta >= 0 ? `+${latestDelta}` : latestDelta}
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-600">Vol: <b>{latestVol} lots</b></span>
          <span className="text-slate-300">|</span>
          <span className="text-amber-700 font-bold">⭐ POC Active</span>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-sans text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-rose-500"></span> Bid (Sellers)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-emerald-500"></span> Ask (Buyers)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-amber-500"></span> POC Magnet
          </span>
        </div>
      </div>

      {/* 3. Interactive HTML5 Canvas (Touch action none for smooth pinch & drag) */}
      <div
        className="relative flex-1 bg-white overflow-hidden select-none"
        style={{
          height: isFullscreen ? 'calc(100vh - 100px)' : `${height}px`,
          cursor: isCursorGrabbing ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="absolute inset-0 block w-full h-full"
        />

        {/* Live Interaction Helper Overlay Badge */}
        <div className="absolute top-2 left-3 pointer-events-none z-10 flex items-center gap-2 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-md border border-slate-200 shadow-xs text-[10px] text-slate-500 font-mono">
          <span>Zoom: {Math.round(zoom * 100)}%</span>
          <span>•</span>
          <span>Scroll to Zoom</span>
          <span>•</span>
          <span>Drag to Pan</span>
        </div>
      </div>
    </div>
  );
}
