-- SQL Schema for BadaKadam Platform

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    alias TEXT,
    profile_pic TEXT,
    email TEXT UNIQUE NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    dob DATE NOT NULL,
    age INTEGER,
    gender TEXT NOT NULL,
    age_group TEXT NOT NULL,
    country TEXT NOT NULL,
    state TEXT NOT NULL,
    city TEXT NOT NULL,
    locality TEXT NOT NULL,
    pincode TEXT,
    height_cm REAL NOT NULL,
    weight_kg REAL NOT NULL,
    bmi REAL NOT NULL,
    bmi_category TEXT NOT NULL,
    occupation TEXT NOT NULL,
    daily_step_goal INTEGER NOT NULL,
    fitness_tier TEXT NOT NULL,
    fraud_score INTEGER DEFAULT 0,
    walk_coins INTEGER DEFAULT 100,
    current_streak INTEGER DEFAULT 1,
    lifetime_steps INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Groups Table
CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    owner_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    invite_code TEXT UNIQUE NOT NULL,
    group_type TEXT NOT NULL,
    target_steps INTEGER DEFAULT 1000000,
    current_steps INTEGER DEFAULT 0,
    allowed_phones TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Group Members Junction Table
CREATE TABLE IF NOT EXISTS group_members (
    group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- 'Owner', 'Admin', 'Member'
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);

-- 4. Step Logs Table (raw daily sync items)
CREATE TABLE IF NOT EXISTS step_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL,
    date DATE NOT NULL,
    count INTEGER NOT NULL,
    distance_meters REAL NOT NULL,
    calories REAL NOT NULL,
    active_minutes REAL NOT NULL,
    source TEXT NOT NULL, -- 'AppleHealthKit' | 'GoogleHealthConnect' | 'Manual'
    is_flagged BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Daily Summaries Table (cached steps per user per day for fast ranking)
CREATE TABLE IF NOT EXISTS daily_summaries (
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_steps INTEGER NOT NULL,
    total_distance_meters REAL NOT NULL,
    total_calories REAL NOT NULL,
    total_active_minutes REAL NOT NULL,
    goal_met BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (user_id, date)
);

-- 6. Rewards Table (Marketplace Items)
CREATE TABLE IF NOT EXISTS rewards (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    brand TEXT NOT NULL,
    description TEXT,
    cost_walk_coins INTEGER NOT NULL,
    category TEXT NOT NULL,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
