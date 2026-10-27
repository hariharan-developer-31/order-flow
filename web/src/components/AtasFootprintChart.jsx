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

  // View state: Bid x Ask vs Delta vs Volume Heatmap
  const [displayMode, setDisplayMode] = useState('bid_ask'); // 'bid_ask' | 'delta' | 'volume'
  const [colorTheme, setColorTheme] = useState('dark'); // 'dark' (ATAS Pro) | 'light'

  // Interactive Zoom & Pan State
  // zoom: 0.6 (zoomed out) to 3.0 (ultra-detailed, giant numbers)
  const [zoom, setZoom] = useState(1.15);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  // Dragging interaction refs
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });

  // Touch pinch interaction refs
  const touchStartDistRef = useRef(0);
  const touchStartZoomRef = useRef(1);

  // Hovered cluster state for interactive tooltip
  const [hoveredInfo, setHoveredInfo] = useState(null);

  // Auto-fit view when symbol or timeframe changes
  useEffect(() => {
    setPanX(0);
    setPanY(0);
    setZoom(1.15);
  }, [symbol, timeframe]);

  // Handle Zoom In / Out / Reset
  const handleZoomIn = () => setZoom((z) => Math.min(3.2, Number((z * 1.25).toFixed(2))));
  const handleZoomOut = () => setZoom((z) => Math.max(0.5, Number((z / 1.25).toFixed(2))));
  const handleResetView = () => {
    setZoom(1.15);
    setPanX(0);
    setPanY(0);
  };

  // Main Canvas Render Loop (60fps Crisp Canvas)
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

    // 1. Clear & Background
    const isDark = colorTheme === 'dark';
    ctx.fillStyle = isDark ? '#0b1120' : '#ffffff'; // ATAS Deep Navy / Obsidian
    ctx.fillRect(0, 0, width, chartHeight);

    if (!footprintData || footprintData.length === 0) {
      ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
      ctx.font = 'bold 14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Waiting for ${symbol} Footprint Clusters...`, width / 2, chartHeight / 2);
      ctx.restore();
      return;
    }

    // Layout Dimensions (Scale dynamically with ZOOM!)
    const rightMargin = 85; // Space for Price Scale
    const bottomMargin = 48; // Space for Time & Delta Scale
    const plotWidth = width - rightMargin;
    const plotHeight = chartHeight - bottomMargin;

    // Zoom scaling metrics:
    // When zoomed in, bars become wider and rows become taller!
    const baseBarWidth = 92;
    const barWidth = Math.round(baseBarWidth * zoom);
    const barSpacing = Math.round(18 * zoom);

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
      minPrice = 4000;
      maxPrice = 4030;
    }

    // Add 8% vertical padding
    const pRange = maxPrice - minPrice;
    const paddedMin = minPrice - pRange * 0.05;
    const paddedMax = maxPrice + pRange * 0.05;

    // Price to Y Coordinate Mapper (with vertical pan and vertical zoom)
    const priceSpan = paddedMax - paddedMin;
    const priceToY = (p) => {
      const norm = (p - paddedMin) / (priceSpan || 1);
      const baseY = plotHeight - norm * plotHeight;
      // Apply vertical zoom and pan
      const centerY = plotHeight / 2;
      return centerY + (baseY - centerY) * zoom + panY;
    };

    const yToPrice = (y) => {
      const centerY = plotHeight / 2;
      const unzoomedY = (y - panY - centerY) / zoom + centerY;
      const norm = (plotHeight - unzoomedY) / plotHeight;
      return paddedMin + norm * priceSpan;
    };

    // 2. Draw Subtle Background Grid
    ctx.strokeStyle = isDark ? 'rgba(30, 41, 59, 0.45)' : 'rgba(241, 245, 249, 0.9)';
    ctx.lineWidth = 1;

    // Horizontal Price Grid Lines
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
    const totalBarsWidth = nBars * (barWidth + barSpacing);
    const startX = plotWidth - barWidth - 14 + panX;

    // Clip to plot area for bars
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, plotWidth, plotHeight);
    ctx.clip();

    footprintData.forEach((bar, idx) => {
      // Calculate X coordinate for this bar
      const barRightX = startX - (nBars - 1 - idx) * (barWidth + barSpacing);
      const barLeftX = barRightX;
      const barCenterX = barLeftX + barWidth / 2;

      // Skip if completely out of view
      if (barRightX + barWidth < -40 || barLeftX > plotWidth + 40) return;

      const isBull = bar.close >= bar.open;
      const oY = priceToY(bar.open);
      const cY = priceToY(bar.close);
      const hY = priceToY(bar.high);
      const lY = priceToY(bar.low);

      // A. Draw High and Low Candle Wicks (Center vertical wick)
      ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.65)' : 'rgba(100, 116, 139, 0.65)';
      ctx.lineWidth = Math.max(1, Math.round(1.5 * zoom));
      ctx.beginPath();
      ctx.moveTo(barCenterX, hY);
      ctx.lineTo(barCenterX, lY);
      ctx.stroke();

      // B. Draw Left-Side Candle Open-Close Marker (ATAS style body edge)
      const wickLeftX = barLeftX - Math.max(4, Math.round(6 * zoom));
      ctx.strokeStyle = isBull ? '#10b981' : '#ef4444';
      ctx.lineWidth = Math.max(3, Math.round(4.5 * zoom));
      ctx.beginPath();
      ctx.moveTo(wickLeftX, oY);
      ctx.lineTo(wickLeftX, cY);
      ctx.stroke();

      // Small tick for open and close
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(wickLeftX - 3, oY);
      ctx.lineTo(wickLeftX, oY);
      ctx.moveTo(wickLeftX, cY);
      ctx.lineTo(wickLeftX + 3, cY);
      ctx.stroke();

      // Find Candle POC (Highest Volume Cluster)
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
        // Compute row height based on step
        const sorted = [...clusters].sort((a, b) => a.price - b.price);
        const step = sorted.length > 1 ? Math.abs(sorted[1].price - sorted[0].price) : 0.5;
        const rowHeight = Math.max(10, Math.abs(priceToY(sorted[0].price) - priceToY(sorted[0].price + step)));

          // Dynamic font size: expands dynamically when zoomed in!
          // As you zoom in, numbers get bigger, bolder, and more legible!
          const fontSize = Math.min(18, Math.max(8, Math.round(rowHeight * 0.62 * Math.min(1.5, zoom))));
          ctx.font = `bold ${fontSize}px "JetBrains Mono", Consolas, monospace`;
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'center';

          clusters.forEach((c) => {
            const cy = priceToY(c.price);
            const cellTop = cy - rowHeight / 2;
            const centerY = cellTop + rowHeight / 2;

            // Skip if row is out of plot height
            if (cellTop + rowHeight < 0 || cellTop > plotHeight) return;

            const isPOC = c.price === pocPrice;
            const bid = c.bid || 0;
            const ask = c.ask || 0;
            const tot = bid + ask;
            const delta = ask - bid;

            // Imbalance calculation: Ask >= Bid * 3 (Buy Imbalance) or Bid >= Ask * 3 (Sell Imbalance)
            const isBuyImbalance = ask >= bid * 3 && ask > 0;
            const isSellImbalance = bid >= ask * 3 && bid > 0;
            const halfW = barWidth / 2;
            const bidX = barLeftX + halfW * 0.5;
            const askX = barLeftX + halfW * 1.5;

            if (displayMode === 'delta') {
              // Delta View
              let cellFill;
              if (delta > 0) {
                const alpha = Math.min(0.85, 0.25 + (delta / 1500) * 0.6);
                cellFill = `rgba(16, 185, 129, ${alpha})`;
              } else if (delta < 0) {
                const alpha = Math.min(0.85, 0.25 + (Math.abs(delta) / 1500) * 0.6);
                cellFill = `rgba(239, 68, 68, ${alpha})`;
              } else {
                cellFill = isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(226, 232, 240, 0.5)';
              }
              ctx.fillStyle = cellFill;
              ctx.fillRect(barLeftX, cellTop, barWidth, rowHeight - 1);

              if (rowHeight >= 11 && barWidth >= 40) {
                ctx.fillStyle = '#ffffff';
                const deltaStr = delta > 0 ? `+${delta}` : `${delta}`;
                ctx.fillText(deltaStr, barCenterX, centerY);
              }
            } else {
              // ATAS Dual Bid x Ask Half-Cell Rendering
              // Left Half: Bid (Red Sellers)
              let bidFill;
              if (isSellImbalance) {
                bidFill = 'rgba(239, 68, 68, 0.88)'; // Strong Red Sell Imbalance
              } else {
                const bAlpha = Math.min(0.7, 0.15 + (bid / 1200) * 0.55);
                bidFill = `rgba(239, 68, 68, ${bAlpha})`;
              }
              ctx.fillStyle = bidFill;
              ctx.fillRect(barLeftX, cellTop, halfW, rowHeight - 1);

              // Right Half: Ask (Green Buyers)
              let askFill;
              if (isBuyImbalance) {
                askFill = 'rgba(16, 185, 129, 0.88)'; // Strong Green Buy Imbalance
              } else {
                const aAlpha = Math.min(0.7, 0.15 + (ask / 1200) * 0.55);
                askFill = `rgba(16, 185, 129, ${aAlpha})`;
              }
              ctx.fillStyle = askFill;
              ctx.fillRect(barLeftX + halfW, cellTop, halfW, rowHeight - 1);

              // Center vertical divider
              ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.12)';
              ctx.lineWidth = 0.8;
              ctx.beginPath();
              ctx.moveTo(barLeftX + halfW, cellTop);
              ctx.lineTo(barLeftX + halfW, cellTop + rowHeight - 1);
              ctx.stroke();

              // Print Bid & Ask Numbers (Expands and gets bolder when zoomed in!)
              if (rowHeight >= 10 && barWidth >= 38) {
                // Bid text (Left)
                ctx.fillStyle = isSellImbalance ? '#ffffff' : isDark ? '#fee2e2' : '#991b1b';
                ctx.fillText(String(bid), bidX, centerY);

                // Ask text (Right)
                ctx.fillStyle = isBuyImbalance ? '#ffffff' : isDark ? '#dcfce7' : '#14532d';
                ctx.fillText(String(ask), askX, centerY);
              }
            }

            // Subtle cell border
            ctx.strokeStyle = isDark ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.6)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(barLeftX, cellTop, barWidth, rowHeight - 1);

            // POC Box Outline (Distinctive Glowing Box in ATAS style)
            if (isPOC) {
              ctx.strokeStyle = '#f59e0b'; // Amber / Gold POC Border
              ctx.lineWidth = Math.max(1.5, Math.round(2 * zoom));
              ctx.strokeRect(barLeftX - 0.5, cellTop - 0.5, barWidth + 1, rowHeight);

              // Small POC tag on side if zoomed in
              if (zoom >= 1.0) {
                ctx.fillStyle = '#f59e0b';
                ctx.fillRect(barRightX + barWidth + 1, cellTop, 22, rowHeight - 1);
                ctx.fillStyle = '#0f172a';
                ctx.font = `bold ${Math.max(7, Math.round(fontSize * 0.75))}px monospace`;
                ctx.fillText('POC', barRightX + barWidth + 12, centerY);
                ctx.font = `bold ${fontSize}px "JetBrains Mono", Consolas, monospace`;
              }
            }
          });
      }

      // E. Draw Top / Bottom Summary Badges (Delta & Volume & IST Time)
      const deltaVal = bar.delta || 0;
      const isDeltaPos = deltaVal >= 0;

      // Delta Badge below the bar
      ctx.textAlign = 'center';
      ctx.font = `bold ${Math.min(13, Math.max(9, Math.round(11 * zoom)))}px monospace`;
      ctx.fillStyle = isDeltaPos ? '#10b981' : '#ef4444';
      const deltaText = `Δ ${deltaVal > 0 ? `+${deltaVal}` : deltaVal}`;
      ctx.fillText(deltaText, barCenterX, plotHeight - 20);

      // Total Volume
      ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
      ctx.font = `${Math.min(11, Math.max(8, Math.round(9.5 * zoom)))}px monospace`;
      const volK = bar.volume ? (bar.volume >= 1000 ? `${(bar.volume / 1000).toFixed(1)}K` : Math.round(bar.volume)) : '---';
      ctx.fillText(`V: ${volK}`, barCenterX, plotHeight - 6);

      // IST Time Mark on Bottom Axis
      const timeStr = bar.datetime ? bar.datetime.split(' ')[1] || bar.datetime : '';
      ctx.fillStyle = isDark ? '#cbd5e1' : '#475569';
      ctx.font = 'bold 9.5px monospace';
      ctx.fillText(timeStr, barCenterX, chartHeight - 12);
    });

    ctx.restore(); // Restore clipping

    // 4. Horizontal Current Live Price Line (Pulsing Line & Right Badge)
    if (currentPrice != null) {
      const curY = priceToY(currentPrice);
      if (curY >= 0 && curY <= plotHeight) {
        // Dotted line
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, curY);
        ctx.lineTo(plotWidth, curY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Pulsing Live Price Pill on Right Axis
        ctx.fillStyle = '#10b981';
        ctx.fillRect(plotWidth + 2, curY - 10, rightMargin - 4, 20);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10.5px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(currentPrice.toFixed(decimals), plotWidth + (rightMargin / 2), curY + 4);
      }
    }

    // 5. Right Price Scale Ruler
    ctx.fillStyle = isDark ? '#0f172a' : '#f8fafc';
    ctx.fillRect(plotWidth, 0, rightMargin, plotHeight);

    ctx.strokeStyle = isDark ? '#1e293b' : '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotWidth, 0);
    ctx.lineTo(plotWidth, plotHeight);
    ctx.stroke();

    // Price Tick Labels on Right Scale
    ctx.fillStyle = isDark ? '#94a3b8' : '#475569';
    ctx.font = 'bold 10px monospace';
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
    ctx.fillStyle = isDark ? '#0b1120' : '#ffffff';
    ctx.fillRect(0, plotHeight, width, bottomMargin);

    ctx.strokeStyle = isDark ? '#1e293b' : '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, plotHeight);
    ctx.lineTo(width, plotHeight);
    ctx.stroke();

    ctx.restore();
  }, [footprintData, symbol, timeframe, currentPrice, decimals, height, zoom, panX, panY, displayMode, colorTheme]);

  // Request Animation Frame on state changes
  useEffect(() => {
    let animId = requestAnimationFrame(drawChart);
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
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { x: panX, y: panY };
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPanX(panStartRef.current.x + dx);
    setPanY(panStartRef.current.y + dy);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Mouse Wheel Zooming (Wheel UP = Zoom In, Wheel DOWN = Zoom Out)
  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    setZoom((prevZoom) => {
      const nextZoom = Math.max(0.45, Math.min(3.5, prevZoom * zoomFactor));
      return Number(nextZoom.toFixed(2));
    });
  };

  // Touch handlers for mobile & tablet pinch to zoom and pan
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
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
      const nextZoom = Math.max(0.45, Math.min(3.5, touchStartZoomRef.current * scale));
      setZoom(Number(nextZoom.toFixed(2)));
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    touchStartDistRef.current = 0;
  };

  const isDark = colorTheme === 'dark';

  return (
    <div
      ref={containerRef}
      className={`rounded-2xl border overflow-hidden flex flex-col transition-all shadow-sm ${
        isDark ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
      } ${isFullscreen ? 'fixed inset-0 z-50 rounded-none border-none' : 'relative'}`}
    >
      {/* 1. Footprint Header & Control Toolbar */}
      <div
        className={`px-3 sm:px-5 py-2.5 border-b flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 shrink-0 ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-100'
        }`}
      >
        {/* Left: Title & Live Pill */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 font-black text-xs sm:text-sm tracking-tight text-emerald-500">
            <Flame className="w-4 h-4 fill-emerald-500 animate-pulse" />
            <span className={isDark ? 'text-white' : 'text-slate-900'}>
              {symbol === 'XAUUSD' ? 'XAUUSD (Gold)' : symbol}
            </span>
          </div>

          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase font-mono">
            {timeframe} Footprint
          </span>

          <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
            ATAS ORDER FLOW
          </span>
        </div>

        {/* Center: Timeframe Switcher (if onSelectTimeframe provided) */}
        {onSelectTimeframe && (
          <div className={`flex items-center p-0.5 rounded-lg border text-xs font-semibold ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
            {['5m', '15m', '1h', '4h'].map((tf) => (
              <button
                key={tf}
                onClick={() => onSelectTimeframe(tf)}
                className={`px-2 py-0.5 rounded-md transition ${
                  timeframe.toLowerCase() === tf
                    ? 'bg-blue-600 text-white font-bold shadow-sm'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {/* Right: Zoom In/Out, Mode Switcher, Fullscreen */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Display Mode: Bid x Ask vs Delta */}
          <div className={`flex items-center p-0.5 rounded-lg border text-[11px] font-semibold ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
            <button
              onClick={() => setDisplayMode('bid_ask')}
              className={`px-2 py-0.5 rounded transition ${
                displayMode === 'bid_ask'
                  ? 'bg-blue-600 text-white font-bold'
                  : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600'
              }`}
              title="Show Bid × Ask Volume"
            >
              Bid × Ask
            </button>
            <button
              onClick={() => setDisplayMode('delta')}
              className={`px-2 py-0.5 rounded transition ${
                displayMode === 'delta'
                  ? 'bg-blue-600 text-white font-bold'
                  : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600'
              }`}
              title="Show Cluster Net Delta"
            >
              Delta
            </button>
          </div>

          {/* Color Theme Switch: Dark (ATAS) vs Light */}
          <button
            onClick={() => setColorTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
            }`}
            title="Toggle Dark / Light Theme"
          >
            {isDark ? '🌙 Dark' : '☀️ Light'}
          </button>

          {/* Zoom Controls */}
          <div className={`flex items-center rounded-lg border p-0.5 ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
            <button
              onClick={handleZoomIn}
              className={`w-7 h-7 flex items-center justify-center rounded transition ${isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-200 text-slate-700'}`}
              title="Zoom In (Enlarge Numbers & Details)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <span className={`text-[10px] font-mono font-bold px-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomOut}
              className={`w-7 h-7 flex items-center justify-center rounded transition ${isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-200 text-slate-700'}`}
              title="Zoom Out (Show More Bars)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetView}
              className={`w-7 h-7 flex items-center justify-center rounded transition ${isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-200 text-slate-700'}`}
              title="Reset View"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Fullscreen Button */}
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className={`w-8 h-8 flex items-center justify-center rounded-xl border transition ${
                isDark ? 'border-slate-800 hover:bg-slate-800 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-600'
              }`}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* 2. Interactive ATAS Canvas Area */}
      <div
        className="relative flex-1 select-none cursor-grab active:cursor-grabbing overflow-hidden"
        style={{ height: isFullscreen ? 'calc(100vh - 100px)' : `${height}px` }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <canvas ref={canvasRef} className="block w-full h-full" />

        {/* Floating Quick Legend & Instructions */}
        <div className="absolute top-2 left-2 z-10 pointer-events-none flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md text-white px-2.5 py-1 rounded-lg border border-slate-700 text-[10px] font-mono shadow-md">
            <span className="w-2.5 h-2.5 rounded bg-emerald-500"></span>
            <span>Buy Imbalance (&ge;300%)</span>
            <span className="text-slate-500">|</span>
            <span className="w-2.5 h-2.5 rounded bg-rose-500"></span>
            <span>Sell Imbalance (&ge;300%)</span>
            <span className="text-slate-500">|</span>
            <span className="w-2.5 h-2.5 rounded border border-amber-400 bg-amber-400/20"></span>
            <span>Candle POC</span>
          </div>

          <div className="hidden lg:flex items-center gap-1 bg-slate-900/70 text-slate-300 px-2 py-1 rounded-lg border border-slate-800 text-[10px] font-mono">
            <Info className="w-3 h-3 text-blue-400" />
            <span>Scroll Wheel to Zoom In & Out • Drag to Pan</span>
          </div>
        </div>
      </div>
    </div>
  );
}
