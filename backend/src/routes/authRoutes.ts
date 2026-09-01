import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { supabase } from '../database/supabase';
import { generateToken, authMiddleware, AuthRequest } from '../middleware/auth';
import { calculateAge, getAgeGroup, calculateBMI } from '../utils/cohorts';
import { formatDBUser } from '../utils/userFormatter';
import { authRateLimiter } from '../middleware/security';

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
router.post('/register', authRateLimiter, async (req: Request, res: Response) => {
  const { name, alias, profilePic, phone, password, dob, gender, location, healthProfile } = req.body;

  if (!phone || !password || !name || !dob || !gender || !location) {
    return res.status(400).json({ error: 'Missing required registration fields' });
  }

  if (!isValidPhoneNumber(phone)) {
    return res.status(400).json({ error: 'Invalid phone number format (must be 10 or 12 digits)' });
  }

  const normalizedPhone = normalizePhone(phone);
  const constructedEmail = `${normalizedPhone.replace('+', '')}@badakadam.com`;

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
      .eq('email', constructedEmail)
      .maybeSingle();

    if (existingUserByEmail) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const userId = `usr_${Date.now()}`;
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const age = calculateAge(dob);
    if (age < 15) {
      return res.status(400).json({ error: 'You must be at least 15 years old to register' });
    }
    const ageGroup = getAgeGroup(age);
    
    const heightCm = healthProfile?.heightCm || 170;
    const weightKg = healthProfile?.weightKg || 70;
    const dailyStepGoal = healthProfile?.dailyStepGoal || 10000;
    
    if (dailyStepGoal <= 0) {
      return res.status(400).json({ error: 'Daily step goal must be a positive number' });
    }
    
    const { bmi, category: bmiCategory } = calculateBMI(heightCm, weightKg);

    const newUser = {
      id: userId,
      name,
      alias: alias || null,
      profile_pic: profilePic || null,
      email: constructedEmail,
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
      daily_step_goal: dailyStepGoal,
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
router.post('/login', authRateLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email/Phone and password are required' });
  }

  try {
    const isEmail = email.includes('@');
    let query = supabase.from('users').select('*');
    if (isEmail) {
      query = query.eq('email', email.toLowerCase().trim());
    } else {
      const normalizedPhone = normalizePhone(email);
      query = query.eq('phone', normalizedPhone);
    }

    const { data: user, error } = await query.maybeSingle();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
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
router.post('/quick-login', authRateLimiter, async (req: Request, res: Response) => {
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

async function checkIsAdmin(userId: string, email: string): Promise<boolean> {
  const allowedAdminEmails = [
    'brijesh@badakadam.com',
    'superadmin@badakadam.com',
    'developer@badakadam.com',
    'admin@badakadam.com'
  ];

  if (allowedAdminEmails.includes(email.toLowerCase())) {
    return true;
  }

  const { data: member } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', 'admin_whitelist_group')
    .eq('user_id', userId)
    .maybeSingle();

  return !!member;
}

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
    
    // Check if dynamically or statically whitelisted admin
    const isAdmin = await checkIsAdmin(user.id, user.email);

    return res.json({ 
      user: {
        ...userWithoutPassword,
        is_admin: isAdmin
      } 
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error fetching user profile' });
  }
});

// Memory store for OTPs (keyed by normalized phone number)
const otpStore = new Map<string, { otp: string; expiresAt: number }>();

// POST /api/v1/auth/send-otp
router.post('/send-otp', async (req: Request, res: Response) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  const normalizedPhone = normalizePhone(phone);
  if (!isValidPhoneNumber(normalizedPhone)) {
    return res.status(400).json({ error: 'Invalid phone number format' });
  }

  // Generate a random 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity

  otpStore.set(normalizedPhone, { otp, expiresAt });

  console.log(`=========================================`);
  console.log(`💬 OTP Dispatch Simulator`);
  console.log(`📞 Phone: ${normalizedPhone}`);
  console.log(`🔑 Verification Code: ${otp}`);
  console.log(`=========================================`);

  return res.json({
    success: true,
    message: 'OTP sent successfully',
    simulatedOtp: otp
  });
});

// POST /api/v1/auth/verify-otp
router.post('/verify-otp', async (req: Request, res: Response) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) {
    return res.status(400).json({ error: 'Phone number and verification OTP are required' });
  }

  const normalizedPhone = normalizePhone(phone);
  const entry = otpStore.get(normalizedPhone);

  if (!entry) {
    return res.status(400).json({ error: 'No verification request found for this phone number' });
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(normalizedPhone);
    return res.status(400).json({ error: 'Verification code expired' });
  }

  if (entry.otp !== otp) {
    return res.status(400).json({ error: 'Invalid verification code' });
  }

  // Successfully verified! Clear OTP from store
  otpStore.delete(normalizedPhone);

  try {
    // Check if the user exists in the database
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'Database check failed' });
    }

    if (user) {
      // Existing user: generate token and perform seamless auto-login
      const token = generateToken(user.id);
      const formattedUser = formatDBUser(user);
      const { passwordHash: _, ...userWithoutPassword } = formattedUser;

      return res.json({
        verified: true,
        exists: true,
        token,
        user: userWithoutPassword,
      });
    }

    // New user: verify success, proceed to registration forms
    return res.json({
      verified: true,
      exists: false,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Verification error' });
  }
});

// PUT /api/v1/auth/profile
router.put('/profile', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { alias, gender, profilePic } = req.body;

  try {
    const updates: any = {};
    if (alias !== undefined) updates.alias = alias || null;
    if (gender !== undefined) updates.gender = gender;
    if (profilePic !== undefined) updates.profile_pic = profilePic || null;

    const { data: user, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select('*')
      .single();

    if (error) {
      console.error(error);
      return res.status(400).json({ error: 'Failed to update profile' });
    }

    const formattedUser = formatDBUser(user);
    const { passwordHash: _, ...userWithoutPassword } = formattedUser;

    return res.json({
      message: 'Profile updated successfully',
      user: userWithoutPassword,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error during profile update' });
  }
});

export default router;
