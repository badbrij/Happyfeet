import { Router, Response } from 'express';
import { db } from '../database/store';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { Group } from '../types';

const router = Router();

// POST /api/v1/groups - Create a group
router.post('/', authMiddleware, (req: AuthRequest, res: Response) => {
  const { name, description, groupType, targetSteps, allowedPhones } = req.body;
  const userId = req.userId!;

  if (!name) return res.status(400).json({ error: 'Group name is required' });

  const groupId = `grp_${Date.now()}`;
  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

  const newGroup: Group = {
    id: groupId,
    name,
    description: description || '',
    ownerId: userId,
    inviteCode,
    groupType: groupType || 'Friends',
    members: [{ userId, role: 'Owner', joinedAt: new Date().toISOString() }],
    targetSteps: targetSteps || 1000000,
    currentSteps: 0,
    allowedPhones: allowedPhones || [],
    createdAt: new Date().toISOString(),
  };

  db.groups.set(groupId, newGroup);
  return res.status(201).json({ message: 'Group created successfully', group: newGroup });
});

// GET /api/v1/groups - List user's groups
router.get('/', authMiddleware, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const userGroups: Group[] = [];

  for (const [, group] of db.groups) {
    if (group.members.some((m) => m.userId === userId)) {
      userGroups.push(group);
    }
  }

  return res.json({ groups: userGroups });
});

// POST /api/v1/groups/join - Join group by invite code
router.post('/join', authMiddleware, (req: AuthRequest, res: Response) => {
  const { inviteCode } = req.body;
  const userId = req.userId!;

  if (!inviteCode) return res.status(400).json({ error: 'Invite code is required' });

  let targetGroup: Group | null = null;
  const codeStr = String(inviteCode).toUpperCase();
  for (const [, group] of db.groups) {
    if (group.inviteCode === codeStr) {
      targetGroup = group;
      break;
    }
  }

  if (!targetGroup) return res.status(404).json({ error: 'Invalid invite code' });

  if (targetGroup.members.some((m) => m.userId === userId)) {
    return res.status(400).json({ error: 'Already a member of this group' });
  }

  const user = db.users.get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Enforce whitelist check if allowedPhones is populated
  if (targetGroup.allowedPhones && targetGroup.allowedPhones.length > 0) {
    if (!targetGroup.allowedPhones.includes(user.phone)) {
      return res.status(403).json({ error: 'Your mobile number is not authorized to join this group.' });
    }
  }

  targetGroup.members.push({ userId, role: 'Member', joinedAt: new Date().toISOString() });
  return res.json({ message: 'Joined group successfully', group: targetGroup });
});

// GET /api/v1/groups/:id/leaderboard - Group leaderboard
router.get('/:id/leaderboard', authMiddleware, (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const group = db.groups.get(id);

  if (!group) return res.status(404).json({ error: 'Group not found' });

  const todayStr = new Date().toISOString().split('T')[0];

  const memberRankings = group.members.map((m) => {
    const user = db.users.get(m.userId);
    const summaries = db.dailySummaries.get(m.userId) || [];
    const today = summaries.find((s) => s.date === todayStr);

    return {
      userId: m.userId,
      name: user?.name || 'Unknown',
      role: m.role,
      todaySteps: today?.totalSteps || 0,
      streak: user?.currentStreak || 0,
    };
  });

  memberRankings.sort((a, b) => b.todaySteps - a.todaySteps);

  const groupTotalSteps = memberRankings.reduce((sum, item) => sum + item.todaySteps, 0);

  return res.json({
    groupId: group.id,
    groupName: group.name,
    targetSteps: group.targetSteps,
    groupTotalSteps,
    membersCount: group.members.length,
    leaderboard: memberRankings,
  });
});

export default router;
