import { Router, Response } from 'express';
import { db } from '../database/store';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/v1/rewards/wallet
router.get('/wallet', authMiddleware, (req: AuthRequest, res: Response) => {
  const user = db.users.get(req.userId!);
  if (!user) return res.status(404).json({ error: 'User not found' });

  return res.json({
    walkCoins: user.walkCoins,
    currentStreak: user.currentStreak,
    lifetimeSteps: user.lifetimeSteps,
  });
});

// GET /api/v1/rewards/marketplace
router.get('/marketplace', authMiddleware, (_req: AuthRequest, res: Response) => {
  return res.json({ rewards: db.rewards });
});

// POST /api/v1/rewards/redeem
router.post('/redeem', authMiddleware, (req: AuthRequest, res: Response) => {
  const { rewardId } = req.body;
  const user = db.users.get(req.userId!);

  if (!user) return res.status(404).json({ error: 'User not found' });

  const reward = db.rewards.find((r) => r.id === rewardId);
  if (!reward) return res.status(404).json({ error: 'Reward item not found' });

  if (user.walkCoins < reward.costWalkCoins) {
    return res.status(400).json({
      error: `Insufficient WalkCoins balance. Needed: ${reward.costWalkCoins}, Available: ${user.walkCoins}`,
    });
  }

  user.walkCoins -= reward.costWalkCoins;
  const couponCode = `HF-${reward.brand.toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`;

  return res.json({
    message: 'Reward redeemed successfully!',
    remainingWalkCoins: user.walkCoins,
    reward: {
      title: reward.title,
      brand: reward.brand,
      couponCode,
      redeemedAt: new Date().toISOString(),
    },
  });
});

export default router;
