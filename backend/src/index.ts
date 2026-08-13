import app from './app';
import { seedDatabase } from './database/store';

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`================================================`);
  console.log(`👟 BadaKadam Microservice Engine is Running!`);
  console.log(`🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`HEALTH CHECK: http://localhost:${PORT}/health`);
  console.log(`================================================`);

  // Run Supabase DB Seed Check
  try {
    await seedDatabase();
  } catch (err) {
    console.error('Failed to run database seeder:', err);
  }
});
