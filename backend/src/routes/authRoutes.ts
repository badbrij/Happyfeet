import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../database/store';
import { generateToken, authMiddleware, AuthRequest } from '../middleware/auth';
import { calculateAge, getAgeGroup, calculateBMI } from '../utils/cohorts';
import { User } from '../types';

const router = Router();

// POST /api/v1/auth/register
router.post('/register', (req: Request, res: Response) => {
  const { name, alias, profilePic, email, phone, password, dob, gender, location, healthProfile } = req.body;

  if (!phone || !password || !name || !dob || !gender || !location) {
    return res.status(400).json({ error: 'Missing required registration fields' });
  }

  // Check if phone already exists
  for (const [, user] of db.users) {
    if (user.phone === phone) {
      return res.status(400).json({ error: 'User with this mobile number already exists' });
    }
  }

  const userId = `usr_${Date.now()}`;
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);

  const age = calculateAge(dob);
  const ageGroup = getAgeGroup(age);
  
  const heightCm = healthProfile?.heightCm || 170;
  const weightKg = healthProfile?.weightKg || 70;
  const { bmi, category: bmiCategory } = calculateBMI(heightCm, weightKg);

  const newUser: User = {
    id: userId,
    name,
    alias: alias || undefined,
    profilePic: profilePic || undefined,
    email: email.toLowerCase(),
    phone: phone || '',
    passwordHash,
    dob,
    age,
    gender,
    ageGroup,
    location: {
      country: location.country || 'India',
      state: location.state || 'Telangana',
      city: location.city || 'Hyderabad',
      locality: location.locality || 'Gachibowli',
      pincode: location.pincode,
    },
    healthProfile: {
      heightCm,
      weightKg,
      bmi,
      bmiCategory,
      occupation: healthProfile?.occupation || 'Other',
      dailyStepGoal: healthProfile?.dailyStepGoal || 10000,
      fitnessTier: 'Beginner (0-5k)',
    },
    fraudScore: 0,
    walkCoins: 100, // Signup bonus
    currentStreak: 1,
    lifetimeSteps: 0,
    createdAt: new Date().toISOString(),
  };

  db.users.set(userId, newUser);
  db.dailySummaries.set(userId, []);

  const token = generateToken(userId);
  const { passwordHash: _, ...userWithoutPassword } = newUser;

  return res.status(201).json({
    message: 'User registered successfully',
    token,
    user: userWithoutPassword,
  });
});

// POST /api/v1/auth/login
router.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  let foundUser: User | null = null;
  for (const [, user] of db.users) {
    if (user.email === email.toLowerCase()) {
      foundUser = user;
      break;
    }
  }

  if (!foundUser || !bcrypt.compareSync(password, foundUser.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = generateToken(foundUser.id);
  const { passwordHash: _, ...userWithoutPassword } = foundUser;

  return res.json({
    message: 'Login successful',
    token,
    user: userWithoutPassword,
  });
});

// POST /api/v1/auth/quick-login
router.post('/quick-login', (req: Request, res: Response) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  let foundUser: User | null = null;
  for (const [, user] of db.users) {
    if (user.phone === phone) {
      foundUser = user;
      break;
    }
  }

  if (!foundUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  const token = generateToken(foundUser.id);
  const { passwordHash: _, ...userWithoutPassword } = foundUser;

  return res.json({
    message: 'Quick login successful',
    token,
    user: userWithoutPassword,
  });
});

// GET /api/v1/auth/me
router.get('/me', authMiddleware, (req: AuthRequest, res: Response) => {
  const user = db.users.get(req.userId!);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { passwordHash: _, ...userWithoutPassword } = user;
  return res.json({ user: userWithoutPassword });
});

export default router;
