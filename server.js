// server.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
<<<<<<< HEAD
const session = require('express-session');
const passport = require('passport');

// Load .env variables BEFORE importing any route that uses them
dotenv.config();
=======
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const passport = require('passport');
const session = require('express-session');
>>>>>>> a931c1e34bbce6bc1f2c87d06560f7fffff34ace

const { connectDB } = require('./db');
const authRoutes = require('./authRoutes');
const chatRoutes = require('./chatRoutes');

<<<<<<< HEAD
const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
console.log('Configured FRONTEND_URL:', FRONTEND_URL);
=======
// Load environment variables
dotenv.config();

// Initialize express
const app = express();
const PORT = process.env.PORT || 5001; // Use 5001 or from env

// Passport Config (Google Strategy etc)
require('./passport'); // Should export configured GoogleStrategy
>>>>>>> a931c1e34bbce6bc1f2c87d06560f7fffff34ace

// ===================
// Middleware
// ===================
app.use(express.json());
<<<<<<< HEAD
app.use(cors({
  origin: [FRONTEND_URL, 'http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));
=======
app.use(cors());
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

// Optional session middleware - needed for OAuth callback with passport
app.use(
  session({
    secret: process.env.JWT_SECRET || 'your_default_secret',
    resave: false,
    saveUninitialized: false,
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session()); // Only needed if you use sessions with passport
>>>>>>> a931c1e34bbce6bc1f2c87d06560f7fffff34ace

// Required for Passport sessions (Google OAuth)
app.use(session({
  secret: process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    sameSite: 'lax',
    secure: false,
  }
}));
app.use(passport.initialize());
app.use(passport.session());

// ===================
// Routes
<<<<<<< HEAD
// ===================
app.use('/api', authRoutes);
app.use('/api', chatRoutes);

// ===================
// Start Server
// ===================
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
=======
app.use('/api/auth', authRoutes); // auth includes /google & /google/callback etc
app.use('/api/chat', chatRoutes);

// Connect DB & start server
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
>>>>>>> a931c1e34bbce6bc1f2c87d06560f7fffff34ace
  });
