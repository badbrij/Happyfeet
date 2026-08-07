import { Router, Response } from 'express';
import { db } from '../database/store';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { User } from '../types';

const router = Router();

// GET /api/v1/rankings
router.get('/', authMiddleware, (req: AuthRequest, res: Response) => {
  const currentUser = db.users.get(req.userId!);
  if (!currentUser) return res.status(404).json({ error: 'User not found' });

  const allUsers = Array.from(db.users.values());
  const todayStr = new Date().toISOString().split('T')[0];

  // Map user steps for today
  const userStepsMap = new Map<string, number>();
  for (const user of allUsers) {
    const summaries = db.dailySummaries.get(user.id) || [];
    const today = summaries.find((s) => s.date === todayStr);
    userStepsMap.set(user.id, today?.totalSteps || 0);
  }

  // 1. Same Age + Same Gender (Category 1 - Most Meaningful)
  const cohort1 = allUsers.filter(
    (u) => u.ageGroup === currentUser.ageGroup && u.gender === currentUser.gender
  );
  cohort1.sort((a, b) => (userStepsMap.get(b.id) || 0) - (userStepsMap.get(a.id) || 0));
  const rankCategory1 = cohort1.findIndex((u) => u.id === currentUser.id) + 1;

  // 2. Same Age + All Genders (Category 2)
  const cohort2 = allUsers.filter((u) => u.ageGroup === currentUser.ageGroup);
  cohort2.sort((a, b) => (userStepsMap.get(b.id) || 0) - (userStepsMap.get(a.id) || 0));
  const rankCategory2 = cohort2.findIndex((u) => u.id === currentUser.id) + 1;

  // 3. Same Gender + All Ages (Category 3)
  const cohort3 = allUsers.filter((u) => u.gender === currentUser.gender);
  cohort3.sort((a, b) => (userStepsMap.get(b.id) || 0) - (userStepsMap.get(a.id) || 0));
  const rankCategory3 = cohort3.findIndex((u) => u.id === currentUser.id) + 1;

  // 4. Locality Ranking (e.g. Gachibowli)
  const cohortLocality = allUsers.filter(
    (u) => u.location.locality.toLowerCase() === currentUser.location.locality.toLowerCase()
  );
  cohortLocality.sort((a, b) => (userStepsMap.get(b.id) || 0) - (userStepsMap.get(a.id) || 0));
  const rankLocality = cohortLocality.findIndex((u) => u.id === currentUser.id) + 1;

  // 5. City Ranking (e.g. Hyderabad)
  const cohortCity = allUsers.filter(
    (u) => u.location.city.toLowerCase() === currentUser.location.city.toLowerCase()
  );
  cohortCity.sort((a, b) => (userStepsMap.get(b.id) || 0) - (userStepsMap.get(a.id) || 0));
  const rankCity = cohortCity.findIndex((u) => u.id === currentUser.id) + 1;

  // 6. Global Ranking
  const globalSorted = [...allUsers].sort(
    (a, b) => (userStepsMap.get(b.id) || 0) - (userStepsMap.get(a.id) || 0)
  );
  const rankGlobal = globalSorted.findIndex((u) => u.id === currentUser.id) + 1;

  // Calculate Percentile
  const percentile = Math.max(1, Math.round((rankCategory1 / cohort1.length) * 100));

  // AI Insight Card Generation
  const mySteps = userStepsMap.get(currentUser.id) || 0;
  const outperformPercent = 100 - percentile;
  const aiInsight = {
    message: `You walked more than ${outperformPercent}% of ${currentUser.gender}s aged ${currentUser.ageGroup.split(' ')[0]} in ${currentUser.location.city}.`,
    nudge: rankCategory1 > 1 ? `You need ${1250} more steps to enter the Top 10%.` : `Awesome! You are the #1 walker in your cohort today!`,
  };

  return res.json({
    userStepsToday: mySteps,
    rankings: {
      sameAgeAndGender: { rank: rankCategory1, total: cohort1.length, category: `${currentUser.gender} ${currentUser.ageGroup}` },
      sameAgeAllGender: { rank: rankCategory2, total: cohort2.length, category: `${currentUser.ageGroup}` },
      sameGenderAllAge: { rank: rankCategory3, total: cohort3.length, category: `All ${currentUser.gender} Users` },
      locality: { rank: rankLocality, total: cohortLocality.length, name: currentUser.location.locality },
      city: { rank: rankCity, total: cohortCity.length, name: currentUser.location.city },
      global: { rank: rankGlobal, total: allUsers.length },
    },
    fitnessPercentile: `Top ${percentile}%`,
    aiInsight,
  });
});

export default router;
