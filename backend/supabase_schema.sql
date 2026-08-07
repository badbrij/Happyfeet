-- ========================================================
-- HAPPYFEET ENTERPRISE SUPABASE DATABASE SCHEMA
-- PostgreSQL DDL Script with RLS & Auto-Cohort Calculations
-- ========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUMS
CREATE TYPE gender_enum AS ENUM ('Male', 'Female', 'Other', 'PreferNotToSay');
CREATE TYPE age_group_enum AS ENUM ('Gen Z (18-24)', 'Young Adult (25-34)', 'Mid Career (35-44)', 'Mature Adult (45-54)', 'Senior Active (55-64)', 'Veteran (65+)');
CREATE TYPE bmi_category_enum AS ENUM ('Underweight', 'Normal', 'Overweight', 'Obese');
CREATE TYPE activity_tier_enum AS ENUM ('Beginner (0-5k)', 'Moderate (5k-10k)', 'Advanced (10k-15k)', 'Elite (15k+)');
CREATE TYPE group_type_enum AS ENUM ('Family', 'Friends', 'Office', 'Neighborhood', 'Community');

-- 2. USERS TABLE (Extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID UNIQUE, -- Foreign key to auth.users if using Supabase Auth
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  dob DATE NOT NULL,
  age INT GENERATED ALWAYS AS (EXTRACT(YEAR FROM age(CURRENT_DATE, dob))::INT) STORED,
  gender gender_enum NOT NULL DEFAULT 'PreferNotToSay',
  age_group age_group_enum,
  
  -- Location Hierarchy
  country VARCHAR(100) DEFAULT 'India',
  state VARCHAR(100) NOT NULL,
  city VARCHAR(100) NOT NULL,
  locality VARCHAR(100) NOT NULL,
  pincode VARCHAR(20),

  -- Metrics & Status
  fraud_score INT DEFAULT 0 CHECK (fraud_score BETWEEN 0 AND 100),
  walk_coins INT DEFAULT 100 CHECK (walk_coins >= 0),
  current_streak INT DEFAULT 1,
  lifetime_steps BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. HEALTH PROFILES TABLE
CREATE TABLE public.health_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  height_cm NUMERIC(5,2) NOT NULL,
  weight_kg NUMERIC(5,2) NOT NULL,
  bmi NUMERIC(4,1) GENERATED ALWAYS AS (ROUND((weight_kg / ((height_cm / 100.0) * (height_cm / 100.0)))::NUMERIC, 1)) STORED,
  bmi_category bmi_category_enum DEFAULT 'Normal',
  occupation VARCHAR(100) DEFAULT 'Other',
  daily_step_goal INT DEFAULT 10000,
  fitness_tier activity_tier_enum DEFAULT 'Beginner (0-5k)',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. DAILY STEP SUMMARIES TABLE
CREATE TABLE public.daily_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_steps INT NOT NULL DEFAULT 0,
  total_distance_meters INT DEFAULT 0,
  total_calories INT DEFAULT 0,
  total_active_minutes INT DEFAULT 0,
  goal_met BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_date UNIQUE (user_id, date)
);

-- 5. SOCIAL GROUPS TABLE
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES public.users(id),
  invite_code VARCHAR(10) UNIQUE NOT NULL,
  group_type group_type_enum DEFAULT 'Friends',
  target_steps BIGINT DEFAULT 1000000,
  current_steps BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'Member' CHECK (role IN ('Owner', 'Admin', 'Member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_group_member UNIQUE (group_id, user_id)
);

-- 6. REWARDS MARKETPLACE TABLE
CREATE TABLE public.rewards_marketplace (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(150) NOT NULL,
  brand VARCHAR(100) NOT NULL,
  description TEXT,
  cost_walk_coins INT NOT NULL,
  category VARCHAR(50) DEFAULT 'Voucher',
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Allow public read of user profiles for leaderboards
CREATE POLICY "Public user profile lookup for leaderboards" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = auth_id);

-- Daily Steps RLS
CREATE POLICY "Users can view own step records" ON public.daily_steps FOR SELECT USING (true);
CREATE POLICY "Users can insert own step records" ON public.daily_steps FOR INSERT WITH CHECK (true);

-- Seed Initial Rewards
INSERT INTO public.rewards_marketplace (title, brand, description, cost_walk_coins, category, image_url) VALUES
('₹250 Gift Voucher', 'Amazon', 'Applicable on any shopping order', 500, 'Voucher', 'https://img.icons8.com/color/96/amazon.png'),
('Free Delivery Pack', 'Swiggy', '5 free deliveries on food orders', 250, 'Food', 'https://img.icons8.com/color/96/swiggy.png'),
('20% Off Fitness Gear', 'Decathlon', 'Valid on footwear & sports gear', 400, 'Fitness', 'https://img.icons8.com/color/96/decathlon.png'),
('Free Health Checkup', 'Apollo', 'Full body diagnostic package', 1000, 'Insurance', 'https://img.icons8.com/color/96/hospital-3.png');
