import app from './app';

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`================================================`);
  console.log(`👟 WalkVerse Microservice Engine is Running!`);
  console.log(`🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`HEALTH CHECK: http://localhost:${PORT}/health`);
  console.log(`================================================`);
});
