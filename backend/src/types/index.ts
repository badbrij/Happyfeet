export type Gender = 'Male' | 'Female' | 'Other' | 'PreferNotToSay';

export type AgeGroup = 'Gen Z (18-24)' | 'Young Adult (25-34)' | 'Mid Career (35-44)' | 'Mature Adult (45-54)' | 'Senior Active (55-64)' | 'Veteran (65+)';

export type ActivityTier = 'Beginner (0-5k)' | 'Moderate (5k-10k)' | 'Advanced (10k-15k)' | 'Elite (15k+)';

export type BMICategory = 'Underweight' | 'Normal' | 'Overweight' | 'Obese';

export interface Location {
  country: string;
  state: string;
  city: string;
  locality: string;
  pincode?: string;
}

export interface HealthProfile {
  heightCm: number;
  weightKg: number;
  bmi: number;
  bmiCategory: BMICategory;
  occupation: string;
  dailyStepGoal: number;
  fitnessTier: ActivityTier;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  dob: string;
  age: number;
  gender: Gender;
  ageGroup: AgeGroup;
  location: Location;
  healthProfile: HealthProfile;
  fraudScore: number; // 0 (Legit) - 100 (Suspicious)
  walkCoins: number;
  currentStreak: number;
  lifetimeSteps: number;
  createdAt: string;
}

export interface StepLog {
  id: string;
  userId: string;
  timestamp: string; // ISO String
  date: string; // YYYY-MM-DD
  count: number;
  distanceMeters: number;
  calories: number;
  activeMinutes: number;
  source: 'AppleHealthKit' | 'GoogleHealthConnect' | 'Manual';
  isFlagged: boolean;
}

export interface DailySummary {
  userId: string;
  date: string;
  totalSteps: number;
  totalDistanceMeters: number;
  totalCalories: number;
  totalActiveMinutes: number;
  goalMet: boolean;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  inviteCode: string;
  groupType: 'Family' | 'Friends' | 'Office' | 'Neighborhood' | 'Community';
  members: { userId: string; role: 'Owner' | 'Admin' | 'Member'; joinedAt: string }[];
  targetSteps?: number;
  currentSteps?: number;
  createdAt: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'Milestone' | 'Streak' | 'Community';
  unlockedAt?: string;
}

export interface RewardItem {
  id: string;
  title: string;
  brand: string;
  description: string;
  costWalkCoins: number;
  category: 'Voucher' | 'Fitness' | 'Food' | 'Insurance';
  imageUrl: string;
}
