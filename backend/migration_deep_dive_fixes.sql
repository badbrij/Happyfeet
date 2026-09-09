-- ========================================================
-- BadaKadam Database Migration Script (Deep Dive Fixes)
-- Run this script against your Supabase PostgreSQL database
-- ========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ADD MISSING COLUMNS TO USERS TABLE
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS alias VARCHAR(100);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS profile_pic TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS height_cm NUMERIC(5,2) DEFAULT 170.0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(5,2) DEFAULT 70.0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bmi NUMERIC(4,1) DEFAULT 24.2;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bmi_category VARCHAR(50) DEFAULT 'Normal';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS occupation VARCHAR(100) DEFAULT 'Other';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS daily_step_goal INT DEFAULT 10000;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS fitness_tier VARCHAR(50) DEFAULT 'Beginner (0-5k)';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"push_enabled": true, "reminders": true, "battle_alerts": true, "reward_alerts": true}'::jsonb;

-- 2. ADD MISSING COLUMNS TO GROUPS TABLE
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS allowed_phones TEXT[] DEFAULT '{}';
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS group_pic_url TEXT;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS current_steps BIGINT DEFAULT 0;

-- 3. CREATE DAILY SUMMARIES TABLE (Used by stepRoutes.ts & groupRoutes.ts)
CREATE TABLE IF NOT EXISTS public.daily_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_steps INT NOT NULL DEFAULT 0,
  total_distance_meters INT DEFAULT 0,
  total_calories INT DEFAULT 0,
  total_active_minutes INT DEFAULT 0,
  goal_met BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_date_summary UNIQUE (user_id, date)
);

-- Alias view/table for backwards compatibility if daily_steps is referenced
CREATE TABLE IF NOT EXISTS public.daily_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_steps INT NOT NULL DEFAULT 0,
  total_distance_meters INT DEFAULT 0,
  total_calories INT DEFAULT 0,
  total_active_minutes INT DEFAULT 0,
  goal_met BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_date_steps UNIQUE (user_id, date)
);

-- 4. CREATE STEP LOGS TABLE (For granular sync entries & anti-cheat audit)
CREATE TABLE IF NOT EXISTS public.step_logs (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  date DATE NOT NULL,
  count INT DEFAULT 0,
  distance_meters INT DEFAULT 0,
  calories INT DEFAULT 0,
  active_minutes INT DEFAULT 0,
  source VARCHAR(50) DEFAULT 'Manual',
  is_flagged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CREATE COIN TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.coin_transactions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount INT NOT NULL,
  transaction_type VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on new tables
ALTER TABLE public.daily_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.step_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;

-- Permissive policies for API Service Role / backend access
DROP POLICY IF EXISTS "Public access to daily_summaries" ON public.daily_summaries;
CREATE POLICY "Public access to daily_summaries" ON public.daily_summaries FOR ALL USING (true);

DROP POLICY IF EXISTS "Public access to step_logs" ON public.step_logs;
CREATE POLICY "Public access to step_logs" ON public.step_logs FOR ALL USING (true);

DROP POLICY IF EXISTS "Public access to coin_transactions" ON public.coin_transactions;
CREATE POLICY "Public access to coin_transactions" ON public.coin_transactions FOR ALL USING (true);
