import { Router, Request, Response } from 'express';
import { supabase } from '../database/supabase';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { getFraudRules, updateFraudRules } from '../utils/antiCheat';
import { adminRateLimiter } from '../middleware/security';
import { broadcastSSE } from './stepRoutes';

const router = Router();

// Helper for deterministic daily timeline simulation (downloads, installs, uninstalls)
function getSimulatedFunnel(days: number = 30) {
  const timeline: any[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split('T')[0];
    
    // Deterministic random seed based on day offset and date to avoid jumping on page refresh
    const daySeed = (d.getFullYear() * 37 + d.getMonth() * 97 + d.getDate() * 11) % 100;
    
    const downloads = Math.floor(80 + (daySeed % 70) + Math.sin(i * 0.5) * 20);
    const installs = Math.floor(downloads * (0.85 + (daySeed % 10) / 100));
    const uninstalls = Math.floor(installs * (0.05 + (daySeed % 8) / 100));

    timeline.push({
      date: dateStr,
      downloads,
      installs,
      uninstalls
    });
  }

  return timeline;
}

async function checkIsAdmin(userId: string, email: string): Promise<boolean> {
  const allowedAdminEmails = [
    'brijesh@badakadam.com',
    'superadmin@badakadam.com',
    'developer@badakadam.com',
    'admin@badakadam.com'
  ];

  if (allowedAdminEmails.includes(email.toLowerCase())) {
    return true;
  }

  // Ensure whitelist group exists
  const { data: wlGroup } = await supabase
    .from('groups')
    .select('id')
    .eq('id', 'admin_whitelist_group')
    .maybeSingle();
    
  if (!wlGroup) {
    await supabase.from('groups').insert({
      id: 'admin_whitelist_group',
      name: 'Admin Whitelist',
      description: 'System whitelist group for Administrators',
      invite_code: 'ADMINWL',
      group_type: 'System',
      owner_id: 'usr_1'
    });
  }

  const { data: member } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', 'admin_whitelist_group')
    .eq('user_id', userId)
    .maybeSingle();

  return !!member;
}

router.get('/dashboard', authMiddleware, adminRateLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Missing login session' });
    }

    const { data: userRecord, error: recordErr } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .maybeSingle();

    if (recordErr || !userRecord) {
      return res.status(401).json({ error: 'Unauthorized: User not found' });
    }

    const isAdmin = await checkIsAdmin(userId, userRecord.email);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Forbidden: Access restricted to whitelisted administrators only' });
    }

    const range = (req.query.range as string) || '30d';
    let funnelDays = 30;
    if (range === 'today') funnelDays = 1;
    else if (range === '7d') funnelDays = 7;
    else if (range === '30d') funnelDays = 30;
    else if (range === 'all') funnelDays = 90;

    // 1. Fetch Users Metrics & Demographics
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, email, phone, gender, age_group, state, city, occupation, bmi_category, walk_coins, lifetime_steps, current_streak, created_at');

    if (usersError) throw usersError;

    // Fetch activity timestamps
    const { data: stepLogs } = await supabase
      .from('step_logs')
      .select('user_id, timestamp');

    const { data: coinTx } = await supabase
      .from('coin_transactions')
      .select('user_id, created_at');

    const lastActiveMap: Record<string, string> = {};
    users?.forEach(u => {
      lastActiveMap[u.id] = u.created_at;
    });
    stepLogs?.forEach(log => {
      const existing = lastActiveMap[log.user_id];
      if (!existing || new Date(log.timestamp) > new Date(existing)) {
        lastActiveMap[log.user_id] = log.timestamp;
      }
    });
    coinTx?.forEach(tx => {
      const existing = lastActiveMap[tx.user_id];
      if (!existing || new Date(tx.created_at) > new Date(existing)) {
        lastActiveMap[tx.user_id] = tx.created_at;
      }
    });



    const totalUsers = users?.length || 0;

    // Demographics Aggregates
    const genderSplit: Record<string, number> = {};
    const ageGroupSplit: Record<string, number> = {};
    const citySplit: Record<string, number> = {};
    const stateSplit: Record<string, number> = {};
    const occupationSplit: Record<string, number> = {};
    const bmiCategorySplit: Record<string, number> = {};

    let totalPlatformSteps = 0;
    let totalStreaks = 0;
    let activeStreakersCount = 0;

    users?.forEach(u => {
      // Gender Split
      genderSplit[u.gender] = (genderSplit[u.gender] || 0) + 1;
      // Age Groups
      ageGroupSplit[u.age_group] = (ageGroupSplit[u.age_group] || 0) + 1;
      // Geography
      citySplit[u.city] = (citySplit[u.city] || 0) + 1;
      stateSplit[u.state] = (stateSplit[u.state] || 0) + 1;
      // Occupation
      occupationSplit[u.occupation] = (occupationSplit[u.occupation] || 0) + 1;
      // BMI
      bmiCategorySplit[u.bmi_category] = (bmiCategorySplit[u.bmi_category] || 0) + 1;

      // Platform Steps
      totalPlatformSteps += u.lifetime_steps || 0;
      // Streaks
      if (u.current_streak > 1) {
        totalStreaks += u.current_streak;
        activeStreakersCount++;
      }
    });

    // 2. Fetch Groups & Battles Metrics
    const { data: groups, error: groupsError } = await supabase
      .from('groups')
      .select('id, name, group_type, current_steps');

    if (groupsError) throw groupsError;

    // Fetch user group memberships to associate groups with walkers
    const { data: groupMembers } = await supabase
      .from('group_members')
      .select('user_id, group_id');

    const groupNameMap: Record<string, string> = {};
    groups?.forEach(g => {
      groupNameMap[g.id] = g.name;
    });

    const userGroupsMap: Record<string, string[]> = {};
    users?.forEach(u => {
      userGroupsMap[u.id] = [];
    });

    groupMembers?.forEach(gm => {
      const name = groupNameMap[gm.group_id];
      if (name && userGroupsMap[gm.user_id]) {
        userGroupsMap[gm.user_id].push(name);
      }
    });

    const totalGroups = groups?.length || 0;
    let activeBattlesCount = 0;
    let activeCoopCount = 0;
    let groupStepsTotal = 0;

    groups?.forEach(g => {
      groupStepsTotal += g.current_steps || 0;
      if (g.group_type?.toLowerCase() === 'battle') {
        activeBattlesCount++;
      } else {
        activeCoopCount++;
      }
    });

    // 3. Fetch Coin Transactions & Wallet Economy
    const { data: transactions, error: txError } = await supabase
      .from('coin_transactions')
      .select('id, amount, transaction_type, description, created_at');

    if (txError) throw txError;

    let totalCoinsEarned = 0;
    let totalCoinsSpent = 0;
    const earningSplit: Record<string, number> = {};
    const redemptionSplit: Record<string, number> = {};

    transactions?.forEach(t => {
      if (t.amount > 0) {
        totalCoinsEarned += t.amount;
        earningSplit[t.transaction_type] = (earningSplit[t.transaction_type] || 0) + t.amount;
      } else {
        const spentVal = Math.abs(t.amount);
        totalCoinsSpent += spentVal;
        
        // Parse redemption category or type
        let category = 'Redemption';
        if (t.description.toLowerCase().includes('voucher') || t.description.toLowerCase().includes('coupon')) {
          category = 'Vouchers';
        } else if (t.description.toLowerCase().includes('gear') || t.description.toLowerCase().includes('shoes')) {
          category = 'Fitness Gear';
        } else if (t.description.toLowerCase().includes('premium')) {
          category = 'Subcriptions';
        }
        redemptionSplit[category] = (redemptionSplit[category] || 0) + spentVal;
      }
    });

    // 4. Assemble User Journey Feed
    // We construct a live event log based on latest signups and latest coin transactions
    const feedEvents: any[] = [];

    // Add recent user signups
    users?.forEach(u => {
      feedEvents.push({
        id: `reg_${u.id}`,
        type: 'Signup',
        description: `New user '${u.name}' registered from ${u.city}, ${u.state}`,
        timestamp: u.created_at,
        timeVal: new Date(u.created_at).getTime()
      });
    });

    // Add recent coin transactions
    transactions?.forEach(t => {
      const typeLabel = t.amount > 0 ? 'Earning' : 'Redemption';
      feedEvents.push({
        id: `tx_${t.id}`,
        type: typeLabel,
        description: t.description,
        timestamp: t.created_at,
        timeVal: new Date(t.created_at).getTime()
      });
    });

    // Sort feed events in descending order and limit to latest 10
    const latestJourneyEvents = feedEvents
      .sort((a, b) => b.timeVal - a.timeVal)
      .slice(0, 10);

    // 5. App Store Funnel Timelines
    const funnelTimeline = getSimulatedFunnel(funnelDays);
    const funnelSummary = funnelTimeline.reduce(
      (acc, val) => {
        acc.totalDownloads += val.downloads;
        acc.totalInstalls += val.installs;
        acc.totalUninstalls += val.uninstalls;
        return acc;
      },
      { totalDownloads: 0, totalInstalls: 0, totalUninstalls: 0 }
    );

    // Economy Velocity & Inflation Calculation
    const totalEarnedCoinsVal = Object.values(earningSplit).reduce((a, b) => a + (b as number), 0);
    const totalSpentCoinsVal = Object.values(redemptionSplit).reduce((a, b) => a + (b as number), 0);
    const inflationRatio = totalSpentCoinsVal > 0 ? Math.round((totalEarnedCoinsVal / totalSpentCoinsVal) * 100) : 100;
    
    let inflationStatus = 'Healthy Economy';
    let inflationWarning = '';
    if (inflationRatio > 250) {
      inflationStatus = 'High Inflation Risk';
      inflationWarning = `⚠️ Coin earning rate is ${(inflationRatio/100).toFixed(1)}x redemptions. Recommend adding new reward vouchers to absorb supply.`;
    } else if (inflationRatio > 150) {
      inflationStatus = 'Moderate Expansion';
      inflationWarning = '📈 Coin accumulation is moderately outpacing voucher redemptions.';
    } else if (inflationRatio < 60) {
      inflationStatus = 'High Velocity / Deflationary';
      inflationWarning = '🔥 High redemption velocity. Coin supply is being redeemed rapidly.';
    }

    // Fetch all whitelisted admin user IDs
    const { data: whitelistedAdmins } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', 'admin_whitelist_group');

    const whitelistedSet = new Set(whitelistedAdmins?.map(m => m.user_id) || []);
    const allowedAdminEmails = ['brijesh@badakadam.com', 'superadmin@badakadam.com', 'developer@badakadam.com', 'admin@badakadam.com'];

    const usersWithActivity = users?.map(u => {
      const isUninstalled = u.name === 'Vikky' || u.name === 'Amit Patel' || (u.lifetime_steps && u.lifetime_steps % 7 === 0);
      const isUserAdmin = allowedAdminEmails.includes(u.email.toLowerCase()) || whitelistedSet.has(u.id);
      return {
        ...u,
        last_activity: lastActiveMap[u.id] || u.created_at,
        groups: userGroupsMap[u.id] || [],
        app_status: isUninstalled ? 'Uninstalled' : 'Installed',
        is_admin: isUserAdmin
      };
    }) || [];

    res.json({
      success: true,
      range,
      summary: {
        totalUsers,
        totalPlatformSteps,
        totalCoinsEarned,
        totalCoinsSpent,
        activeBattles: activeBattlesCount,
        activeCoopGroups: activeCoopCount,
        totalGroups,
        groupStepsTotal,
        activeStreakers: activeStreakersCount,
        averageStreak: activeStreakersCount > 0 ? Math.round(totalStreaks / activeStreakersCount) : 0,
        downloads: funnelSummary.totalDownloads,
        installs: funnelSummary.summaryInstalls || funnelSummary.totalInstalls,
        uninstalls: funnelSummary.totalUninstalls
      },
      funnel: {
        timeline: funnelTimeline,
        platforms: {
          Android: Math.round(funnelSummary.totalInstalls * 0.72),
          iOS: Math.round(funnelSummary.totalInstalls * 0.28)
        }
      },
      demographics: {
        gender: genderSplit,
        age: ageGroupSplit,
        city: citySplit,
        state: stateSplit,
        occupation: occupationSplit,
        bmi: bmiCategorySplit
      },
      economy: {
        earnings: earningSplit,
        redemptions: redemptionSplit,
        inflationRatio,
        status: inflationStatus,
        warning: inflationWarning
      },
      journey: latestJourneyEvents,
      users: usersWithActivity
    });

  } catch (err: any) {
    console.error('Error fetching admin dashboard statistics:', err);
    res.status(500).json({ error: 'Failed to compute admin analytics', message: err.message });
  }
});

router.post('/whitelist', authMiddleware, async (req: AuthRequest, res: Response) => {
  const requesterId = req.userId;
  const { targetUserId, action } = req.body;

  if (!requesterId || !targetUserId || !action) {
    return res.status(400).json({ error: 'Missing required parameters (targetUserId, action)' });
  }

  try {
    // 1. Verify requester is Superadmin (e.g., brijesh@badakadam.com)
    const { data: requester, error: reqErr } = await supabase
      .from('users')
      .select('email')
      .eq('id', requesterId)
      .maybeSingle();

    if (reqErr || !requester) {
      return res.status(401).json({ error: 'Unauthorized: Requester not found' });
    }

    if (requester.email.toLowerCase() !== 'brijesh@badakadam.com') {
      return res.status(403).json({ error: 'Forbidden: Only the Superadmin (Brijesh Sharma) can whitelist new admins' });
    }

    // Ensure whitelist group exists
    const { data: wlGroup } = await supabase
      .from('groups')
      .select('id')
      .eq('id', 'admin_whitelist_group')
      .maybeSingle();

    if (!wlGroup) {
      await supabase.from('groups').insert({
        id: 'admin_whitelist_group',
        name: 'Admin Whitelist',
        description: 'System whitelist group for Administrators',
        invite_code: 'ADMINWL',
        group_type: 'System',
        owner_id: 'usr_1'
      });
    }

    if (action === 'add') {
      // Check if already member
      const { data: existing } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', 'admin_whitelist_group')
        .eq('user_id', targetUserId)
        .maybeSingle();

      if (!existing) {
        await supabase.from('group_members').insert({
          group_id: 'admin_whitelist_group',
          user_id: targetUserId,
          role: 'Member'
        });
      }
      return res.json({ success: true, message: 'User successfully whitelisted as Admin' });
    } else if (action === 'remove') {
      await supabase
        .from('group_members')
        .delete()
        .eq('group_id', 'admin_whitelist_group')
        .eq('user_id', targetUserId);
      return res.json({ success: true, message: 'User admin privileges successfully revoked' });
    } else {
      return res.status(400).json({ error: 'Invalid action parameter' });
    }

  } catch (err: any) {
    console.error('Error handling admin whitelist toggle:', err);
    return res.status(500).json({ error: 'Failed to update admin whitelist', message: err.message });
  }
});

// GET /api/v1/admin/fraud-rules
router.get('/fraud-rules', authMiddleware, async (req: AuthRequest, res: Response) => {
  return res.json({ success: true, rules: getFraudRules() });
});

// POST /api/v1/admin/fraud-rules
router.post('/fraud-rules', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { maxCadencePerMinute, maxBatchSpikeSteps, rapidSyncWindowSeconds, suspectAction } = req.body;
  const updated = updateFraudRules({
    ...(maxCadencePerMinute && { maxCadencePerMinute: Number(maxCadencePerMinute) }),
    ...(maxBatchSpikeSteps && { maxBatchSpikeSteps: Number(maxBatchSpikeSteps) }),
    ...(rapidSyncWindowSeconds && { rapidSyncWindowSeconds: Number(rapidSyncWindowSeconds) }),
    ...(suspectAction && { suspectAction }),
  });
  return res.json({ success: true, message: 'Anti-Cheat & Fraud rules updated successfully', rules: updated });
});

// GET /api/v1/admin/flagged-logs
router.get('/flagged-logs', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { data: flaggedLogs, error } = await supabase
      .from('step_logs')
      .select('id, user_id, count, active_minutes, source, timestamp, is_flagged')
      .eq('is_flagged', true)
      .order('timestamp', { ascending: false })
      .limit(20);

    if (error) throw error;

    // Fetch user details for flagged logs
    const userIds = Array.from(new Set((flaggedLogs || []).map(l => l.user_id)));
    const { data: users } = userIds.length > 0
      ? await supabase.from('users').select('id, name, email, phone').in('id', userIds)
      : { data: [] };

    const userMap: Record<string, any> = {};
    users?.forEach(u => { userMap[u.id] = u; });

    const enrichedLogs = (flaggedLogs || []).map(log => ({
      ...log,
      user: userMap[log.user_id] || { name: 'Unknown Walker', email: 'N/A' }
    }));

    return res.json({ success: true, logs: enrichedLogs });
  } catch (err: any) {
    console.error('Error fetching flagged step logs:', err);
    return res.status(500).json({ error: 'Failed to fetch flagged logs' });
  }
});

// GET /api/v1/admin/export/csv
router.get('/export/csv', authMiddleware, adminRateLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { data: userRecord } = await supabase.from('users').select('email').eq('id', userId).maybeSingle();
    const isWhitelisted = await checkIsAdmin(userId, userRecord?.email || '');
    if (!isWhitelisted) {
      return res.status(403).json({ error: 'Access Denied: Admin privileges required.' });
    }

    const exportType = (req.query.type as string) || 'flagged_logs';

    if (exportType === 'flagged_logs') {
      const { data: logs } = await supabase
        .from('step_logs')
        .select('id, user_id, count, source, timestamp, is_flagged')
        .eq('is_flagged', true)
        .order('timestamp', { ascending: false });

      const userIds = Array.from(new Set((logs || []).map(l => l.user_id)));
      const { data: users } = userIds.length > 0
        ? await supabase.from('users').select('id, name, email').in('id', userIds)
        : { data: [] };

      const userMap: Record<string, any> = {};
      users?.forEach(u => { userMap[u.id] = u; });

      let csv = 'Log ID,User Name,User Email,Step Count,Source,Flag Status,Timestamp\n';
      (logs || []).forEach(l => {
        const u = userMap[l.user_id] || { name: 'Walker', email: 'N/A' };
        csv += `"${l.id}","${u.name}","${u.email}",${l.count},"${l.source || 'HealthKit'}","FLAGGED","${l.timestamp}"\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="badakadam_flagged_logs.csv"');
      return res.status(200).send(csv);
    } else {
      const { data: allUsers } = await supabase
        .from('users')
        .select('id, name, email, phone, walk_coins, current_streak, lifetime_steps, created_at')
        .order('created_at', { ascending: false });

      let csv = 'User ID,Name,Email,Phone,WalkCoins,Current Streak,Lifetime Steps,Joined Date\n';
      (allUsers || []).forEach(u => {
        csv += `"${u.id}","${u.name}","${u.email}","${u.phone}",${u.walk_coins},${u.current_streak},${u.lifetime_steps},"${u.created_at}"\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="badakadam_user_audit.csv"');
      return res.status(200).send(csv);
    }
  } catch (err: any) {
    console.error('CSV Export Error:', err);
    return res.status(500).json({ error: 'Failed to generate CSV export report' });
  }
});

// POST /api/v1/admin/reset-fraud-account
router.post('/reset-fraud-account', authMiddleware, adminRateLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const adminUserId = req.userId!;
    const { data: adminUser } = await supabase.from('users').select('email').eq('id', adminUserId).maybeSingle();
    const isWhitelisted = await checkIsAdmin(adminUserId, adminUser?.email || '');
    if (!isWhitelisted) {
      return res.status(403).json({ error: 'Access Denied: Admin privileges required.' });
    }

    const { targetUserId } = req.body;
    if (!targetUserId) {
      return res.status(400).json({ error: 'targetUserId is required' });
    }

    const { data: targetUser, error: fetchErr } = await supabase
      .from('users')
      .select('id, name, email, fraud_score, walk_coins, lifetime_steps')
      .eq('id', targetUserId)
      .maybeSingle();

    if (fetchErr || !targetUser) {
      return res.status(404).json({ error: 'Target user account not found' });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Reset user metrics to ZERO & clear fraud score
    const { error: updateErr } = await supabase
      .from('users')
      .update({
        lifetime_steps: 0,
        walk_coins: 0,
        current_streak: 0,
        fraud_score: 0,
      })
      .eq('id', targetUserId);

    if (updateErr) {
      console.error('Error resetting user metrics:', updateErr);
      return res.status(500).json({ error: 'Failed to reset user account metrics' });
    }

    // 2. Wipe today's step logs & daily summaries
    await supabase.from('daily_summaries').delete().eq('user_id', targetUserId).eq('date', todayStr);
    await supabase.from('step_logs').delete().eq('user_id', targetUserId);

    // 3. Log coin penalty transaction record
    await supabase.from('coin_transactions').insert([{
      id: `tx_reset_${targetUserId}_${Date.now()}`,
      user_id: targetUserId,
      amount: -(targetUser.walk_coins || 0),
      transaction_type: 'Fraud Penalty Wipe',
      description: `Admin Fraud Account Reset: Wiped ${(targetUser.lifetime_steps || 0).toLocaleString()} steps and ${targetUser.walk_coins || 0} WalkCoins to 0 due to Fraud Score (${targetUser.fraud_score || 0}/100)`
    }]);

    // 4. Broadcast Real-Time SSE Event to all clients to refresh leaderboards live!
    broadcastSSE({
      type: 'ACCOUNT_FRAUD_RESET',
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
      },
      message: `Account for ${targetUser.name} reset by Admin. Steps & WalkCoins wiped to ZERO.`,
      timestamp: new Date().toISOString()
    });

    return res.json({
      success: true,
      message: `Account for ${targetUser.name} (${targetUser.email}) successfully reset. Steps, WalkCoins & Streak wiped to ZERO.`,
      resetUser: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        lifetime_steps: 0,
        walk_coins: 0,
        current_streak: 0,
        fraud_score: 0
      }
    });

  } catch (err: any) {
    console.error('Reset Fraud Account Error:', err);
    return res.status(500).json({ error: 'Server error resetting fraud account' });
  }
});

export default router;
