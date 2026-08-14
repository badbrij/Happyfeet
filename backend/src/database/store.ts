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

    // We check each mock user individually and insert if they do not exist
    const salt = bcrypt.genSaltSync(10);
    const defaultPasswordHash = bcrypt.hashSync('Password123!', salt);

    // Clean up existing demo records first to ensure consistent updates of demo values
    const demoIds = ['usr_1', 'usr_2', 'usr_3', 'usr_4', 'usr_5'];
    await supabase.from('daily_summaries').delete().in('user_id', demoIds);
    const txIds = ['tx_goal_1', 'tx_goal_2', 'tx_streak_1', 'tx_challenge_1', 'tx_redeem_1', 'tx_goal_3', 'tx_challenge_2', 'tx_redeem_2'];
    await supabase.from('coin_transactions').delete().in('id', txIds);
    await supabase.from('coin_transactions').delete().in('user_id', demoIds);
    await supabase.from('group_members').delete().in('user_id', demoIds);
    await supabase.from('users').delete().in('id', demoIds);

    // Mock Users
    const seededUsers = [
      {
        id: 'usr_1',
        name: 'Brijesh Sharma',
        alias: 'Brij',
        email: 'brijesh@badakadam.com',
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
        walk_coins: 1050,
        current_streak: 21,
        lifetime_steps: 624500,
        profile_pic: 'Cheetah',
      },
      {
        id: 'usr_2',
        name: 'Priya Verma',
        alias: 'Priya',
        email: 'priya@badakadam.com',
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
        walk_coins: 1800,
        current_streak: 34,
        lifetime_steps: 890000,
        profile_pic: 'Rabbit',
      },
      {
        id: 'usr_3',
        name: 'Rahul Mehta',
        alias: 'Rahul',
        email: 'rahul@badakadam.com',
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
        walk_coins: 1450,
        current_streak: 12,
        lifetime_steps: 412000,
        profile_pic: 'Bull',
      },
      {
        id: 'usr_4',
        name: 'Amit Patel',
        alias: 'Amit',
        email: 'amit@badakadam.com',
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
        daily_step_goal: 10000,
        fitness_tier: 'Elite (15k+)',
        fraud_score: 0,
        walk_coins: 275,
        current_streak: 45,
        lifetime_steps: 1250000,
        profile_pic: 'Eagle',
      },
      {
        id: 'usr_5',
        name: 'Ananya Rao',
        alias: 'Ananya',
        email: 'ananya@badakadam.com',
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
        walk_coins: 800,
        current_streak: 7,
        lifetime_steps: 180000,
        profile_pic: 'Falcon',
      }
    ];

    for (const u of seededUsers) {
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('email', u.email)
        .maybeSingle();

      if (checkError) {
        console.error(`Error checking user ${u.name}:`, checkError.message);
        continue;
      }

      if (!existingUser) {
        console.log(`🌱 Seeding missing demo user: ${u.name}...`);
        const { error: insertError } = await supabase.from('users').insert([u]);
        if (insertError) {
          console.error(`Failed to insert demo user ${u.name}:`, insertError.message);
          continue;
        }

        // Seed Daily Summaries for this user
        const summaries = [];
        const today = new Date();
        for (let i = 0; i < 7; i++) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];

          let steps = 8000 + Math.floor(Math.random() * 6000);
          if (i === 0) {
            // Precise steps for today to showcase different profiles
            if (u.id === 'usr_1') steps = 10500; // Brijesh
            if (u.id === 'usr_2') steps = 18000; // Priya
            if (u.id === 'usr_3') steps = 14521; // Rahul
            if (u.id === 'usr_4') steps = 2750;  // Amit
            if (u.id === 'usr_5') steps = 8000;  // Ananya
          } else {
            // Random historical steps
            if (u.id === 'usr_4') steps = 2000 + Math.floor(Math.random() * 2000);
          }

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
        const { error: summariesError } = await supabase.from('daily_summaries').insert(summaries);
        if (summariesError) {
          console.error(`Failed to seed summaries for ${u.name}:`, summariesError.message);
        }

        // Seed Signup Coin Transaction
        await supabase.from('coin_transactions').insert([{
          id: `tx_signup_${u.id}`,
          user_id: u.id,
          amount: 100,
          transaction_type: 'Signup',
          description: 'Signup Welcome Bonus',
          created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        }]);
      }
    }

    // Seed Group & Members if not existing
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

    const { data: existingGroup } = await supabase
      .from('groups')
      .select('id')
      .eq('id', sharmaGroup.id)
      .maybeSingle();

    if (!existingGroup) {
      console.log('🌱 Seeding group grp_1...');
      await supabase.from('groups').insert([sharmaGroup]);

      const groupMembers = [
        { group_id: 'grp_1', user_id: 'usr_1', role: 'Owner' },
        { group_id: 'grp_1', user_id: 'usr_2', role: 'Admin' },
        { group_id: 'grp_1', user_id: 'usr_3', role: 'Member' },
      ];
      await supabase.from('group_members').insert(groupMembers);
    }

    // Seed Marketplace Rewards if not existing
    const seededRewards = [
      { id: 'rew_1', title: '₹250 Gift Voucher', brand: 'Amazon', description: 'Applicable on any shopping order', cost_walk_coins: 500, category: 'Voucher', image_url: 'https://img.icons8.com/color/96/amazon.png' },
      { id: 'rew_2', title: 'Free Delivery Pack', brand: 'Swiggy', description: '5 free deliveries on food orders', cost_walk_coins: 250, category: 'Food', image_url: 'https://img.icons8.com/color/96/swiggy.png' },
      { id: 'rew_3', title: '20% Off Fitness Gear', brand: 'Decathlon', description: 'Valid on footwear & sports gear', cost_walk_coins: 400, category: 'Fitness', image_url: 'https://img.icons8.com/color/96/decathlon.png' },
      { id: 'rew_4', title: 'Free Health Checkup', brand: 'Apollo', description: 'Full body diagnostic package', cost_walk_coins: 1000, category: 'Insurance', image_url: 'https://img.icons8.com/color/96/hospital-3.png' },
    ];

    for (const r of seededRewards) {
      const { data: existingReward } = await supabase
        .from('rewards')
        .select('id')
        .eq('id', r.id)
        .maybeSingle();

      if (!existingReward) {
        await supabase.from('rewards').insert([r]);
      }
    }

    // Seed historical transactions for user 1 and user 2 if they were just seeded
    const txCheck = await supabase.from('coin_transactions').select('id').eq('id', 'tx_goal_1').maybeSingle();
    if (!txCheck.data) {
      const extraTransactions = [
        { id: 'tx_goal_1', user_id: 'usr_1', amount: 20, transaction_type: 'GoalMet', description: 'Daily Step Goal Met', created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
        { id: 'tx_goal_2', user_id: 'usr_1', amount: 20, transaction_type: 'GoalMet', description: 'Daily Step Goal Met', created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
        { id: 'tx_streak_1', user_id: 'usr_1', amount: 50, transaction_type: 'StreakBonus', description: '7-Day Consistent Streak Bonus', created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
        { id: 'tx_challenge_1', user_id: 'usr_1', amount: 1500, transaction_type: 'StreakBonus', description: 'Office Battle Challenge Grand Prize', created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
        { id: 'tx_redeem_1', user_id: 'usr_1', amount: -250, transaction_type: 'Redemption', description: 'Redeemed Swiggy Free Delivery Pack', created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString() },
        
        { id: 'tx_goal_3', user_id: 'usr_2', amount: 20, transaction_type: 'GoalMet', description: 'Daily Step Goal Met', created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
        { id: 'tx_challenge_2', user_id: 'usr_2', amount: 2500, transaction_type: 'StreakBonus', description: 'BadaKadam Launch Milestone Reward', created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
        { id: 'tx_redeem_2', user_id: 'usr_2', amount: -500, transaction_type: 'Redemption', description: 'Redeemed Amazon ₹250 Gift Voucher', created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() }
      ];
      await supabase.from('coin_transactions').insert(extraTransactions);
    }

    console.log('🎉 Database seeding complete!');
  } catch (err) {
    console.error('❌ Unexpected seeding error:', err);
  }
}
