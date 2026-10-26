# 24/7 Autonomous Cloud Trading Bot for FundingPips $5,000

Runs 24/7/365 on free cloud infrastructure (Render, Railway, Fly.io).
Pushes instant execution tickets directly to your Telegram phone app.

## Features
- **100% Free**: Zero hosting costs.
- **Laptop Independence**: Runs in the cloud even when your PC is completely turned off.
- **5 Core Confluences**: Triple EMA + Breakout + Volume Surge + Clean Wick + RSI.
- **Elite 5 Basket**: XAUUSD, EURUSD, GBPUSD, AUDUSD, USDCAD.
- **Twin-Order Sizing**: Sized for $45.00 risk (Target: +$80 to +$100/day profit).
- **Built-in Health Check**: Keeps the free cloud worker alive 24/7.

## Deployment to Render.com (100% Free)

### Step 1: Create a New GitHub Repository
1. Go to [github.com/new](https://github.com/new)
2. Enter your chosen repository name (e.g. `fundingpips-cloud-trader`)
3. Click **Create repository**

### Step 2: Push This Folder to Your New GitHub Repo
Run these commands in PowerShell or Terminal inside `cloud_bot`:
```bash
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPOSITORY_NAME.git
git branch -M main
git push -u origin main
```

### Step 3: Deploy on Render.com
1. Go to [dashboard.render.com](https://dashboard.render.com) and log in.
2. Click **New +** (top right) and select **Web Service** (or **Blueprint**).
3. Connect your new GitHub repository.
4. Set your Environment Variables in the Render dashboard:
   - `TELEGRAM_BOT_TOKEN`: Your new bot token from `@BotFather`
   - `TELEGRAM_CHAT_ID`: Your Telegram numeric chat ID
   - `RENDER_EXTERNAL_URL`: Your Render service URL (e.g. `https://<service-name>.onrender.com`)
   - `TARGET_RISK_PER_TRADE`: `45.0`
5. Click **Deploy Web Service** (Select the Free Plan).
6. Your cloud bot is now live 24/7!
