import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();

// CORS configuration
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept', 'X-Requested-With'],
  credentials: true
}));

// Middleware
app.use(express.json());

// Test route
app.get('/api/test', (req, res) => {
  console.log('Test endpoint hit:', new Date().toISOString());
  res.json({ 
    message: 'Simple server is running',
    timestamp: new Date().toISOString(),
    port: process.env.PORT || 4000,
    env: {
      JWT_SECRET: process.env.JWT_SECRET ? 'Set' : 'Missing',
      MONGODB_URI: process.env.MONGODB_URI ? 'Set' : 'Missing'
    }
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Simple CinemaConnect API',
    status: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Login route (simplified)
app.post('/api/auth/login', (req, res) => {
  console.log('Login request received:', req.body);
  res.json({
    message: 'Login endpoint working',
    received: req.body,
    timestamp: new Date().toISOString()
  });
});

// Catch-all route
app.use('*', (req, res) => {
  console.log('Unhandled route:', req.method, req.originalUrl);
  res.status(404).json({ 
    message: 'Route not found',
    method: req.method,
    url: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Start server
const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Simple server running on port ${PORT}`);
  console.log(`Environment: JWT_SECRET=${process.env.JWT_SECRET ? 'Set' : 'Missing'}, MONGODB_URI=${process.env.MONGODB_URI ? 'Set' : 'Missing'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.info('SIGTERM signal received.');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

// Error handling
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
