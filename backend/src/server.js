import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import User from './models/User.js';
import Theater from './models/Theater.js';
import authRoutes from './routes/authRoutes.js';
import theaterRoutes from './routes/theaterRoutes.js';
import movieRoutes from './routes/movieRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import walletRoutes from './routes/walletRoutes.js';

// Load environment variables
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Current working directory:', process.cwd());
console.log('__dirname:', __dirname);

dotenv.config();
console.log('Environment variables loaded:', {
  TMDB_API_KEY: process.env.TMDB_API_KEY,
  PORT: process.env.PORT,
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET ? '✅ Set' : '❌ Missing'
});

// Validate required environment variables
if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET environment variable is not set!');
  console.log('Please set JWT_SECRET in your Render environment variables');
  process.exit(1);
}

const app = express();

// CORS configuration
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  credentials: true,
  maxAge: 86400
}));

// Middleware
app.use(express.json());

// MongoDB Connection
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('❌ MONGODB_URI environment variable is not set!');
  console.log('Please set MONGODB_URI in your Render environment variables');
  console.log('⚠️ Server will start without database connection');
} else {
  mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
    .then(() => {
      console.log('✅ MongoDB connected successfully');
      const db = mongoose.connection;
      console.log('Database name:', db.name);
      console.log('Database state:', db.readyState);

      // Test if we can find any theaters
      Theater.find({}).then(theaters => {
        console.log('Total theaters in database:', theaters.length);
        if (theaters.length > 0) {
          console.log('Sample theater:', JSON.stringify(theaters[0], null, 2));
        } else {
          console.log('No theaters found in database');
        }
      });
    })
    .catch(err => {
      console.error('❌ MongoDB connection error:', err);
      console.log('⚠️ Server will continue without database connection');
    });
}

// Routes
console.log('Setting up routes...');
app.use('/api/auth', authRoutes);
console.log('Auth routes loaded');
app.use('/api/theaters', theaterRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/wallet', walletRoutes);
console.log('All routes loaded');

// Test route
app.get('/api/test', (req, res) => {
  console.log('Test endpoint hit:', new Date().toISOString());
  res.json({ 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    port: process.env.PORT || 4000
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Welcome to CinemaConnect API',
    status: 'Server is running',
    availableEndpoints: {
      auth: '/api/auth',
      theaters: '/api/theaters',
      movies: '/api/movies',
      bookings: '/api/bookings',
      payment: '/api/payment',
      wallet: '/api/wallet'
    }
  });
});

// Get theaters by city
app.get('/api/theaters', async (req, res) => {
  try {
    const { city } = req.query;
    console.log('Fetching theaters for city:', city);

    if (!city) {
      return res.status(400).json({ error: 'City parameter is required' });
    }

    const query = { city: { $regex: new RegExp(city, 'i') } };
    const theaters = await Theater.find(query);

    if (theaters.length === 0) {
      return res.status(404).json({ error: 'No theaters found in this city' });
    }

    res.json(theaters);
  } catch (error) {
    console.error('Error fetching theaters:', error);
    res.status(500).json({ error: 'Failed to fetch theaters' });
  }
});

// Signup route
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, phone, address, city, state, zipCode } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create new user
    const user = new User({
      name,
      email,
      password,
      phone,
      address,
      city,
      state,
      zipCode
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Return user data (excluding password) and token
    const userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      address: user.address,
      city: user.city,
      state: user.state,
      zipCode: user.zipCode
    };

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: userData
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Error creating user' });
  }
});

// Fallback login route (in case database is not connected)
app.post('/api/auth/login', (req, res) => {
  console.log('Fallback login route hit:', req.body);
  res.json({
    message: 'Login endpoint working (fallback mode)',
    received: req.body,
    timestamp: new Date().toISOString(),
    note: 'Database connection may not be available'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ message: 'Invalid JSON' });
  }
  next(err);
});

// Global error handler
// Catch-all route for debugging
app.use('*', (req, res) => {
  console.log('Unhandled route:', req.method, req.originalUrl);
  res.status(404).json({ 
    message: 'Route not found',
    method: req.method,
    url: req.originalUrl,
    availableRoutes: [
      'GET /',
      'GET /api/test',
      'POST /api/auth/login',
      'POST /api/auth/signup'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.info('SIGTERM signal received.');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});
