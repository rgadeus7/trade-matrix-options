# Vercel Deployment Guide

This is a **Next.js API** that gets excellent free tier benefits on Vercel.

## 🚀 Deploy to Vercel

### Option 1: Vercel CLI (Recommended)

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy from the project directory:**
   ```bash
   cd trade-matrix-options
   vercel
   ```

4. **Follow the prompts:**
   - Link to existing project? **No**
   - Project name: `trade-matrix-options` (or your preferred name)
   - Directory: `./` (current directory)
   - Framework: **Next.js** (auto-detected)
   - Override settings? **No**

### Option 2: GitHub Integration

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Add Vercel deployment config"
   git push origin main
   ```

2. **Connect to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Vercel will auto-detect the Node.js app

## ⚙️ Environment Variables

**Set these in Vercel Dashboard:**

1. Go to your project in Vercel Dashboard
2. Click "Settings" → "Environment Variables"
3. Add these variables:

```
TRADESTATION_CLIENT_ID=your_client_id
TRADESTATION_CLIENT_SECRET=your_client_secret
TRADESTATION_REFRESH_TOKEN=your_refresh_token
SYMBOLS=$SPX.X,$SPXW.X
NODE_ENV=production
```

## 📡 API Endpoints (After Deployment)

Your deployed API will be available at:
- `https://your-project-name.vercel.app/health`
- `https://your-project-name.vercel.app/api/collect-options`
- `https://your-project-name.vercel.app/api/collection-status`

## 🧪 Test Deployment

**Health Check:**
```bash
curl https://your-project-name.vercel.app/health
```

**Collect Options:**
```bash
curl -X POST https://your-project-name.vercel.app/api/collect-options \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": ["$SPX.X", "$SPXW.X"],
    "topRecords": 3,
    "streamDuration": 2000
  }'
```

## 📁 Project Structure

```
trade-matrix-options/
├── app/
│   ├── api/
│   │   ├── collect-options/
│   │   │   └── route.js      # Main API endpoint
│   │   ├── health/
│   │   │   └── route.js      # Health check
│   │   └── collection-status/
│   │       └── route.js      # Status endpoint
│   ├── layout.js             # Root layout
│   └── page.js               # Home page
├── simpleOptionsCollector.js # Collection logic
├── tokenManager.js           # Authentication
├── next.config.js           # Next.js configuration
├── package.json             # Dependencies
├── env.example              # Environment template
└── DEPLOYMENT.md            # This file
```

## 🔧 Next.js Configuration

The `next.config.js` file configures:
- **App Directory:** Uses the new App Router
- **Environment Variables:** Passes through custom env vars
- **Auto-optimization:** Next.js handles all optimizations

## ⚠️ Important Notes

1. **Serverless Functions:** Vercel runs this as serverless functions
2. **Timeout Limits:** Vercel has execution time limits (10s for hobby, 60s for pro)
3. **Environment Variables:** Must be set in Vercel dashboard
4. **No File System:** Can't write files in serverless environment (we removed this)

## 🚀 Production vs Development

- **Development:** `npm run dev` (runs on localhost:3000)
- **Production:** Deployed to Vercel's serverless platform
- **Environment:** Automatically detected by Next.js

## 📊 Monitoring

- **Vercel Dashboard:** View deployments, logs, and analytics
- **Function Logs:** Check execution logs in Vercel dashboard
- **Performance:** Monitor response times and errors
