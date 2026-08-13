import { supabase } from './supabase';
import bcrypt from 'bcryptjs';

export async function seedDatabase() {
  console.log('🏁 Checking if Supabase database requires seeding...');

  try {
    // 1. Check if users are empty
    const { count: userCount, error: userError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (userError) {
      console.warn('⚠️ Supabase connection warning (check table creation):', userError.message);
      return;
    }

    if (userCount && userCount > 0) {
      console.log('✅ Database already contains users. Skipping seed.');
      return;
    }

    console.log('🌱 Database is empty. Starting seed process...');

    const salt = bcrypt.genSaltSync(10);
    const defaultPasswordHash = bcrypt.hashSync('Password123!', salt);

    // Mock Users
    const seededUsers = [
      {
        id: 'usr_1',
        name: 'Brijesh Sharma',
        alias: 'Brij',
        email: 'brijesh@BadaKadam.com',
        phone: '+919876543210',
        password_hash: defaultPasswordHash,
        dob: '1988-06-15',
        age: 38,
        gender: 'Male',
        age_group: 'Mid Career (35-44)',
        country: 'India',
        state: 'Telangana',
        city: 'Hyderabad',
        locality: 'Gachibowli',
        height_cm: 178,
        weight_kg: 78,
        bmi: 24.6,
        bmi_category: 'Normal',
        occupation: 'IT Professional',
        daily_step_goal: 10000,
        fitness_tier: 'Advanced (10k-15k)',
        fraud_score: 0,
        walk_coins: 1450,
        current_streak: 21,
        lifetime_steps: 624500,
        profile_pic: 'Cheetah',
      },
      {
        id: 'usr_2',
        name: 'Priya Verma',
        alias: 'Priya',
        email: 'priya@BadaKadam.com',
        phone: '+919876543211',
        password_hash: defaultPasswordHash,
        dob: '1992-09-20',
        age: 33,
        gender: 'Female',
        age_group: 'Young Adult (25-34)',
        country: 'India',
        state: 'Telangana',
        city: 'Hyderabad',
        locality: 'Gachibowli',
        height_cm: 165,
        weight_kg: 58,
        bmi: 21.3,
        bmi_category: 'Normal',
        occupation: 'Doctor',
        daily_step_goal: 12000,
        fitness_tier: 'Advanced (10k-15k)',
        fraud_score: 0,
        walk_coins: 2100,
        current_streak: 34,
        lifetime_steps: 890000,
        profile_pic: 'Rabbit',
      },
      {
        id: 'usr_3',
        name: 'Rahul Mehta',
        alias: 'Rahul',
        email: 'rahul@BadaKadam.com',
        phone: '+919876543212',
        password_hash: defaultPasswordHash,
        dob: '1985-03-10',
        age: 41,
        gender: 'Male',
        age_group: 'Mid Career (35-44)',
        country: 'India',
        state: 'Telangana',
        city: 'Hyderabad',
        locality: 'Gachibowli',
        height_cm: 172,
        weight_kg: 82,
        bmi: 27.7,
        bmi_category: 'Overweight',
        occupation: 'IT Professional',
        daily_step_goal: 10000,
        fitness_tier: 'Moderate (5k-10k)',
        fraud_score: 5,
        walk_coins: 980,
        current_streak: 12,
        lifetime_steps: 412000,
        profile_pic: 'Bull',
      },
      {
        id: 'usr_4',
        name: 'Amit Patel',
        alias: 'Amit',
        email: 'amit@BadaKadam.com',
        phone: '+919876543213',
        password_hash: defaultPasswordHash,
        dob: '1983-11-05',
        age: 42,
        gender: 'Male',
        age_group: 'Mid Career (35-44)',
        country: 'India',
        state: 'Maharashtra',
        city: 'Mumbai',
        locality: 'Bandra',
        height_cm: 180,
        weight_kg: 75,
        bmi: 23.1,
        bmi_category: 'Normal',
        occupation: 'Entrepreneur',
        daily_step_goal: 15000,
        fitness_tier: 'Elite (15k+)',
        fraud_score: 0,
        walk_coins: 3400,
        current_streak: 45,
        lifetime_steps: 1250000,
        profile_pic: 'Eagle',
      },
      {
        id: 'usr_5',
        name: 'Ananya Rao',
        alias: 'Ananya',
        email: 'ananya@BadaKadam.com',
        phone: '+919876543214',
        password_hash: defaultPasswordHash,
        dob: '2001-04-18',
        age: 25,
        gender: 'Female',
        age_group: 'Young Adult (25-34)',
        country: 'India',
        state: 'Karnataka',
        city: 'Bangalore',
        locality: 'Koramangala',
        height_cm: 160,
        weight_kg: 52,
        bmi: 20.3,
        bmi_category: 'Normal',
        occupation: 'Student',
        daily_step_goal: 8000,
        fitness_tier: 'Moderate (5k-10k)',
        fraud_score: 0,
        walk_coins: 620,
        current_streak: 7,
        lifetime_steps: 180000,
        profile_pic: 'Falcon',
      }
    ];

    // Bulk Seed Users
    const { error: usersSeedError } = await supabase
      .from('users')
      .insert(seededUsers);

    if (usersSeedError) {
      console.error('Failed to seed users table:', usersSeedError.message);
      return;
    }
    console.log('✅ Seeded Users table.');

    // Seed Daily Summaries for each user
    const summaries = [];
    const today = new Date();
    for (const u of seededUsers) {
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];

        let steps = 8000 + Math.floor(Math.random() * 6000);
        if (u.id === 'usr_4') steps = 16000 + Math.floor(Math.random() * 3000);
        if (u.id === 'usr_1' && i === 0) steps = 14521; // Match OCR doc

        summaries.push({
          user_id: u.id,
          date: dateStr,
          total_steps: steps,
          total_distance_meters: Math.round(steps * 0.75),
          total_calories: Math.round(steps * 0.04),
          total_active_minutes: Math.round(steps / 100),
          goal_met: steps >= u.daily_step_goal,
        });
      }
    }

    const { error: summariesSeedError } = await supabase
      .from('daily_summaries')
      .insert(summaries);

    if (summariesSeedError) console.error('Failed to seed daily_summaries:', summariesSeedError.message);
    else console.log('✅ Seeded Daily Summaries.');

    // Seed Groups
    const sharmaGroup = {
      id: 'grp_1',
      name: 'Sharma Fitness Warriors',
      description: 'Family & friends daily 10k step challenge!',
      owner_id: 'usr_1',
      invite_code: 'WALK123',
      group_type: 'Family',
      target_steps: 1000000,
      current_steps: 843000,
    };

    await supabase.from('groups').insert([sharmaGroup]);

    // Seed Group Members
    const groupMembers = [
      { group_id: 'grp_1', user_id: 'usr_1', role: 'Owner' },
      { group_id: 'grp_1', user_id: 'usr_2', role: 'Admin' },
      { group_id: 'grp_1', user_id: 'usr_3', role: 'Member' },
    ];
    await supabase.from('group_members').insert(groupMembers);
    console.log('✅ Seeded Sharma Fitness Warriors group & members.');

    // Seed Marketplace Rewards
    const seededRewards = [
      { id: 'rew_1', title: '₹250 Gift Voucher', brand: 'Amazon', description: 'Applicable on any shopping order', cost_walk_coins: 500, category: 'Voucher', image_url: 'https://img.icons8.com/color/96/amazon.png' },
      { id: 'rew_2', title: 'Free Delivery Pack', brand: 'Swiggy', description: '5 free deliveries on food orders', cost_walk_coins: 250, category: 'Food', image_url: 'https://img.icons8.com/color/96/swiggy.png' },
      { id: 'rew_3', title: '20% Off Fitness Gear', brand: 'Decathlon', description: 'Valid on footwear & sports gear', cost_walk_coins: 400, category: 'Fitness', image_url: 'https://img.icons8.com/color/96/decathlon.png' },
      { id: 'rew_4', title: 'Free Health Checkup', brand: 'Apollo', description: 'Full body diagnostic package', cost_walk_coins: 1000, category: 'Insurance', image_url: 'https://img.icons8.com/color/96/hospital-3.png' },
    ];
    await supabase.from('rewards').insert(seededRewards);
    console.log('✅ Seeded Rewards catalog.');

    console.log('🎉 Database seeding complete!');
  } catch (err) {
    console.error('❌ Unexpected seeding error:', err);
  }
}
