import { StepLog } from '../types';

export interface FraudAnalysisResult {
  isSuspicious: boolean;
  fraudScoreDelta: number;
  reasons: string[];
}

export function evaluateStepLogFraud(stepLog: StepLog, lastLog?: StepLog): FraudAnalysisResult {
  const reasons: string[] = [];
  let scoreDelta = 0;

  // 1. Cadence / Velocity Check (Human maximum cadence ~ 250 steps/min or ~ 4.1 steps/sec)
  // Check if step count is unrealistically high for active minutes
  if (stepLog.activeMinutes > 0) {
    const stepsPerMinute = stepLog.count / stepLog.activeMinutes;
    if (stepsPerMinute > 260) {
      scoreDelta += 40;
      reasons.push(`Unrealistic step cadence detected: ${Math.round(stepsPerMinute)} steps/minute`);
    }
  }

  // 2. Single Batch Step Spike Check (e.g. > 15,000 steps in 5 minutes)
  if (stepLog.count > 15000 && stepLog.activeMinutes < 30) {
    scoreDelta += 50;
    reasons.push('Excessive step spike in a short duration');
  }

  // 3. Duplicate / Rapid Consecutive Logs Check
  if (lastLog) {
    const prevTime = new Date(lastLog.timestamp).getTime();
    const currTime = new Date(stepLog.timestamp).getTime();
    const diffSeconds = (currTime - prevTime) / 1000;

    if (diffSeconds < 60 && stepLog.count > 3000) {
      scoreDelta += 30;
      reasons.push('Rapid consecutive high-volume step payload');
    }
  }

  // 4. Stride length / Distance anomaly
  if (stepLog.count > 0 && stepLog.distanceMeters > 0) {
    const strideLengthMeters = stepLog.distanceMeters / stepLog.count;
    if (strideLengthMeters > 2.5 || strideLengthMeters < 0.2) {
      scoreDelta += 20;
      reasons.push(`Abnormal stride length: ${strideLengthMeters.toFixed(2)}m per step`);
    }
  }

  return {
    isSuspicious: scoreDelta >= 30,
    fraudScoreDelta: scoreDelta,
    reasons,
  };
}
