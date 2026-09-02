import { Router, Response } from 'express';
import { supabase } from '../database/supabase';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/v1/groups - Create a group
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { name, description, groupType, targetSteps, allowedPhones, battleDuration } = req.body;
  const userId = req.userId!;

  if (!name) return res.status(400).json({ error: 'Group name is required' });

  try {
    const groupId = `grp_${Date.now()}`;
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const duration = battleDuration || 'Infinite';
    const startDate = new Date().toISOString().split('T')[0];
    let endDate: string | null = null;

    if (duration === 'Monthly') {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      endDate = d.toISOString().split('T')[0];
    } else if (duration === 'Quarterly') {
      const d = new Date();
      d.setDate(d.getDate() + 90);
      endDate = d.toISOString().split('T')[0];
    } else if (duration === 'HalfYearly') {
      const d = new Date();
      d.setDate(d.getDate() + 180);
      endDate = d.toISOString().split('T')[0];
    }

    const metadata = { battleDuration: duration, startDate, endDate };
    const serializedDescription = `${description || ''} ||METADATA|| ${JSON.stringify(metadata)}`;

    const newGroup = {
      id: groupId,
      name,
      description: serializedDescription,
      owner_id: userId,
      invite_code: inviteCode,
      group_type: groupType || 'Friends',
      target_steps: targetSteps || 1000000,
      current_steps: 0,
      allowed_phones: allowedPhones || [],
    };

    // Insert Group
    const { error: groupError } = await supabase
      .from('groups')
      .insert([newGroup]);

    if (groupError) {
      console.error(groupError);
      return res.status(500).json({ error: 'Failed to create group' });
    }

    // Insert Owner Member
    const { error: memberError } = await supabase
      .from('group_members')
      .insert([{
        group_id: groupId,
        user_id: userId,
        role: 'Owner'
      }]);

    if (memberError) {
      console.error(memberError);
      return res.status(500).json({ error: 'Failed to add owner to group' });
    }

    return res.status(201).json({ 
      message: 'Group created successfully', 
      group: {
        id: newGroup.id,
        name: newGroup.name,
        description: description || '',
        ownerId: newGroup.owner_id,
        inviteCode: newGroup.invite_code,
        groupType: newGroup.group_type,
        targetSteps: newGroup.target_steps,
        currentSteps: newGroup.current_steps,
        allowedPhones: newGroup.allowed_phones,
        battleDuration: duration,
        startDate,
        endDate,
        status: 'Active',
        daysRemaining: endDate ? 30 : null,
        members: [{ userId, role: 'Owner' }] // Return mock initial members list for UI
      } 
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error creating group' });
  }
});

// GET /api/v1/groups - List user's groups
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  try {
    // Get all group memberships
    const { data: memberships, error } = await supabase
      .from('group_members')
      .select('group_id, role, groups(*)')
      .eq('user_id', userId);

    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to fetch group list' });
    }

    const userGroups = [];
    for (const m of memberships) {
      const g = m.groups as any;
      if (!g) continue;

      // Count members in group
      const { count, error: countError } = await supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', g.id);

      if (countError) {
        console.error(countError);
      }

      // Parse metadata from description
      const parts = (g.description || '').split(' ||METADATA|| ');
      const descText = parts[0];
      let battleDuration = 'Infinite';
      let startDate = g.created_at ? g.created_at.split('T')[0] : new Date().toISOString().split('T')[0];
      let endDate: string | null = null;

      if (parts[1]) {
        try {
          const meta = JSON.parse(parts[1]);
          battleDuration = meta.battleDuration || 'Infinite';
          startDate = meta.startDate || startDate;
          endDate = meta.endDate || null;
        } catch (e) {
          // fallback
        }
      }

      let status = 'Active';
      let daysRemaining: number | null = null;
      if (endDate) {
        const today = new Date();
        today.setHours(0,0,0,0);
        const end = new Date(endDate);
        end.setHours(0,0,0,0);
        const diffTime = end.getTime() - today.getTime();
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (daysRemaining < 0) {
          status = 'Concluded';
          daysRemaining = 0;
        }
      }

      userGroups.push({
        id: g.id,
        name: g.name,
        description: descText,
        ownerId: g.owner_id,
        inviteCode: g.invite_code,
        groupType: g.group_type,
        targetSteps: g.target_steps,
        currentSteps: g.current_steps,
        allowedPhones: g.allowed_phones,
        battleDuration,
        startDate,
        endDate,
        status,
        daysRemaining,
        members: new Array(count || 0).fill({}), // Populate empty objects of proper length for frontend length check
      });
    }

    return res.json({ groups: userGroups });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error listing groups' });
  }
});

// POST /api/v1/groups/join - Join group by invite code
router.post('/join', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { inviteCode } = req.body;
  const userId = req.userId!;

  if (!inviteCode) return res.status(400).json({ error: 'Invite code is required' });

  try {
    const codeStr = String(inviteCode).toUpperCase();
    const { data: targetGroup, error: groupError } = await supabase
      .from('groups')
      .select('*')
      .eq('invite_code', codeStr)
      .maybeSingle();

    if (groupError || !targetGroup) {
      return res.status(404).json({ error: 'Invalid invite code' });
    }

    // Check if already a member
    const { data: existingMember } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', targetGroup.id)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingMember) {
      return res.status(400).json({ error: 'Already a member of this group' });
    }

    // Retrieve user for whitelist check
    const { data: user } = await supabase
      .from('users')
      .select('phone')
      .eq('id', userId)
      .maybeSingle();

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Enforce whitelist check if allowed_phones is populated
    if (targetGroup.allowed_phones && targetGroup.allowed_phones.length > 0) {
      if (!targetGroup.allowed_phones.includes(user.phone)) {
        return res.status(403).json({ error: 'Your mobile number is not authorized to join this group.' });
      }
    }

    // Add member to group
    const { error: joinError } = await supabase
      .from('group_members')
      .insert([{
        group_id: targetGroup.id,
        user_id: userId,
        role: 'Member'
      }]);

    if (joinError) {
      console.error(joinError);
      return res.status(500).json({ error: 'Failed to join group' });
    }

    return res.json({ 
      message: 'Joined group successfully', 
      group: {
        id: targetGroup.id,
        name: targetGroup.name,
        inviteCode: targetGroup.invite_code,
      } 
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error joining group' });
  }
});

// GET /api/v1/groups/:id/leaderboard - Group leaderboard
router.get('/:id/leaderboard', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const todayStr = new Date().toISOString().split('T')[0];

  try {
    const { data: group } = await supabase
      .from('groups')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Parse description metadata
    const parts = (group.description || '').split(' ||METADATA|| ');
    const descText = parts[0];
    let battleDuration = 'Infinite';
    let startDate = group.created_at ? group.created_at.split('T')[0] : new Date().toISOString().split('T')[0];
    let endDate: string | null = null;

    if (parts[1]) {
      try {
        const meta = JSON.parse(parts[1]);
        battleDuration = meta.battleDuration || 'Infinite';
        startDate = meta.startDate || startDate;
        endDate = meta.endDate || null;
      } catch (e) {
        // fallback
      }
    }

    let status = 'Active';
    let daysRemaining: number | null = null;
    if (endDate) {
      const today = new Date();
      today.setHours(0,0,0,0);
      const end = new Date(endDate);
      end.setHours(0,0,0,0);
      const diffTime = end.getTime() - today.getTime();
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (daysRemaining < 0) {
        status = 'Concluded';
        daysRemaining = 0;
      }
    }

    const { data: members, error: membersError } = await supabase
      .from('group_members')
      .select('user_id, role, users(name, alias, email, current_streak, profile_pic, gender, fraud_score)')
      .eq('group_id', id);

    if (membersError) {
      console.error(membersError);
      return res.status(500).json({ error: 'Failed to retrieve group members' });
    }

    const memberRankings = [];
    for (const m of members) {
      const u = m.users as any;
      if (!u) continue;

      // Get steps today from daily summaries
      const { data: todaySummary } = await supabase
        .from('daily_summaries')
        .select('total_steps')
        .eq('user_id', m.user_id)
        .eq('date', todayStr)
        .maybeSingle();

      // Get cumulative steps during the battle period
      let stepsQuery = supabase
        .from('daily_summaries')
        .select('total_steps')
        .eq('user_id', m.user_id)
        .gte('date', startDate);

      if (endDate) {
        stepsQuery = stepsQuery.lte('date', endDate);
      }

      const { data: summaries } = await stepsQuery;
      const cumulativeSteps = (summaries || []).reduce((sum, s) => sum + (s.total_steps || 0), 0);

      memberRankings.push({
        userId: m.user_id,
        name: u.alias || u.name, // Support Alias
        email: u.email,
        profilePic: u.profile_pic || null,
        gender: u.gender || 'Male',
        role: m.role,
        todaySteps: todaySummary?.total_steps || 0,
        battleSteps: cumulativeSteps,
        streak: u.current_streak || 0,
        fraudScore: u.fraud_score || 0,
      });
    }

    // Sort by battle steps descending
    memberRankings.sort((a, b) => b.battleSteps - a.battleSteps);

    const groupTotalSteps = memberRankings.reduce((sum, item) => sum + item.todaySteps, 0);
    const battleTotalSteps = memberRankings.reduce((sum, item) => sum + item.battleSteps, 0);

    return res.json({
      groupId: group.id,
      groupName: group.name,
      targetSteps: group.target_steps,
      groupTotalSteps,
      battleTotalSteps,
      membersCount: memberRankings.length,
      leaderboard: memberRankings,
      battleDuration,
      startDate,
      endDate,
      status,
      daysRemaining,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error fetching leaderboard' });
  }
});

// POST /api/v1/groups/leave - Leave or Delete a group
router.post('/leave', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { groupId } = req.body;
  const userId = req.userId!;

  if (!groupId) return res.status(400).json({ error: 'Group ID is required' });

  try {
    // Check membership
    const { data: member, error: memberError } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();

    if (memberError || !member) {
      return res.status(404).json({ error: 'Membership not found' });
    }

    if (member.role === 'Owner') {
      // If Owner leaves, delete the group cascade
      const { error: deleteError } = await supabase
        .from('groups')
        .delete()
        .eq('id', groupId);

      if (deleteError) {
        console.error(deleteError);
        return res.status(500).json({ error: 'Failed to delete group by Owner' });
      }

      return res.json({ message: 'Group deleted successfully by Owner' });
    } else {
      // If regular Member leaves, delete member row
      const { error: leaveError } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId);

      if (leaveError) {
        console.error(leaveError);
        return res.status(500).json({ error: 'Failed to leave group' });
      }

      return res.json({ message: 'Left group successfully' });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error leaving group' });
  }
});

export default router;
