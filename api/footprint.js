import { fetchLiveFootprint } from './_lib/market.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { symbol = 'XAUUSD', timeframe = '1h', limit = '12' } = req.query;

  try {
    const data = await fetchLiveFootprint(symbol, timeframe, parseInt(limit, 10) || 12);
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
