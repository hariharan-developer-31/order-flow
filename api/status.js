export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  res.status(200).json({
    engine: 'TRADING BOY AI 24/7 Cloud Engine',
    status: 'online',
    time_utc: new Date().toISOString(),
    risk_per_trade: '1.0%',
    daily_target: 'Unlimited',
    active_trades_count: 2,
    instruments: ['XAUUSD', 'EURUSD', 'GBPUSD', 'AUDUSD', 'USDCAD'],
    server: 'Vercel Edge Cloud',
  });
}
