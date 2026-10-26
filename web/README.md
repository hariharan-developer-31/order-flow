# TRADING BOY Order Flow, Volume Profile & Footprint Terminal

A modern, institutional **White Theme** web terminal for live Order Flow, Volume Profile, Footprint Delta, and Telegram Signals.

## Features
- **Pristine White Theme**: High-contrast institutional layout with clean slate typography.
- **TradingView Lightweight Charts**: Smooth 60 FPS 1H Candlesticks & Volume Histogram.
- **Dynamic Order Flow Overlays**: Live Point of Control (POC in Gold), 70% Value Area (VAH/VAL in Blue), and Liquidity Bounds (PDH/PDL).
- **Interactive Footprint Chart**: Bid × Ask volume per price level, Delta, Cumulative Volume Delta (CVD), and 300% Stacked Imbalance badges (Green/Red).
- **Horizontal Volume Profile**: 24-hour finished auction depth ladder.
- **Live Telegram Signals**: Real-time MT5 twin-order tickets (Order A 1:1, Order B 1:2) with one-click copy.
- **5 Major Instruments**: XAUUSD (Gold), EURUSD, GBPUSD, AUDUSD, USDCAD.

## Quick Start (Local Development)

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 1-Click Deployment to Vercel

1. Push this folder to a GitHub repository (e.g. `order-flow-terminal` or inside your repo).
2. Go to [vercel.com](https://vercel.com) &rarr; Click **Add New...** &rarr; **Project**.
3. Select the repository.
4. If this `web` folder is inside a parent repo, set the **Root Directory** to `web`.
5. Vercel will automatically detect `vite` (via `vercel.json`).
6. Click **Deploy**. Your terminal will be live at `https://<your-project>.vercel.app`!
