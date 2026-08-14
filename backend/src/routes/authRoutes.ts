import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { supabase } from '../database/supabase';
import { generateToken, authMiddleware, AuthRequest } from '../middleware/auth';
import { calculateAge, getAgeGroup, calculateBMI } from '../utils/cohorts';
import { formatDBUser } from '../utils/userFormatter';

const router = Router();

export function isValidPhoneNumber(phone: string): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  return /^\+?\d{10,12}$/.test(cleaned);
}

export function normalizePhone(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  cleaned = cleaned.replace(/[^0-9+]/g, '');
  if (cleaned.length === 10 && /^\d+$/.test(cleaned)) {
    cleaned = '+91' + cleaned;
  }
  if (cleaned.length === 12 && cleaned.startsWith('91') && /^\d+$/.test(cleaned)) {
    cleaned = '+' + cleaned;
  }
  return cleaned;
}

// POST /api/v1/auth/register
router.post('/register', async (req: Request, res: Response) => {
  const { name, alias, profilePic, email, phone, password, dob, gender, location, healthProfile } = req.body;

  if (!phone || !password || !name || !dob || !gender || !location) {
    return res.status(400).json({ error: 'Missing required registration fields' });
  }

  if (!isValidPhoneNumber(phone)) {
    return res.status(400).json({ error: 'Invalid phone number format (must be 10 or 12 digits)' });
  }

  const normalizedPhone = normalizePhone(phone);

  try {
    // Check if phone already exists
    const { data: existingUserByPhone } = await supabase
      .from('users')
      .select('id')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (existingUserByPhone) {
      return res.status(400).json({ error: 'User with this mobile number already exists' });
    }

    // Check if email already exists
    const { data: existingUserByEmail } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existingUserByEmail) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const userId = `usr_${Date.now()}`;
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const age = calculateAge(dob);
    const ageGroup = getAgeGroup(age);
    
    const heightCm = healthProfile?.heightCm || 170;
    const weightKg = healthProfile?.weightKg || 70;
    const { bmi, category: bmiCategory } = calculateBMI(heightCm, weightKg);

    const newUser = {
      id: userId,
      name,
      alias: alias || null,
      profile_pic: profilePic || null,
      email: email.toLowerCase(),
      phone: normalizedPhone,
      password_hash: passwordHash,
      dob,
      age,
      gender,
      age_group: ageGroup,
      country: location.country || 'India',
      state: location.state || 'Telangana',
      city: location.city || 'Hyderabad',
      locality: location.locality || 'Gachibowli',
      pincode: location.pincode || null,
      height_cm: heightCm,
      weight_kg: weightKg,
      bmi,
      bmi_category: bmiCategory,
      occupation: healthProfile?.occupation || 'Other',
      daily_step_goal: healthProfile?.dailyStepGoal || 10000,
      fitness_tier: 'Beginner (0-5k)',
      fraud_score: 0,
      walk_coins: 100, // Signup bonus
      current_streak: 1,
      lifetime_steps: 0,
    };

    const { error: insertError } = await supabase
      .from('users')
      .insert([newUser]);

    if (insertError) {
      console.error(insertError);
      return res.status(500).json({ error: 'Failed to create user profile' });
    }

    // Log the Signup Welcome Bonus transaction
    await supabase.from('coin_transactions').insert([{
      id: `tx_signup_${userId}_${Date.now()}`,
      user_id: userId,
      amount: 100,
      transaction_type: 'Signup',
      description: 'Signup Welcome Bonus',
    }]);

    const token = generateToken(userId);
    const formattedUser = formatDBUser(newUser);
    const { passwordHash: _, ...userWithoutPassword } = formattedUser;

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: userWithoutPassword,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error during registration' });
  }
});

// POST /api/v1/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user.id);
    const formattedUser = formatDBUser(user);
    const { passwordHash: _, ...userWithoutPassword } = formattedUser;

    return res.json({
      message: 'Login successful',
      token,
      user: userWithoutPassword,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error during login' });
  }
});

// POST /api/v1/auth/quick-login
router.post('/quick-login', async (req: Request, res: Response) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: 'Phone number or Email is required' });
  }

  const isEmail = phone.includes('@');
  let query = supabase.from('users').select('*');

  if (isEmail) {
    query = query.eq('email', phone.toLowerCase().trim());
  } else {
    if (!isValidPhoneNumber(phone)) {
      return res.status(400).json({ error: 'Invalid phone number format (must be 10 or 12 digits)' });
    }
    const normalizedPhone = normalizePhone(phone);
    query = query.eq('phone', normalizedPhone);
  }

  try {
    const { data: user, error } = await query.maybeSingle();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const token = generateToken(user.id);
    const formattedUser = formatDBUser(user);
    const { passwordHash: _, ...userWithoutPassword } = formattedUser;

    return res.json({
      message: 'Quick login successful',
      token,
      user: userWithoutPassword,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error during quick login' });
  }
});

// GET /api/v1/auth/me
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.userId!)
      .maybeSingle();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const formattedUser = formatDBUser(user);
    const { passwordHash: _, ...userWithoutPassword } = formattedUser;
    return res.json({ user: userWithoutPassword });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error fetching user profile' });
  }
});

export default router;
