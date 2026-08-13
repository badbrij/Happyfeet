import { User } from '../types';

export function formatDBUser(dbUser: any): User {
  return {
    id: dbUser.id,
    name: dbUser.name,
    alias: dbUser.alias || undefined,
    profilePic: dbUser.profile_pic || undefined,
    email: dbUser.email,
    phone: dbUser.phone,
    passwordHash: dbUser.password_hash,
    dob: dbUser.dob,
    age: dbUser.age,
    gender: dbUser.gender,
    ageGroup: dbUser.age_group,
    location: {
      country: dbUser.country,
      state: dbUser.state,
      city: dbUser.city,
      locality: dbUser.locality,
      pincode: dbUser.pincode || undefined,
    },
    healthProfile: {
      heightCm: dbUser.height_cm,
      weightKg: dbUser.weight_kg,
      bmi: dbUser.bmi,
      bmiCategory: dbUser.bmi_category,
      occupation: dbUser.occupation,
      dailyStepGoal: dbUser.daily_step_goal,
      fitnessTier: dbUser.fitness_tier,
    },
    fraudScore: dbUser.fraud_score,
    walkCoins: dbUser.walk_coins,
    currentStreak: dbUser.current_streak,
    lifetimeSteps: dbUser.lifetime_steps,
    createdAt: dbUser.created_at,
  };
}
