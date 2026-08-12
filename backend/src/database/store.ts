import { User, StepLog, DailySummary, Group, RewardItem, Achievement } from '../types';
import bcrypt from 'bcryptjs';

class DataStore {
  public users: Map<string, User> = new Map();
  public stepLogs: StepLog[] = [];
  public dailySummaries: Map<string, DailySummary[]> = new Map(); // key: userId
  public groups: Map<string, Group> = new Map();
  public rewards: RewardItem[] = [];
  public achievements: Achievement[] = [];

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    const salt = bcrypt.genSaltSync(10);
    const defaultPasswordHash = bcrypt.hashSync('Password123!', salt);

    // 1. Seed Users across Demographics & Locations
    const seededUsers: Partial<User>[] = [
      {
        id: 'usr_1',
        name: 'Brijesh Sharma',
        email: 'brijesh@walkverse.com',
        phone: '+919876543210',
        dob: '1988-06-15',
        age: 38,
        gender: 'Male',
        ageGroup: 'Mid Career (35-44)',
        location: { country: 'India', state: 'Telangana', city: 'Hyderabad', locality: 'Gachibowli' },
        healthProfile: { heightCm: 178, weightKg: 78, bmi: 24.6, bmiCategory: 'Normal', occupation: 'IT Professional', dailyStepGoal: 10000, fitnessTier: 'Advanced (10k-15k)' },
        fraudScore: 0,
        walkCoins: 1450,
        currentStreak: 21,
        lifetimeSteps: 624500,
      },
      {
        id: 'usr_2',
        name: 'Priya Verma',
        email: 'priya@walkverse.com',
        phone: '+919876543211',
        dob: '1992-09-20',
        age: 33,
        gender: 'Female',
        ageGroup: 'Young Adult (25-34)',
        location: { country: 'India', state: 'Telangana', city: 'Hyderabad', locality: 'Gachibowli' },
        healthProfile: { heightCm: 165, weightKg: 58, bmi: 21.3, bmiCategory: 'Normal', occupation: 'Doctor', dailyStepGoal: 12000, fitnessTier: 'Advanced (10k-15k)' },
        fraudScore: 0,
        walkCoins: 2100,
        currentStreak: 34,
        lifetimeSteps: 890000,
      },
      {
        id: 'usr_3',
        name: 'Rahul Mehta',
        email: 'rahul@walkverse.com',
        phone: '+919876543212',
        dob: '1985-03-10',
        age: 41,
        gender: 'Male',
        ageGroup: 'Mid Career (35-44)',
        location: { country: 'India', state: 'Telangana', city: 'Hyderabad', locality: 'Gachibowli' },
        healthProfile: { heightCm: 172, weightKg: 82, bmi: 27.7, bmiCategory: 'Overweight', occupation: 'IT Professional', dailyStepGoal: 10000, fitnessTier: 'Moderate (5k-10k)' },
        fraudScore: 5,
        walkCoins: 980,
        currentStreak: 12,
        lifetimeSteps: 412000,
      },
      {
        id: 'usr_4',
        name: 'Amit Patel',
        email: 'amit@walkverse.com',
        phone: '+919876543213',
        dob: '1983-11-05',
        age: 42,
        gender: 'Male',
        ageGroup: 'Mid Career (35-44)',
        location: { country: 'India', state: 'Maharashtra', city: 'Mumbai', locality: 'Bandra' },
        healthProfile: { heightCm: 180, weightKg: 75, bmi: 23.1, bmiCategory: 'Normal', occupation: 'Entrepreneur', dailyStepGoal: 15000, fitnessTier: 'Elite (15k+)' },
        fraudScore: 0,
        walkCoins: 3400,
        currentStreak: 45,
        lifetimeSteps: 1250000,
      },
      {
        id: 'usr_5',
        name: 'Ananya Rao',
        email: 'ananya@walkverse.com',
        phone: '+919876543214',
        dob: '2001-04-18',
        age: 25,
        gender: 'Female',
        ageGroup: 'Young Adult (25-34)',
        location: { country: 'India', state: 'Karnataka', city: 'Bangalore', locality: 'Koramangala' },
        healthProfile: { heightCm: 160, weightKg: 52, bmi: 20.3, bmiCategory: 'Normal', occupation: 'Student', dailyStepGoal: 8000, fitnessTier: 'Moderate (5k-10k)' },
        fraudScore: 0,
        walkCoins: 620,
        currentStreak: 7,
        lifetimeSteps: 180000,
      }
    ];

    for (const u of seededUsers) {
      const fullUser: User = {
        ...(u as User),
        passwordHash: defaultPasswordHash,
        createdAt: new Date().toISOString(),
      };
      this.users.set(fullUser.id, fullUser);

      // Seed 7 days of step summaries
      const summaries: DailySummary[] = [];
      const today = new Date();
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];

        // Give realistic steps per user profile
        let steps = 8000 + Math.floor(Math.random() * 6000);
        if (fullUser.id === 'usr_4') steps = 16000 + Math.floor(Math.random() * 3000); // Elite
        if (fullUser.id === 'usr_1' && i === 0) steps = 14521; // Match OCR doc example

        summaries.push({
          userId: fullUser.id,
          date: dateStr,
          totalSteps: steps,
          totalDistanceMeters: Math.round(steps * 0.75),
          totalCalories: Math.round(steps * 0.04),
          totalActiveMinutes: Math.round(steps / 100),
          goalMet: steps >= fullUser.healthProfile.dailyStepGoal,
        });
      }
      this.dailySummaries.set(fullUser.id, summaries);
    }

    // 2. Seed Groups
    const familyGroup: Group = {
      id: 'grp_1',
      name: 'Sharma Fitness Warriors',
      description: 'Family & friends daily 10k step challenge!',
      ownerId: 'usr_1',
      inviteCode: 'WALK123',
      groupType: 'Family',
      members: [
        { userId: 'usr_1', role: 'Owner', joinedAt: new Date().toISOString() },
        { userId: 'usr_2', role: 'Admin', joinedAt: new Date().toISOString() },
        { userId: 'usr_3', role: 'Member', joinedAt: new Date().toISOString() },
      ],
      targetSteps: 1000000,
      currentSteps: 843000,
      createdAt: new Date().toISOString(),
    };
    this.groups.set(familyGroup.id, familyGroup);

    // 3. Seed Marketplace Rewards
    this.rewards = [
      { id: 'rew_1', title: '₹250 Gift Voucher', brand: 'Amazon', description: 'Applicable on any shopping order', costWalkCoins: 500, category: 'Voucher', imageUrl: 'https://img.icons8.com/color/96/amazon.png' },
      { id: 'rew_2', title: 'Free Delivery Pack', brand: 'Swiggy', description: '5 free deliveries on food orders', costWalkCoins: 250, category: 'Food', imageUrl: 'https://img.icons8.com/color/96/swiggy.png' },
      { id: 'rew_3', title: '20% Off Fitness Gear', brand: 'Decathlon', description: 'Valid on footwear & sports gear', costWalkCoins: 400, category: 'Fitness', imageUrl: 'https://img.icons8.com/color/96/decathlon.png' },
      { id: 'rew_4', title: 'Free Health Checkup', brand: 'Apollo', description: 'Full body diagnostic package', costWalkCoins: 1000, category: 'Insurance', imageUrl: 'https://img.icons8.com/color/96/hospital-3.png' },
    ];
  }
}

export const db = new DataStore();
