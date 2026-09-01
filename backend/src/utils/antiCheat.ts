import { StepLog } from '../types';

export interface FraudRulesConfig {
  maxCadencePerMinute: number;
  maxBatchSpikeSteps: number;
  rapidSyncWindowSeconds: number;
  suspectAction: 'flag' | 'freeze' | 'ban';
}

let activeFraudRules: FraudRulesConfig = {
  maxCadencePerMinute: 260,
  maxBatchSpikeSteps: 15000,
  rapidSyncWindowSeconds: 60,
  suspectAction: 'flag',
};

export function getFraudRules(): FraudRulesConfig {
  return activeFraudRules;
}

export function updateFraudRules(newRules: Partial<FraudRulesConfig>): FraudRulesConfig {
  activeFraudRules = { ...activeFraudRules, ...newRules };
  return activeFraudRules;
}

export interface FraudAnalysisResult {
  isSuspicious: boolean;
  fraudScoreDelta: number;
  reasons: string[];
}

export function evaluateStepLogFraud(stepLog: StepLog, lastLog?: StepLog): FraudAnalysisResult {
  const reasons: string[] = [];
  let scoreDelta = 0;

  // 1. Cadence / Velocity Check
  if (stepLog.activeMinutes > 0) {
    const stepsPerMinute = stepLog.count / stepLog.activeMinutes;
    if (stepsPerMinute > activeFraudRules.maxCadencePerMinute) {
      scoreDelta += 40;
      reasons.push(`Unrealistic step cadence detected: ${Math.round(stepsPerMinute)} steps/min (Max limit: ${activeFraudRules.maxCadencePerMinute})`);
    }
  }

  // 2. Single Batch Step Spike Check
  if (stepLog.count > activeFraudRules.maxBatchSpikeSteps && stepLog.activeMinutes < 30) {
    scoreDelta += 50;
    reasons.push(`Excessive step spike: ${stepLog.count.toLocaleString()} steps exceeds single batch limit of ${activeFraudRules.maxBatchSpikeSteps.toLocaleString()}`);
  }

  // 3. Duplicate / Rapid Consecutive Logs Check
  if (lastLog) {
    const prevTime = new Date(lastLog.timestamp).getTime();
    const currTime = new Date(stepLog.timestamp).getTime();
    const diffSeconds = (currTime - prevTime) / 1000;

    if (diffSeconds < activeFraudRules.rapidSyncWindowSeconds && stepLog.count > 3000) {
      scoreDelta += 30;
      reasons.push(`Rapid sync detected within ${Math.round(diffSeconds)}s (Min window: ${activeFraudRules.rapidSyncWindowSeconds}s)`);
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
