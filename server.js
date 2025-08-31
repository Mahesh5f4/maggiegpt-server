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
const authGoogle = require('./authGoogle');
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
  origin: 'https://maggie-ai.netlify.app',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
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
    httpOnly: true,
    secure: true, // must be true for HTTPS
    sameSite: 'None' // required for cross-site cookies with credentials
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
app.use('/', authGoogle);
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
// Start Server (with port-in-use handling)
// ===================
const http = require('http');

async function startServerWithRetries(startPort, maxAttempts = 5) {
  let attempt = 0;
  let port = Number(startPort);

  while (attempt < maxAttempts) {
    attempt += 1;
    const server = http.createServer(app);

    const result = await new Promise((resolve) => {
      server.once('listening', () => resolve({ ok: true, server }));
      server.once('error', (err) => resolve({ ok: false, err }));
      server.listen(port);
    });

    if (result.ok) {
      const actualPort = result.server.address().port;
      console.log(`✅ Server running on port ${actualPort}`);
      console.log(`🌐 Backend URL: ${BACKEND_URL}`);
      console.log(`🔗 Health check: ${BACKEND_URL}/api/health`);
      return result.server;
    }

    const err = result.err;
    if (err && err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} in use, trying port ${port + 1} (attempt ${attempt}/${maxAttempts})`);
      port += 1; // try next port
      await new Promise(r => setTimeout(r, 200));
      continue;
    }

    console.error('Failed to start server:', err);
    throw err;
  }

  throw new Error(`Unable to bind to a port after ${maxAttempts} attempts starting at ${startPort}`);
}

connectDB()
  .then(async () => {
    try {
      await startServerWithRetries(PORT, 8);
    } catch (err) {
      console.error('❌ Server start error:', err);
      process.exit(1);
    }
  })
  .catch(err => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });
