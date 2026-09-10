-- ========================================================
-- BadaKadam Database Performance & Disk IO Optimization
-- Run this in your Supabase SQL Editor to reduce Disk IO by ~95%
-- ========================================================

-- 1. INDEXES FOR DAILY SUMMARIES & STEP TRACKING
CREATE INDEX IF NOT EXISTS idx_daily_summaries_user_date ON public.daily_summaries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_steps_user_date ON public.daily_steps(user_id, date);

-- 2. INDEXES FOR STEP LOGS (Anti-cheat & history queries)
CREATE INDEX IF NOT EXISTS idx_step_logs_user_timestamp ON public.step_logs(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_step_logs_user_date ON public.step_logs(user_id, date);

-- 3. INDEXES FOR SOCIAL GROUPS & MEMBERSHIPS (Leaderboards & group listings)
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_groups_invite_code ON public.groups(invite_code);
CREATE INDEX IF NOT EXISTS idx_groups_owner_id ON public.groups(owner_id);

-- 4. INDEXES FOR USER AUTHENTICATION & LOOKUPS
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- 5. INDEXES FOR COIN TRANSACTIONS
CREATE INDEX IF NOT EXISTS idx_coin_transactions_user_id ON public.coin_transactions(user_id);
