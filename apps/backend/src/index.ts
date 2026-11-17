import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { catalogRouter } from './modules/catalog/routes.js';
import { cartRouter } from './modules/cart/routes.js';
import { inventoryRouter } from './modules/inventory/routes.js';
import { ordersRouter } from './modules/orders/routes.js';
import { paymentsRouter } from './modules/payments/routes.js';
import { marketplaceRouter } from './modules/marketplace/routes.js';
import { b2bRouter } from './modules/b2b/routes.js';
import { i18nRouter } from './modules/i18n/routes.js';
import { aiRouter } from './modules/ai/routes.js';
import { adminRouter } from './modules/admin/routes.js';
import { securityHeadersMiddleware, createRateLimiter } from './middleware/security.js';

const app = express();

// OWASP Security Headers
app.use(securityHeadersMiddleware);

// Security & Parsing Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: [config.cors.storefront, config.cors.admin, 'http://localhost:3000'],
    credentials: true,
  })
);

// Request Logger (Development)
app.use((req: Request, _res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// ----------------------------------------------------------------------------
// API Routes
// ----------------------------------------------------------------------------
app.use('/api/v1', catalogRouter);
app.use('/api/v1', cartRouter);
app.use('/api/v1', inventoryRouter);
app.use('/api/v1', ordersRouter);
app.use('/api/v1', paymentsRouter);
app.use('/api/v1', marketplaceRouter);
app.use('/api/v1', b2bRouter);
app.use('/api/v1', i18nRouter);
app.use('/api/v1', aiRouter);
app.use('/api/v1', adminRouter);

// Strict Rate-Limited Test Route (5 requests / 10 seconds)
const strictTestLimiter = createRateLimiter({
  windowMs: 10 * 1000,
  maxRequests: 5,
  message: 'Security Alert: Rate limit threshold exceeded. Action temporarily throttled.',
});

app.get('/api/v1/security/rate-limit-test', strictTestLimiter, (_req: Request, res: Response) => {
  res.status(200).json({ success: true, message: 'Request within safe threshold.' });
});

// ----------------------------------------------------------------------------
// Health Probes
// ----------------------------------------------------------------------------
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '0.1.0',
    service: 'NexStore Commerce Engine',
  });
});

app.get('/ready', (_req: Request, res: Response) => {
  // In Phase 2/4 this verifies DB and Redis connection pool readiness
  res.status(200).json({
    ready: true,
    db: 'connected',
    cache: 'ready',
  });
});

// ----------------------------------------------------------------------------
// Root & Information Route
// ----------------------------------------------------------------------------
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    message: 'Universal Commerce Engine API is active',
    documentation: '/docs',
    endpoints: {
      health: '/health',
      ready: '/ready',
      catalog: '/api/v1/catalog (Phase 2)',
      cart: '/api/v1/cart (Phase 3)',
      orders: '/api/v1/orders (Phase 4)',
      payments: '/api/v1/payments (Phase 5)',
    },
  });
});

// ----------------------------------------------------------------------------
// Central Error Handler
// ----------------------------------------------------------------------------
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled Application Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: {
      message: err.message || 'Internal Server Error',
      code: err.code || 'INTERNAL_SERVER_ERROR',
    },
  });
});

// Start Server
const server = app.listen(config.port, () => {
  console.log(`=======================================================`);
  console.log(`🚀 NexStore Commerce Engine running on port ${config.port}`);
  console.log(`🌐 Health check: http://localhost:${config.port}/health`);
  console.log(`📦 Environment:  ${config.env}`);
  console.log(`=======================================================`);
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
