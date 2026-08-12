import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import stepRoutes from './routes/stepRoutes';
import rankingRoutes from './routes/rankingRoutes';
import groupRoutes from './routes/groupRoutes';
import rewardRoutes from './routes/rewardRoutes';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Healthcheck Route
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'UP', service: 'WalkVerse-Backend', timestamp: new Date().toISOString() });
});

// API V1 Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/steps', stepRoutes);
app.use('/api/v1/rankings', rankingRoutes);
app.use('/api/v1/groups', groupRoutes);
app.use('/api/v1/rewards', rewardRoutes);

// 404 Handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global Error Handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[SERVER ERROR]', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

export default app;
