import { Router, Response } from 'express';
import { supabase } from '../database/supabase';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { evaluateStepLogFraud } from '../utils/antiCheat';

const router = Router();

// POST /api/v1/steps/sync
router.post('/sync', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { steps, source } = req.body; // Array of step payloads

  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!Array.isArray(steps) || steps.length === 0) {
      return res.status(400).json({ error: 'Payload must include an array of step items' });
    }

    // Get the user's last step log for speed-based anti-cheat check
    const { data: lastLogs } = await supabase
      .from('step_logs')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(1);

    const lastLog = lastLogs && lastLogs.length > 0 ? {
      id: lastLogs[0].id,
      userId: lastLogs[0].user_id,
      timestamp: lastLogs[0].timestamp,
      date: lastLogs[0].date,
      count: lastLogs[0].count,
      distanceMeters: lastLogs[0].distance_meters,
      calories: lastLogs[0].calories,
      activeMinutes: lastLogs[0].active_minutes,
      source: lastLogs[0].source,
      isFlagged: lastLogs[0].is_flagged
    } : null;

    let totalNewSteps = 0;
    let totalNewDistance = 0;
    let totalNewCalories = 0;
    let totalNewActiveMinutes = 0;
    const flaggedReasons: string[] = [];
    let currentFraudScore = user.fraud_score;

    const todayStr = new Date().toISOString().split('T')[0];
    const logsToInsert = [];

    for (const item of steps) {
      const stepLog = {
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
      const fraudEval = evaluateStepLogFraud(stepLog as any, lastLog as any);

      if (fraudEval.isSuspicious) {
        stepLog.isFlagged = true;
        currentFraudScore = Math.min(100, currentFraudScore + fraudEval.fraudScoreDelta);
        flaggedReasons.push(...fraudEval.reasons);
      } else {
        totalNewSteps += stepLog.count;
        totalNewDistance += stepLog.distanceMeters;
        totalNewCalories += stepLog.calories;
        totalNewActiveMinutes += stepLog.activeMinutes;
      }

      logsToInsert.push({
        id: stepLog.id,
        user_id: stepLog.userId,
        timestamp: stepLog.timestamp,
        date: stepLog.date,
        count: stepLog.count,
        distance_meters: stepLog.distanceMeters,
        calories: stepLog.calories,
        active_minutes: stepLog.activeMinutes,
        source: stepLog.source,
        is_flagged: stepLog.isFlagged,
      });
    }

    if (logsToInsert.length > 0) {
      const { error: insertLogsError } = await supabase
        .from('step_logs')
        .insert(logsToInsert);
      if (insertLogsError) {
        console.error(insertLogsError);
        return res.status(500).json({ error: 'Failed to save step logs' });
      }
    }

    // Update Daily Summary
    const { data: todaySummary, error: summaryFetchError } = await supabase
      .from('daily_summaries')
      .select('*')
      .eq('user_id', userId)
      .eq('date', todayStr)
      .maybeSingle();

    if (summaryFetchError) console.error(summaryFetchError);

    let updatedSteps = (todaySummary?.total_steps || 0) + totalNewSteps;
    let updatedDistance = (todaySummary?.total_distance_meters || 0) + totalNewDistance;
    let updatedCalories = (todaySummary?.total_calories || 0) + totalNewCalories;
    let updatedActiveMins = (todaySummary?.total_active_minutes || 0) + totalNewActiveMinutes;
    let goalMet = updatedSteps >= user.daily_step_goal;

    if (todaySummary) {
      await supabase
        .from('daily_summaries')
        .update({
          total_steps: updatedSteps,
          total_distance_meters: updatedDistance,
          total_calories: updatedCalories,
          total_active_minutes: updatedActiveMins,
          goal_met: goalMet,
        })
        .eq('user_id', userId)
        .eq('date', todayStr);
    } else {
      await supabase
        .from('daily_summaries')
        .insert([{
          user_id: userId,
          date: todayStr,
          total_steps: updatedSteps,
          total_distance_meters: updatedDistance,
          total_calories: updatedCalories,
          total_active_minutes: updatedActiveMins,
          goal_met: goalMet,
        }]);
    }

    // Update User Lifetime Metrics & WalkCoins
    let newWalkCoins = user.walk_coins;
    let streakCount = user.current_streak;

    // Check if goal was met just now to reward coins
    if (goalMet && (!todaySummary || !todaySummary.goal_met)) {
      newWalkCoins += 20; // 20 WalkCoins per goal met
    }

    const { error: userUpdateError } = await supabase
      .from('users')
      .update({
        lifetime_steps: user.lifetime_steps + totalNewSteps,
        walk_coins: newWalkCoins,
        fraud_score: currentFraudScore,
      })
      .eq('id', userId);

    if (userUpdateError) console.error(userUpdateError);

    return res.json({
      message: 'Steps synced successfully',
      syncedSteps: totalNewSteps,
      todaySummary: {
        userId,
        date: todayStr,
        totalSteps: updatedSteps,
        totalDistanceMeters: updatedDistance,
        totalCalories: updatedCalories,
        totalActiveMinutes: updatedActiveMins,
        goalMet,
      },
      fraudScore: currentFraudScore,
      flagged: flaggedReasons.length > 0,
      flaggedReasons,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error syncing steps' });
  }
});

// GET /api/v1/steps/today
router.get('/today', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const todayStr = new Date().toISOString().split('T')[0];

  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('daily_step_goal, current_streak')
      .eq('id', userId)
      .maybeSingle();

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { data: todaySummary } = await supabase
      .from('daily_summaries')
      .select('*')
      .eq('user_id', userId)
      .eq('date', todayStr)
      .maybeSingle();

    const resultSummary = todaySummary ? {
      userId: todaySummary.user_id,
      date: todaySummary.date,
      totalSteps: todaySummary.total_steps,
      totalDistanceMeters: todaySummary.total_distance_meters,
      totalCalories: todaySummary.total_calories,
      totalActiveMinutes: todaySummary.total_active_minutes,
      goalMet: todaySummary.goal_met,
    } : {
      userId,
      date: todayStr,
      totalSteps: 0,
      totalDistanceMeters: 0,
      totalCalories: 0,
      totalActiveMinutes: 0,
      goalMet: false,
    };

    const dailyGoal = user.daily_step_goal || 10000;
    const completionPercentage = Math.min(100, Math.round((resultSummary.totalSteps / dailyGoal) * 100));

    return res.json({
      summary: resultSummary,
      dailyGoal,
      completionPercentage,
      streakDays: user.current_streak || 1,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error fetching today activity' });
  }
});

export default router;
