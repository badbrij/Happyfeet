import { Router, Response } from 'express';
import { supabase } from '../database/supabase';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/v1/groups - Create a group
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { name, description, groupType, targetSteps, allowedPhones } = req.body;
  const userId = req.userId!;

  if (!name) return res.status(400).json({ error: 'Group name is required' });

  try {
    const groupId = `grp_${Date.now()}`;
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const newGroup = {
      id: groupId,
      name,
      description: description || '',
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
        description: newGroup.description,
        ownerId: newGroup.owner_id,
        inviteCode: newGroup.invite_code,
        groupType: newGroup.group_type,
        targetSteps: newGroup.target_steps,
        currentSteps: newGroup.current_steps,
        allowedPhones: newGroup.allowed_phones,
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

      userGroups.push({
        id: g.id,
        name: g.name,
        description: g.description,
        ownerId: g.owner_id,
        inviteCode: g.invite_code,
        groupType: g.group_type,
        targetSteps: g.target_steps,
        currentSteps: g.current_steps,
        allowedPhones: g.allowed_phones,
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

    const { data: members, error: membersError } = await supabase
      .from('group_members')
      .select('user_id, role, users(name, alias, current_streak, profile_pic)')
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

      memberRankings.push({
        userId: m.user_id,
        name: u.alias || u.name, // Support Alias
        profilePic: u.profile_pic || null,
        role: m.role,
        todaySteps: todaySummary?.total_steps || 0,
        streak: u.current_streak || 0,
      });
    }

    // Sort by steps descending
    memberRankings.sort((a, b) => b.todaySteps - a.todaySteps);

    const groupTotalSteps = memberRankings.reduce((sum, item) => sum + item.todaySteps, 0);

    return res.json({
      groupId: group.id,
      groupName: group.name,
      targetSteps: group.target_steps,
      groupTotalSteps,
      membersCount: memberRankings.length,
      leaderboard: memberRankings,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error fetching leaderboard' });
  }
});

export default router;
