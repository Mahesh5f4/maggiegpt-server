// server.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const passport = require('passport');
const session = require('express-session');

// Load environment variables
dotenv.config();

// Load passport configuration
require('./passport');

const { connectDB } = require('./db');
const authRoutes = require('./authRoutes');
const chatRoutes = require('./chatRoutes');

// Initialize express
const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://maggiegpt-frontend.vercel.app';
const BACKEND_URL = process.env.BACKEND_URL || 'https://maggiegpt-server-1.onrender.com';
console.log('Configured FRONTEND_URL:', FRONTEND_URL);
console.log('Configured BACKEND_URL:', BACKEND_URL);

// ===================
// Middleware
// ===================
app.use(express.json());
app.use(cors({
  origin: [
    FRONTEND_URL, 
    'https://maggiegpt-frontend.vercel.app', 
    'http://localhost:3000', 
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001'
  ],
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization', 'X-Requested-With']
}));
app.use(helmet());

// Configure Content Security Policy
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https:'],
      styleSrc: ["'self'", 'https:'],
      imgSrc: ["'self'", 'https:'],
      fontSrc: ["'self'", 'https:'],
    },
  })
);

// Rate limiting - limit each IP to 100 requests per 15 minutes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use(limiter);

// Required for Passport sessions (Google OAuth)
app.use(session({
  secret: process.env.JWT_SECRET || 'your_default_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production', // Only true in production
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// ===================
// Health Check Endpoint
// ===================
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Backend server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: PORT
  });
});

// ===================
// Routes
// ===================
app.use('/api', authRoutes);
app.use('/api', chatRoutes);

// ===================
// Error Handling Middleware
// ===================
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler for undefined routes - must be last
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// ===================
// Start Server
// ===================
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`🌐 Backend URL: ${BACKEND_URL}`);
      console.log(`🔗 Health check: ${BACKEND_URL}/api/health`);
    });
  })
  .catch(err => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });
