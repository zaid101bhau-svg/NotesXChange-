import http from 'node:http';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { ensureStorageDirs, PUBLIC_UPLOAD_DIR } from './server/storage.ts';
import { ensureCbseClass6And7Pdfs } from './server/cbseLibrary.ts';
import { attachChatWebSocketServer } from './server/chatWs.ts';
import marketplaceRouter from './server/routes/marketplace.ts';
import paymentsRouter from './server/routes/payments.ts';
import adminRouter from './server/routes/admin.ts';
import supportRouter from './server/routes/support.ts';
import chatRouter from './server/routes/chat.ts';

dotenv.config();
ensureStorageDirs();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === 'production';

// Capture raw body for Razorpay webhook HMAC verification while parsing JSON
app.use(
  express.json({
    limit: '2mb',
    verify: (req: express.Request & { rawBody?: Buffer }, _res, buf) => {
      if (req.originalUrl.startsWith('/api/payments/webhook')) {
        req.rawBody = buf;
      }
    },
  })
);
app.use(express.urlencoded({ extended: true }));

// Serve validated uploaded images (avatars, covers, feedback screenshots) securely
app.use(
  '/api/uploads',
  express.static(PUBLIC_UPLOAD_DIR, {
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=86400');
    },
  })
);

// Serve static editorial cover & hero images in both dev and production
app.use(
  '/src/assets/images',
  express.static(path.resolve(process.cwd(), 'src/assets/images'), {
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=604800');
    },
  })
);

// Health endpoint
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'note-xchange', timestamp: new Date().toISOString() });
});

// Mount API routes
app.use('/api', marketplaceRouter);
app.use('/api', paymentsRouter);
app.use('/api', supportRouter);
app.use('/api', chatRouter);
app.use('/api/admin', adminRouter);

async function startServer() {
  await ensureCbseClass6And7Pdfs();
  const server = http.createServer(app);
  attachChatWebSocketServer(server);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use('/api', (_req, res) => {
      res.status(404).json({ error: 'API endpoint not found.' });
    });
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`NOTE XCHANGE server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start NOTE XCHANGE server:', err);
  process.exit(1);
});
