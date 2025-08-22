const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');

// Load .env variables BEFORE importing any route that uses them
dotenv.config();

const { connectDB } = require('./db');
const authRoutes = require('./authRoutes');
const chatRoutes = require('./chatRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
console.log('Configured FRONTEND_URL:', FRONTEND_URL);

// ===================
// Middleware
// ===================
app.use(express.json());
app.use(cors({
  origin: [FRONTEND_URL, 'http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));

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
  });
