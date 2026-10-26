# TRADING BOY AI TRADING ENGINE

24/7 Autonomous Cloud Trading Bot for TRADING BOY ACCOUNT (Elite 5: XAUUSD, EURUSD, GBPUSD, AUDUSD, USDCAD).

Runs 24/7/365 on free cloud infrastructure (Render, Railway, Fly.io).
Pushes instant execution tickets directly to your Telegram phone app.

## Features
- **100% Free**: Zero hosting costs.
- **Laptop Independence**: Runs in the cloud even when your PC is completely turned off.
- **5 Core Confluences**: Triple EMA + Breakout + Volume Surge + Clean Wick + RSI.
- **Elite 5 Basket**: XAUUSD, EURUSD, GBPUSD, AUDUSD, USDCAD.
- **Risk Management**: Risk 1.0% per trade, Max 3 trades/day, Unlimited daily target.
- **Order Flow Engine**: Active (Volume Profile, POC & 70% Value Area).
- **Built-in Health Check**: Keeps the free cloud worker alive 24/7.

## Deployment to Render.com (100% Free)

### Step 1: Push Code to GitHub
```bash
git add .
git commit -m "feat: customize branding for TRADING BOY AI TRADING ENGINE"
git push origin main
```

### Step 2: Deploy on Render.com
1. Go to [dashboard.render.com](https://dashboard.render.com) and log in.
2. Click **New +** &rarr; select **Web Service**.
3. Connect your repository: `hariharan-developer-31/order-flow`.
4. Set your Environment Variables in the Render dashboard:
   - `TELEGRAM_BOT_TOKEN`: Your bot token from `@BotFather`
   - `TELEGRAM_CHAT_ID`: Your Telegram numeric chat ID
   - `RENDER_EXTERNAL_URL`: Your Render service URL (e.g. `https://<service-name>.onrender.com`)
   - `TARGET_RISK_PER_TRADE`: `45.0`
5. Click **Deploy Web Service** (Select Free Plan).
6. Your cloud bot is now live 24/7!
