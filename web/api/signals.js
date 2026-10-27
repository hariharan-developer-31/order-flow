import { fetchLiveSignals } from './_lib/market.js';

let sharedSignalsState = null;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Handle incoming POST from Telegram Cloud Bot or Terminal Sync
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (body) {
        sharedSignalsState = {
          ...body,
          timestamp: Math.floor(Date.now() / 1000),
        };
        return res.status(200).json({ ok: true, synced: true, trades_count: sharedSignalsState.trades_count });
      }
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  }

  // 1. Try proxying to external Render backend if configured
  const backendUrl = process.env.BACKEND_API_URL || process.env.RENDER_EXTERNAL_URL;
  if (backendUrl) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const r = await fetch(`${backendUrl.replace(/\/+$/, '')}/api/signals`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (r.ok) {
        const liveFromBackend = await r.json();
        return res.status(200).json(liveFromBackend);
      }
    } catch (e) {
      // Backend temporarily unreachable, fallback to memory / evaluated
    }
  }

  // 2. Return memory-synced state if an active trade was posted
  if (sharedSignalsState && sharedSignalsState.active_trades?.length > 0) {
    return res.status(200).json(sharedSignalsState);
  }

  // 3. Fallback to active evaluated signal
  const data = fetchLiveSignals();
  res.status(200).json(data);
}
