// Main Express server entry point

// Load environment variables from .env file (only in development)
// In production (Railway), environment variables are set directly
import dotenv from 'dotenv';

// Only load .env file if not in production
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Log environment status
console.log('\n📋 Environment Check:');
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`   PORT: ${process.env.PORT || '3000'}`);
console.log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? `✅ Set (${process.env.OPENAI_API_KEY.length} chars)` : '❌ NOT SET'}`);
if (process.env.OPENAI_API_KEY) {
  console.log(`   OPENAI_API_KEY prefix: ${process.env.OPENAI_API_KEY.substring(0, 7)}...`);
}
console.log('');

import express from 'express';
import cors from 'cors';
import routes from './server/routes';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Middleware
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Dev-Token'],
}));

app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  console.log('Headers:', {
    'x-dev-token': req.headers['x-dev-token'],
    'authorization': req.headers['authorization'] ? 'Bearer ***' : undefined,
  });
  next();
});

// API routes
app.use('/api', routes);

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 SmartVault Backend running on http://localhost:${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);
  console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌐 Also accessible via: http://127.0.0.1:${PORT}`);
  console.log(`\n🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔑 Dev token enabled: ${process.env.NODE_ENV !== 'production' ? 'YES' : 'NO'}`);
});

