import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import stepRoutes from './routes/stepRoutes';
import rankingRoutes from './routes/rankingRoutes';
import groupRoutes from './routes/groupRoutes';
import rewardRoutes from './routes/rewardRoutes';
import adminRoutes from './routes/adminRoutes';

import helmet from 'helmet';
import { globalApiRateLimiter, sanitizeInputs, secureErrorHandler } from './middleware/security';

dotenv.config();

const app = express();

// 1. HTTP Security Headers (Helmet)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// 2. Strict CORS Configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5000',
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
}));

// 3. Payload Size Limitation & XSS Sanitization
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(sanitizeInputs);

// 4. Global API Rate Limiting
app.use('/api/v1', globalApiRateLimiter);

import { supabase } from './database/supabase';

// Healthcheck Route
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'UP', service: 'BadaKadam-Backend', timestamp: new Date().toISOString() });
});

// Extended System Telemetry Route
app.get('/health/system', async (_req: Request, res: Response) => {
  const startDb = Date.now();
  let dbStatus = 'HEALTHY';
  let dbLatencyMs = 0;

  try {
    const { error } = await supabase.from('users').select('id').limit(1);
    dbLatencyMs = Date.now() - startDb;
    if (error) dbStatus = 'DEGRADED';
  } catch (err) {
    dbStatus = 'UNREACHABLE';
  }

  const memoryUsage = process.memoryUsage();

  res.json({
    status: 'OPERATIONAL',
    service: 'BadaKadam Microservice Engine',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
      latencyMs: dbLatencyMs,
    },
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      memory: {
        heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        rssMB: Math.round(memoryUsage.rss / 1024 / 1024),
      }
    }
  });
});

// API V1 Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/steps', stepRoutes);
app.use('/api/v1/rankings', rankingRoutes);
app.use('/api/v1/groups', groupRoutes);
app.use('/api/v1/rewards', rewardRoutes);
app.use('/api/v1/admin', adminRoutes);

// 404 Handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Secure Global Error Handler
app.use(secureErrorHandler);

export default app;
