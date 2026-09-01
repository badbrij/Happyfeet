import { Router, Response } from 'express';
import { supabase } from '../database/supabase';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/v1/rewards/wallet
router.get('/wallet', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('walk_coins, current_streak, lifetime_steps')
      .eq('id', req.userId!)
      .maybeSingle();

    if (error || !user) return res.status(404).json({ error: 'User not found' });

    return res.json({
      walkCoins: user.walk_coins,
      currentStreak: user.current_streak,
      lifetimeSteps: user.lifetime_steps,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error fetching wallet metrics' });
  }
});

// GET /api/v1/rewards/marketplace
router.get('/marketplace', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const { data: dbRewards, error } = await supabase
      .from('rewards')
      .select('*')
      .order('cost_walk_coins', { ascending: true });

    if (error) {
      console.error(error);
    }

    const defaultItems = [
      { id: 'rw_1', title: '₹250 Gift Voucher', brand: 'Amazon', description: 'Applicable on any shopping order', costWalkCoins: 500, category: 'Voucher', imageUrl: 'https://img.icons8.com/color/96/amazon.png' },
      { id: 'rw_2', title: 'Free Delivery Pack', brand: 'Swiggy', description: '5 free deliveries on food orders', costWalkCoins: 250, category: 'Food', imageUrl: 'https://img.icons8.com/color/96/swiggy.png' },
      { id: 'rw_3', title: '20% Off Fitness Gear', brand: 'Decathlon', description: 'Valid on footwear & sports gear', costWalkCoins: 400, category: 'Fitness', imageUrl: 'https://img.icons8.com/color/96/decathlon.png' },
      { id: 'rw_4', title: 'Free Health Checkup', brand: 'Apollo', description: 'Full body diagnostic package', costWalkCoins: 1000, category: 'Health', imageUrl: 'https://img.icons8.com/color/96/hospital-3.png' },
      { id: 'rw_5', title: 'Noise Smartband Voucher', brand: 'Noise', description: '₹500 off on fitness smartwatches & bands', costWalkCoins: 750, category: 'Tech & Wearables', imageUrl: 'https://img.icons8.com/color/96/smart-watch.png' },
      { id: 'rw_6', title: '1-Month Cult.fit Pass', brand: 'Cult.fit', description: 'Unlimited access to workout centers', costWalkCoins: 650, category: 'Subscriptions', imageUrl: 'https://img.icons8.com/color/96/dumbbell.png' },
      { id: 'rw_7', title: 'Hyderabad Speedster Badge', brand: 'BadaKadam', description: 'Exclusive profile badge & 1.2x coin multiplier', costWalkCoins: 300, category: 'Badges', imageUrl: 'https://img.icons8.com/color/96/badge.png' }
    ];

    let formattedRewards = (dbRewards || []).map(r => ({
      id: r.id,
      title: r.title,
      brand: r.brand,
      description: r.description,
      costWalkCoins: r.cost_walk_coins,
      category: r.category,
      imageUrl: r.image_url,
    }));

    if (formattedRewards.length <= 4) {
      formattedRewards = defaultItems;
    }

    return res.json({ rewards: formattedRewards });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error fetching rewards' });
  }
});

// POST /api/v1/rewards/redeem
router.post('/redeem', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { rewardId } = req.body;
  const userId = req.userId!;

  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (userError || !user) return res.status(404).json({ error: 'User not found' });

    const { data: reward, error: rewardError } = await supabase
      .from('rewards')
      .select('*')
      .eq('id', rewardId)
      .maybeSingle();

    if (rewardError || !reward) return res.status(404).json({ error: 'Reward item not found' });

    if (user.walk_coins < reward.cost_walk_coins) {
      return res.status(400).json({
        error: `Insufficient WalkCoins balance. Needed: ${reward.cost_walk_coins}, Available: ${user.walk_coins}`,
      });
    }

    const remainingWalkCoins = user.walk_coins - reward.cost_walk_coins;
    
    // Deduct coins in DB
    const { error: updateError } = await supabase
      .from('users')
      .update({ walk_coins: remainingWalkCoins })
      .eq('id', userId);

    if (updateError) {
      console.error(updateError);
      return res.status(500).json({ error: 'Failed to complete transaction' });
    }

    // Log the redemption transaction
    await supabase.from('coin_transactions').insert([{
      id: `tx_redeem_${userId}_${Date.now()}`,
      user_id: userId,
      amount: -reward.cost_walk_coins,
      transaction_type: 'Redemption',
      description: `Redeemed ${reward.brand} ${reward.title}`,
    }]);

    const couponCode = `BK-${reward.brand.toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`;

    return res.json({
      message: 'Reward redeemed successfully!',
      remainingWalkCoins,
      reward: {
        title: reward.title,
        brand: reward.brand,
        couponCode,
        redeemedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error during redemption' });
  }
});

// GET /api/v1/rewards/wallet/history
router.get('/wallet/history', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  try {
    const { data: txs, error } = await supabase
      .from('coin_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to fetch wallet history' });
    }

    const formattedHistory = (txs || []).map(tx => ({
      id: tx.id,
      amount: tx.amount,
      transactionType: tx.transaction_type,
      description: tx.description,
      createdAt: tx.created_at
    }));

    return res.json({ history: formattedHistory });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error fetching wallet history' });
  }
});

// POST /api/v1/rewards/challenge/complete
router.post('/challenge/complete', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('walk_coins')
      .eq('id', userId)
      .maybeSingle();

    if (userError || !user) return res.status(404).json({ error: 'User not found' });

    const newBalance = user.walk_coins + 50;

    // Update in database
    const { error: updateError } = await supabase
      .from('users')
      .update({ walk_coins: newBalance })
      .eq('id', userId);

    if (updateError) {
      console.error(updateError);
      return res.status(500).json({ error: 'Failed to update coins balance' });
    }

    // Insert transaction audit
    await supabase.from('coin_transactions').insert([{
      id: `tx_chall_${userId}_${Date.now()}`,
      user_id: userId,
      amount: 50,
      transaction_type: 'ChallengeCompletion',
      description: 'Daily step challenge met (+50 Coins)',
    }]);

    return res.json({ success: true, newBalance });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error completing challenge' });
  }
});

export default router;

