import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
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
import { getFallbackFootprint } from '../data/mockData';
import { getLiveFootprintClusters } from '../services/liveMarketService';

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
  barsData = [],
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  // Guarantee that footprint data is NEVER empty with stable memoized reference
  const effectiveFootprint = useMemo(() => {
    if (footprintData && footprintData.length > 0) return footprintData;
    if (barsData && barsData.length > 0) return getLiveFootprintClusters(barsData, symbol, timeframe);
    return getFallbackFootprint(symbol, 15, timeframe);
  }, [footprintData, barsData, symbol, timeframe]);

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
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const rect = container.getBoundingClientRect();
    const width = Math.max(280, Math.floor(container.clientWidth || rect.width || (typeof window !== 'undefined' ? window.innerWidth - 32 : 800)));
    const chartHeight = height;

    const targetWidth = Math.round(width * dpr);
    const targetHeight = Math.round(chartHeight * dpr);

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    // CRITICAL: Reset transformation matrix on every frame to prevent cumulative scaling explosion
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 1. Pure Crisp White Canvas Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, chartHeight);

    const footprintList = effectiveFootprint;
    if (!footprintList || footprintList.length === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Loading live ${symbol} footprint clusters...`, width / 2, chartHeight / 2);
      return;
    }

    // Layout Dimensions
    const rightMargin = 85; // Space for Price Scale Ruler
    const bottomMargin = 56; // Space for Time & Delta Scale
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
    footprintList.forEach((b) => {
      if (b.low < minPrice) minPrice = b.low;
      if (b.high > maxPrice) maxPrice = b.high;
      (b.clusters || []).forEach((c) => {
        if (c.price < minPrice) minPrice = c.price;
        if (c.price > maxPrice) maxPrice = c.price;
      });
    });

    if (minPrice >= maxPrice || !isFinite(minPrice) || !isFinite(maxPrice)) {
      const cur = currentPrice || 4028.5;
      minPrice = cur - 15;
      maxPrice = cur + 15;
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

    // 2. Subtle Background Grid (Crisp Slate #e2e8f0)
    ctx.strokeStyle = '#e2e8f0';
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
    const nBars = footprintList.length;
    const startX = plotWidth - barWidth - 16 + panX;

    // Clip to plot area for candlesticks & clusters
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, plotWidth, plotHeight);
    ctx.clip();

    try {
      footprintList.forEach((bar, idx) => {
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

      // A. Attached Candle Body Indicator (Integrated on Left Edge of Box)
      const bodyTopY = Math.min(oY, cY);
      const bodyBottomY = Math.max(oY, cY);
      const bodyHeight = Math.max(4, bodyBottomY - bodyTopY);
      ctx.fillStyle = isBull ? '#16a34a' : '#dc2626';
      ctx.fillRect(barLeftX - 3.5, bodyTopY, 3.5, bodyHeight);

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
        const rowHeight = Math.max(15, Math.abs(priceToY(sorted[0].price) - priceToY(sorted[0].price + step)));

        // Calculate top and bottom of the cluster block to draw wicks cleanly outside the text
        const topClusterY = priceToY(sorted[sorted.length - 1].price) - rowHeight / 2;
        const bottomClusterY = priceToY(sorted[0].price) + rowHeight / 2;

        // Top Wick (Extending from top of highest cell to High)
        if (hY < topClusterY) {
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = Math.max(1.5, Math.round(2 * zoom));
          ctx.beginPath();
          ctx.moveTo(barCenterX, hY);
          ctx.lineTo(barCenterX, topClusterY);
          ctx.stroke();
        }

        // Bottom Wick (Extending from bottom of lowest cell to Low)
        if (lY > bottomClusterY) {
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = Math.max(1.5, Math.round(2 * zoom));
          ctx.beginPath();
          ctx.moveTo(barCenterX, bottomClusterY);
          ctx.lineTo(barCenterX, lY);
          ctx.stroke();
        }

        // Dynamic font size: expands smoothly when zoomed in!
        const fontSize = Math.min(16, Math.max(9, Math.round(rowHeight * 0.58 * Math.min(1.35, zoom))));
        ctx.font = `bold ${fontSize}px "JetBrains Mono", Consolas, monospace`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';

        const formatVal = (v, maxW) => {
          if (v >= 1000 && maxW < 40) return `${(v / 1000).toFixed(1)}k`;
          return String(v);
        };

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
          const isBuyImbalance = (ask >= bid * 3 && ask >= 30) || String(c.imbalance).toLowerCase() === 'buy';
          const isSellImbalance = (bid >= ask * 3 && bid >= 30) || String(c.imbalance).toLowerCase() === 'sell';
          const halfW = barWidth / 2;
          const bidX = barLeftX + halfW * 0.5;
          const askX = barLeftX + halfW * 1.5;

          if (displayMode === 'delta') {
            // Delta Heatmap View
            let cellFill;
            if (delta > 0) {
              const alpha = Math.min(0.85, 0.18 + (delta / 800) * 0.65);
              cellFill = `rgba(22, 163, 74, ${alpha})`;
            } else if (delta < 0) {
              const alpha = Math.min(0.85, 0.18 + (Math.abs(delta) / 800) * 0.65);
              cellFill = `rgba(220, 38, 38, ${alpha})`;
            } else {
              cellFill = 'rgba(241, 245, 249, 0.8)';
            }
            ctx.fillStyle = cellFill;
            ctx.fillRect(barLeftX, cellTop, barWidth, rowHeight - 1);

            if (rowHeight >= 11 && barWidth >= 36) {
              ctx.fillStyle = Math.abs(delta) > 200 ? '#ffffff' : (delta > 0 ? '#166534' : '#991b1b');
              const deltaStr = delta > 0 ? `+${formatVal(delta, barWidth)}` : formatVal(delta, barWidth);
              ctx.fillText(deltaStr, barCenterX, centerY);
            }
          } else if (displayMode === 'volume') {
            // Total Volume View
            const vAlpha = Math.min(0.75, 0.15 + (tot / 1500) * 0.6);
            ctx.fillStyle = isPOC ? 'rgba(245, 158, 11, 0.35)' : `rgba(59, 130, 246, ${vAlpha})`;
            ctx.fillRect(barLeftX, cellTop, barWidth, rowHeight - 1);

            if (rowHeight >= 11 && barWidth >= 36) {
              ctx.fillStyle = '#0f172a';
              ctx.fillText(formatVal(tot, barWidth), barCenterX, centerY);
            }
          } else {
            // ATAS Dual Bid x Ask Half-Cell Rendering (White Theme)
            // Left Half: Bid Volume (Red Tones)
            let bidFill;
            if (isSellImbalance) {
              bidFill = '#ef4444'; // Solid Vivid Red on Sell Imbalance
            } else {
              const bAlpha = Math.min(0.38, 0.08 + (bid / 600) * 0.28);
              bidFill = `rgba(239, 68, 68, ${bAlpha})`;
            }
            ctx.fillStyle = bidFill;
            ctx.fillRect(barLeftX, cellTop, halfW, rowHeight - 1);

            // Right Half: Ask Volume (Green Tones)
            let askFill;
            if (isBuyImbalance) {
              askFill = '#10b981'; // Solid Vivid Emerald on Buy Imbalance
            } else {
              const aAlpha = Math.min(0.38, 0.08 + (ask / 600) * 0.28);
              askFill = `rgba(16, 185, 129, ${aAlpha})`;
            }
            ctx.fillStyle = askFill;
            ctx.fillRect(barLeftX + halfW, cellTop, halfW, rowHeight - 1);

            // Center vertical divider between Bid and Ask
            ctx.strokeStyle = 'rgba(203, 213, 225, 0.8)';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(barLeftX + halfW, cellTop);
            ctx.lineTo(barLeftX + halfW, cellTop + rowHeight - 1);
            ctx.stroke();

            // Bid & Ask Numbers (White Theme, High Contrast)
            if (rowHeight >= 10 && barWidth >= 36) {
              // Bid text
              ctx.fillStyle = isSellImbalance ? '#ffffff' : '#991b1b';
              ctx.fillText(formatVal(bid, halfW), bidX, centerY);

              // Ask text
              ctx.fillStyle = isBuyImbalance ? '#ffffff' : '#14532d';
              ctx.fillText(formatVal(ask, halfW), askX, centerY);
            }
          }

          // Subtle horizontal cell outline
          ctx.strokeStyle = 'rgba(226, 232, 240, 0.85)';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(barLeftX, cellTop, barWidth, rowHeight - 1);

          // Candle POC Outline (Glowing Amber Box)
          if (isPOC) {
            ctx.strokeStyle = '#d97706'; // Rich Amber / Gold
            ctx.lineWidth = Math.max(2.0, Math.round(2.5 * zoom));
            ctx.strokeRect(barLeftX - 0.5, cellTop - 0.5, barWidth + 1, rowHeight);

            // POC badge tag on right side when zoomed in
            if (zoom >= 0.90) {
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


    });
  } finally {
    ctx.restore(); // Restore clipping
  }

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

  // 6. Dedicated Bottom Metric Scale Bar (Delta, Volume, IST Time)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, plotHeight, width, bottomMargin);

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, plotHeight);
  ctx.lineTo(width, plotHeight);
  ctx.stroke();

  ctx.textAlign = 'center';
  footprintList.forEach((bar, idx) => {
    const barRightX = startX - (nBars - 1 - idx) * (barWidth + barSpacing);
    const barCenterX = barRightX + barWidth / 2;
    if (barCenterX >= 0 && barCenterX <= plotWidth) {
      const deltaVal = bar.delta || 0;
      const isDeltaPos = deltaVal >= 0;
      const timeStr = bar.datetime ? bar.datetime.split(' ')[1] || bar.datetime : '';

      // Line 1: Delta
      ctx.font = `bold ${Math.min(12, Math.max(9, Math.round(10.5 * zoom)))}px monospace`;
      ctx.fillStyle = isDeltaPos ? '#16a34a' : '#dc2626';
      const deltaText = `Δ ${deltaVal > 0 ? `+${deltaVal}` : deltaVal}`;
      ctx.fillText(deltaText, barCenterX, plotHeight + 16);

      // Line 2: Volume
      ctx.fillStyle = '#64748b';
      ctx.font = `${Math.min(10.5, Math.max(8, Math.round(9 * zoom)))}px monospace`;
      const volK = bar.volume ? (bar.volume >= 1000 ? `${(bar.volume / 1000).toFixed(1)}K` : Math.round(bar.volume)) : '---';
      ctx.fillText(`V: ${volK}`, barCenterX, plotHeight + 30);

      // Line 3: IST Time
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 9.5px monospace';
      ctx.fillText(timeStr, barCenterX, plotHeight + 46);
    }
  });
  }, [effectiveFootprint, symbol, timeframe, currentPrice, decimals, height, zoom, panX, panY, displayMode, mousePos]);

  // Request Animation Frame on state changes for 60 FPS fluid rendering
  useEffect(() => {
    const animId = requestAnimationFrame(drawChart);
    return () => cancelAnimationFrame(animId);
  }, [drawChart]);

  // Window and container ResizeObserver: instantly measures correct DOM dimensions on tab switch or orientation change
  useEffect(() => {
    drawChart();
    const handleResize = () => drawChart();
    window.addEventListener('resize', handleResize);

    const container = containerRef.current;
    let ro = null;
    if (container && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        drawChart();
      });
      ro.observe(container);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (ro) ro.disconnect();
    };
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
  const latestBar = effectiveFootprint && effectiveFootprint.length > 0 ? effectiveFootprint[effectiveFootprint.length - 1] : null;
  const latestDelta = latestBar?.delta ?? 0;
  const latestVol = latestBar?.volume ? Math.round(latestBar.volume).toLocaleString() : '---';

  return (
    <div
      ref={containerRef}
      className={`bg-white text-[#0D0D0C] border border-[#0D0D0C]/15 rounded-[7px] overflow-hidden flex flex-col transition-all shadow-[0_2px_12px_rgba(13,13,12,0.04)] font-sans ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none border-none' : 'relative'
      }`}
    >
      {/* 1. Footprint Header & Control Toolbar */}
      <div className="bg-white border-b border-[#0D0D0C]/12 px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 shrink-0">
        {/* Left: Title & Live Pill */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 font-semibold text-xs sm:text-sm tracking-tight text-[#0D0D0C] font-headline">
            <Flame className="w-4 h-4 text-[#E9C22E] fill-[#E9C22E] animate-pulse" />
            <span>XAUUSD (Gold Spot)</span>
          </div>

          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-[5px] bg-[#F4F4F5] text-[#0D0D0C] border border-[#0D0D0C]/12 uppercase font-mono">
            {timeframe} Footprint
          </span>

          <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-medium text-[#0D0D0C] bg-[#DFE9D4] px-2 py-0.5 rounded-[5px] border border-[#0D0D0C]/12 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3FB874] animate-ping"></span>
            ATAS ORDER FLOW (50ms Live)
          </span>
        </div>

        {/* Center: Timeframe Switcher */}
        {onSelectTimeframe && (
          <div className="flex items-center p-0.5 rounded-[5px] border border-[#0D0D0C]/12 bg-[#F4F4F5] text-xs font-medium">
            {['5m', '15m', '1h', '4h'].map((tf) => (
              <button
                key={tf}
                onClick={() => onSelectTimeframe(tf)}
                className={`px-2 py-0.5 rounded-[4px] transition duration-300 ${
                  timeframe.toLowerCase() === tf
                    ? 'bg-[#0D0D0C] text-white font-semibold'
                    : 'text-[#0D0D0C]/70 hover:text-[#0D0D0C]'
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
          <div className="flex items-center p-0.5 rounded-[5px] border border-[#0D0D0C]/12 bg-[#F4F4F5] text-[11px] font-medium">
            <button
              onClick={() => setDisplayMode('bid_ask')}
              className={`px-2 py-0.5 rounded-[4px] transition duration-300 ${
                displayMode === 'bid_ask'
                  ? 'bg-[#0D0D0C] text-white font-semibold'
                  : 'text-[#0D0D0C]/70 hover:text-[#0D0D0C]'
              }`}
              title="Show Bid x Ask Volume"
            >
              Bid × Ask
            </button>
            <button
              onClick={() => setDisplayMode('delta')}
              className={`px-2 py-0.5 rounded-[4px] transition duration-300 ${
                displayMode === 'delta'
                  ? 'bg-[#0D0D0C] text-white font-semibold'
                  : 'text-[#0D0D0C]/70 hover:text-[#0D0D0C]'
              }`}
              title="Show Cluster Net Delta"
            >
              Delta
            </button>
            <button
              onClick={() => setDisplayMode('volume')}
              className={`px-2 py-0.5 rounded-[4px] transition duration-300 ${
                displayMode === 'volume'
                  ? 'bg-[#0D0D0C] text-white font-semibold'
                  : 'text-[#0D0D0C]/70 hover:text-[#0D0D0C]'
              }`}
              title="Show Total Volume"
            >
              Volume
            </button>
          </div>

          {/* Zoom Buttons */}
          <div className="flex items-center gap-0.5 bg-[#F4F4F5] p-0.5 rounded-[5px] border border-[#0D0D0C]/12">
            <button
              onClick={handleZoomIn}
              className="w-7 h-7 flex items-center justify-center rounded-[4px] text-[#0D0D0C] hover:bg-white transition"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleZoomOut}
              className="w-7 h-7 flex items-center justify-center rounded-[4px] text-[#0D0D0C] hover:bg-white transition"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetView}
              className="px-1.5 h-7 flex items-center gap-1 rounded-[4px] text-[10px] font-semibold text-[#0D0D0C] hover:bg-white transition"
              title="Reset View"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>

          {/* Fullscreen Toggle */}
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className="p-1.5 rounded-[5px] border border-[#0D0D0C]/15 bg-[#F4F4F5] text-[#0D0D0C] hover:bg-[#0D0D0C] hover:text-white transition duration-300"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Footprint'}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Metric Ribbon */}
      <div className="bg-[#F4F4F5] border-b border-[#0D0D0C]/12 px-3 sm:px-5 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs font-mono w-full">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="text-[11px] text-[#0D0D0C]/56 font-sans">Active Candle:</span>
          <span className={`font-bold ${latestDelta >= 0 ? 'text-[#3FB874]' : 'text-[#F2772F]'}`}>
            Δ {latestDelta >= 0 ? `+${latestDelta}` : latestDelta}
          </span>
          <span className="text-[#0D0D0C]/25">|</span>
          <span className="text-[#0D0D0C]/75">Vol: <b className="text-[#0D0D0C]">{latestVol} lots</b></span>
          <span className="text-[#0D0D0C]/25">|</span>
          <span className="text-[#0D0D0C] font-semibold">⭐ POC Active</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[10px] font-sans text-[#0D0D0C]/60">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-[#F2772F]"></span> Bid (Sellers)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-[#3FB874]"></span> Ask (Buyers)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-[#E9C22E]"></span> POC Magnet
          </span>
        </div>
      </div>

      {/* 3. Interactive HTML5 Canvas (Touch action none for smooth pinch & drag) */}
      <div
        className="relative bg-white overflow-hidden select-none w-full max-w-full shrink-0"
        style={{
          height: isFullscreen ? 'calc(100vh - 110px)' : `${height}px`,
          minHeight: isFullscreen ? 'calc(100vh - 110px)' : `${height}px`,
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
