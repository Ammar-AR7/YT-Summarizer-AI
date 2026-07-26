/**
 * Server Entry Point — نقطة الدخول الرئيسية للخادم
 * 
 * يربط جميع الـ Routes, Middleware, والخدمات في Express app واحد.
 * يُصدَّر كـ default export لاستخدامه في api/index.ts (Vercel) وللتشغيل المحلي.
 */
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import fs from 'fs';

import helmet from 'helmet';

// Routes
import videoRoutes from './routes/videoRoutes.js';
import authRoutes from './routes/authRoutes.js';
import exportRoutes from './routes/exportRoutes.js';
import trialRoutes from './routes/trialRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import telegramRoutes from './routes/telegramRoutes.js';

// Middleware
import { generalLimiter } from './middleware/rateLimiter.js';


// Telegram (only if BOT_TOKEN is available)
// import { startTelegramPolling } from './services/telegramPolling.js';

export const app = express();
const PORT = process.env.PORT || 3000;

// ========== Global Middleware ==========
app.use(helmet({ contentSecurityPolicy: false })); // Use Helmet with CSP disabled for inline styles compatibility
app.use(express.json());

// Request logging (development)
app.use((req, _res, next) => {
  console.log(`[${req.method}] ${req.url}`);
  next();
});

// Rate limiting on all API routes
app.use('/api/', generalLimiter);


// CORS headers for separated Frontend/Backend deployment
app.use((req, res, next) => {
  const allowedOrigins = [
    process.env.FRONTEND_URL || '',
    'http://localhost:5173',
    'http://localhost:3000'
  ].filter(Boolean);

  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Global base URL tracker for Telegram login links
let globalLastKnownBaseUrl = process.env.APP_URL || '';
app.use((req, _res, next) => {
  const host = req.get('host');
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    const derived = `${proto}://${host}`;
    if (globalLastKnownBaseUrl !== derived) {
      globalLastKnownBaseUrl = derived;
    }
  }
  next();
});

// Make baseUrl accessible to routes that need it
app.set('getBaseUrl', () => globalLastKnownBaseUrl);

// ========== API Routes ==========
app.use('/api', healthRoutes);
app.use('/api', videoRoutes);
app.use('/api', authRoutes);
app.use('/api', exportRoutes);
app.use('/api', trialRoutes);
app.use('/api', telegramRoutes);


// Telegram bot info endpoint (simple, doesn't need a separate file)
app.get('/api/telegram-bot-info', async (_req, res): Promise<any> => {
  const { getBotInfo } = await import('./helpers/telegramHelpers.js');
  const info = await getBotInfo();
  if (info.success) {
    return res.json({
      success: true,
      botUsername: info.username,
      botName: info.name,
      botUrl: `https://t.me/${info.username}`
    });
  }
  return res.json({ success: false, error: info.error });
});

// ========== Static File Serving (Production) ==========
const resolvedDirname = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
const distPath = path.resolve(resolvedDirname, '..', 'dist');

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ========== Server Start (Local / Render) ==========
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;

if (!isVercel) {
  app.listen(PORT, () => {
    console.log(`\n🚀 YT-Summarizer-AI Server running on http://localhost:${PORT}`);
    console.log(`📡 API Base: http://localhost:${PORT}/api`);
    console.log(`❤️  Health: http://localhost:${PORT}/api/health\n`);

    // Start Telegram Long Polling if token is available (only on persistent servers)
    if (process.env.TELEGRAM_BOT_TOKEN) {
      console.log('🤖 Telegram bot token found. Long polling will be available.');
      // TODO: Import and start telegramPolling when telegram module is fully migrated
    }
  });
}

export default app;
