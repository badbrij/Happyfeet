import { Router, Response } from 'express';
import { db } from '../database/store';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { StepLog, DailySummary } from '../types';
import { evaluateStepLogFraud } from '../utils/antiCheat';

const router = Router();

// POST /api/v1/steps/sync
router.post('/sync', authMiddleware, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { steps, source } = req.body; // Array of step payloads

  const user = db.users.get(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (!Array.isArray(steps) || steps.length === 0) {
    return res.status(400).json({ error: 'Payload must include an array of step items' });
  }

  let totalNewSteps = 0;
  let totalNewDistance = 0;
  let totalNewCalories = 0;
  let totalNewActiveMinutes = 0;
  const flaggedReasons: string[] = [];

  const todayStr = new Date().toISOString().split('T')[0];

  for (const item of steps) {
    const stepLog: StepLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      userId,
      timestamp: item.timestamp || new Date().toISOString(),
      date: item.date || todayStr,
      count: Number(item.count) || 0,
      distanceMeters: Number(item.distanceMeters) || 0,
      calories: Number(item.calories) || 0,
      activeMinutes: Number(item.activeMinutes) || 0,
      source: source || 'AppleHealthKit',
      isFlagged: false,
    };

    // Run Anti-Fraud Evaluation
    const lastLog = db.stepLogs[db.stepLogs.length - 1];
    const fraudEval = evaluateStepLogFraud(stepLog, lastLog);

    if (fraudEval.isSuspicious) {
      stepLog.isFlagged = true;
      user.fraudScore = Math.min(100, user.fraudScore + fraudEval.fraudScoreDelta);
      flaggedReasons.push(...fraudEval.reasons);
    } else {
      totalNewSteps += stepLog.count;
      totalNewDistance += stepLog.distanceMeters;
      totalNewCalories += stepLog.calories;
      totalNewActiveMinutes += stepLog.activeMinutes;
    }

    db.stepLogs.push(stepLog);
  }

  // Update Daily Summary
  let userSummaries = db.dailySummaries.get(userId) || [];
  let todaySummary = userSummaries.find((s) => s.date === todayStr);

  if (!todaySummary) {
    todaySummary = {
      userId,
      date: todayStr,
      totalSteps: 0,
      totalDistanceMeters: 0,
      totalCalories: 0,
      totalActiveMinutes: 0,
      goalMet: false,
    };
    userSummaries.unshift(todaySummary);
  }

  todaySummary.totalSteps += totalNewSteps;
  todaySummary.totalDistanceMeters += totalNewDistance;
  todaySummary.totalCalories += totalNewCalories;
  todaySummary.totalActiveMinutes += totalNewActiveMinutes;
  todaySummary.goalMet = todaySummary.totalSteps >= user.healthProfile.dailyStepGoal;

  db.dailySummaries.set(userId, userSummaries);

  // Update User Lifetime Metrics & WalkCoins
  user.lifetimeSteps += totalNewSteps;
  if (todaySummary.goalMet) {
    user.walkCoins += 20; // 20 WalkCoins per goal met
  }

  return res.json({
    message: 'Steps synced successfully',
    syncedSteps: totalNewSteps,
    todaySummary,
    fraudScore: user.fraudScore,
    flagged: flaggedReasons.length > 0,
    flaggedReasons,
  });
});

// GET /api/v1/steps/today
router.get('/today', authMiddleware, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const user = db.users.get(userId);
  const todayStr = new Date().toISOString().split('T')[0];
  const userSummaries = db.dailySummaries.get(userId) || [];
  const todaySummary = userSummaries.find((s) => s.date === todayStr) || {
    userId,
    date: todayStr,
    totalSteps: 0,
    totalDistanceMeters: 0,
    totalCalories: 0,
    totalActiveMinutes: 0,
    goalMet: false,
  };

  return res.json({
    summary: todaySummary,
    dailyGoal: user?.healthProfile.dailyStepGoal || 10000,
    completionPercentage: Math.min(100, Math.round((todaySummary.totalSteps / (user?.healthProfile.dailyStepGoal || 10000)) * 100)),
    streakDays: user?.currentStreak || 1,
  });
});

export default router;
