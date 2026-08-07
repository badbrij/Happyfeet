import { AgeGroup, BMICategory, ActivityTier } from '../types';

export function calculateAge(dob: string): number {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export function getAgeGroup(age: number): AgeGroup {
  if (age <= 24) return 'Gen Z (18-24)';
  if (age <= 34) return 'Young Adult (25-34)';
  if (age <= 44) return 'Mid Career (35-44)';
  if (age <= 54) return 'Mature Adult (45-54)';
  if (age <= 64) return 'Senior Active (55-64)';
  return 'Veteran (65+)';
}

export function calculateBMI(heightCm: number, weightKg: number): { bmi: number; category: BMICategory } {
  const heightM = heightCm / 100;
  const bmi = parseFloat((weightKg / (heightM * heightM)).toFixed(1));
  let category: BMICategory = 'Normal';
  if (bmi < 18.5) category = 'Underweight';
  else if (bmi < 25) category = 'Normal';
  else if (bmi < 30) category = 'Overweight';
  else category = 'Obese';

  return { bmi, category };
}

export function getActivityTier(avgSteps: number): ActivityTier {
  if (avgSteps < 5000) return 'Beginner (0-5k)';
  if (avgSteps < 10000) return 'Moderate (5k-10k)';
  if (avgSteps < 15000) return 'Advanced (10k-15k)';
  return 'Elite (15k+)';
}

export function computeFitnessScore(
  goalAchievementPercent: number,
  consistencyPercent: number,
  improvementPercent: number,
  streakDays: number
): number {
  // Weighting formula:
  // 40% Goal Completion + 20% Consistency + 20% Improvement + 20% Streak factor
  const streakScore = Math.min(streakDays * 5, 100);
  const score = 
    (Math.min(goalAchievementPercent, 150) * 0.4) +
    (consistencyPercent * 0.2) +
    (Math.min(improvementPercent, 100) * 0.2) +
    (streakScore * 0.2);

  return Math.round(score * 10) / 10;
}
