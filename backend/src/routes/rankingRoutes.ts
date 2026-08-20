import { Router, Response } from 'express';
import { supabase } from '../database/supabase';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/v1/rankings
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { data: currentUser, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.userId!)
      .maybeSingle();

    if (userError || !currentUser) return res.status(404).json({ error: 'User not found' });

    const { data: allUsers, error: usersError } = await supabase
      .from('users')
      .select('*');

    if (usersError || !allUsers) return res.status(500).json({ error: 'Failed to retrieve users list' });

    const todayStr = new Date().toISOString().split('T')[0];

    const { data: allSummaries, error: summariesError } = await supabase
      .from('daily_summaries')
      .select('*')
      .eq('date', todayStr);

    if (summariesError) return res.status(500).json({ error: 'Failed to retrieve daily summaries' });

    // Map user steps for today
    const userStepsMap = new Map<string, number>();
    for (const user of allUsers) {
      const summary = allSummaries?.find((s) => s.user_id === user.id);
      userStepsMap.set(user.id, summary?.total_steps || 0);
    }

    // 1. Same Age + Same Gender (Category 1 - Most Meaningful)
    const cohort1 = allUsers.filter(
      (u) => u.age_group === currentUser.age_group && u.gender === currentUser.gender
    );
    cohort1.sort((a, b) => (userStepsMap.get(b.id) || 0) - (userStepsMap.get(a.id) || 0));
    const rankCategory1 = cohort1.findIndex((u) => u.id === currentUser.id) + 1;

    // 2. Same Age + All Genders (Category 2)
    const cohort2 = allUsers.filter((u) => u.age_group === currentUser.age_group);
    cohort2.sort((a, b) => (userStepsMap.get(b.id) || 0) - (userStepsMap.get(a.id) || 0));
    const rankCategory2 = cohort2.findIndex((u) => u.id === currentUser.id) + 1;

    // 3. Same Gender + All Ages (Category 3)
    const cohort3 = allUsers.filter((u) => u.gender === currentUser.gender);
    cohort3.sort((a, b) => (userStepsMap.get(b.id) || 0) - (userStepsMap.get(a.id) || 0));
    const rankCategory3 = cohort3.findIndex((u) => u.id === currentUser.id) + 1;

    // 4. Locality Ranking (e.g. Gachibowli)
    const cohortLocality = allUsers.filter(
      (u) => u.locality.toLowerCase() === currentUser.locality.toLowerCase()
    );
    cohortLocality.sort((a, b) => (userStepsMap.get(b.id) || 0) - (userStepsMap.get(a.id) || 0));
    const rankLocality = cohortLocality.findIndex((u) => u.id === currentUser.id) + 1;

    // 5. City Ranking (e.g. Hyderabad)
    const cohortCity = allUsers.filter(
      (u) => u.city.toLowerCase() === currentUser.city.toLowerCase()
    );
    cohortCity.sort((a, b) => (userStepsMap.get(b.id) || 0) - (userStepsMap.get(a.id) || 0));
    const rankCity = cohortCity.findIndex((u) => u.id === currentUser.id) + 1;

    // 6. Global Ranking
    const globalSorted = [...allUsers].sort(
      (a, b) => (userStepsMap.get(b.id) || 0) - (userStepsMap.get(a.id) || 0)
    );
    const rankGlobal = globalSorted.findIndex((u) => u.id === currentUser.id) + 1;

    // AI Insight Card Generation
    const mySteps = userStepsMap.get(currentUser.id) || 0;
    
    let aiInsight;
    let percentile = 100;

    if (mySteps === 0) {
      aiInsight = {
        message: `You haven't started walking today. Get moving to rank in ${currentUser.city}!`,
        nudge: `A brisk 10-minute walk will get you about 1,000 steps closer to your daily goal of ${currentUser.daily_step_goal.toLocaleString()} steps.`,
      };
    } else {
      percentile = Math.max(1, Math.round((rankCategory1 / cohort1.length) * 100));
      const outperformPercent = 100 - percentile;
      
      let nudgeMessage = `You need some more steps to climb the rankings today.`;
      if (rankCategory1 === 1) {
        nudgeMessage = `Awesome! You are the #1 walker in your cohort today!`;
      } else {
        const nextUser = cohort1[rankCategory1 - 2];
        if (nextUser) {
          const nextUserSteps = userStepsMap.get(nextUser.id) || 0;
          const diff = nextUserSteps - mySteps;
          if (diff > 0) {
            nudgeMessage = `You are only ${diff.toLocaleString()} steps behind ${nextUser.alias || nextUser.name}! Walk a bit more to overtake them.`;
          }
        }
      }

      aiInsight = {
        message: `You walked more than ${outperformPercent}% of ${currentUser.gender}s aged ${currentUser.age_group.split(' ')[0]} in ${currentUser.city}.`,
        nudge: nudgeMessage,
      };
    }

    return res.json({
      userStepsToday: mySteps,
      rankings: {
        sameAgeAndGender: { rank: rankCategory1, total: cohort1.length, category: `${currentUser.gender} ${currentUser.age_group}` },
        sameAgeAllGender: { rank: rankCategory2, total: cohort2.length, category: `${currentUser.age_group}` },
        sameGenderAllAge: { rank: rankCategory3, total: cohort3.length, category: `All ${currentUser.gender} Users` },
        locality: { rank: rankLocality, total: cohortLocality.length, name: currentUser.locality },
        city: { rank: rankCity, total: cohortCity.length, name: currentUser.city },
        global: { rank: rankGlobal, total: allUsers.length },
      },
      fitnessPercentile: mySteps === 0 ? 'N/A' : `Top ${percentile}%`,
      aiInsight,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error generating rankings' });
  }
});

export default router;
