const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const { User } = require('./models');
const { authMiddleware } = require('./middleware');
const send2FACode = require('./send2FACode');
const { sendEmail } = require('./send2FACode');

const router = express.Router();

// ===================
// Passport Setup
// ===================
// Sessions and passport are already initialized in server.js
// We only need to register the strategy here

// Ensure callback URL uses explicit port fallback (5000) and matches mounted route (/api)
const backendBase = (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, '');
const googleCallback = process.env.GOOGLE_CALLBACK_URL || `${backendBase}/api/auth/google/callback`;
// Helpful debug info when running
console.log('Google OAuth callback URL:', googleCallback);

passport.use(
  new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: googleCallback,
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ email: profile.emails[0].value });

      if (!user) {
        user = await User.create({
          name: profile.displayName,
          email: profile.emails[0].value,
          password: '', // Password is empty for Google accounts
        });
      }

      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  })
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});

// ===================
// Register Route
// ===================
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(422).json({ message: 'Invalid email format' });
    }
    if (password.length < 8) {
      return res.status(422).json({ message: 'Password must be at least 8 characters' });
    }
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      if (!existing.isEmailVerified) {
        // Resend verification code
        const code = crypto.randomInt(100000, 999999).toString();
        existing.twoFactorCode = code;
        existing.twoFactorCodeExpiration = Date.now() + 5 * 60 * 1000;
        await send2FACode(existing.email, code, 'Verify your email');
        await existing.save();
        return res.json({ message: 'Account exists but not verified. Sent a new code to your email.', requiresVerification: true });
      }
      return res.status(409).json({ message: 'Email already registered' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name: name.trim(), email: email.toLowerCase(), password: hashedPassword, isEmailVerified: false });
    // Generate verification code
    const code = crypto.randomInt(100000, 999999).toString();
    user.twoFactorCode = code;
    user.twoFactorCodeExpiration = Date.now() + 5 * 60 * 1000;
    // Attempt to send email BEFORE saving to avoid ghost accounts on failure
    await send2FACode(user.email, code, 'Verify your email');
    await user.save();
    res.json({ message: 'Registration successful. Verification code sent to your email.', requiresVerification: true });
  } catch (err) {
    console.error(err.message);
    res.status(400).json({ message: 'Registration failed', error: err.message });
  }
});

// Verify email after registration
router.post('/verify-register', async (req, res) => {
  const { email, code } = req.body;
  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(400).json({ message: 'Invalid email' });
    if (user.isEmailVerified) return res.json({ message: 'Email already verified' });
    if (user.twoFactorCode !== code) return res.status(400).json({ message: 'Invalid code' });
    if (Date.now() > user.twoFactorCodeExpiration) return res.status(400).json({ message: 'Code expired' });

    user.isEmailVerified = true;
    user.twoFactorCode = '';
    await user.save();

    // Send welcome email with product info
    await sendEmail(user.email, 'Welcome to MaggieGPT — developed by Mahesh', `
      <div style="font-family:Arial,sans-serif">
        <h2>Welcome to MaggieGPT 🎉</h2>
        <p>Hi ${user.name},</p>
        <p>Thanks for joining MaggieGPT — developed by Mahesh.</p>
        <p>Highlights:</p>
        <ul>
          <li>Smart chat with code and markdown support</li>
          <li>Image generation and file context (uploads)</li>
          <li>Session-based history like ChatGPT</li>
          <li>Secure 2FA and Google login</li>
        </ul>
        <p>Enjoy your experience!</p>
        <p>— Team MaggieGPT</p>
      </div>
    `);
    res.json({ message: 'Email verified successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Verification failed', error: err.message });
  }
});

// ===================
// Login Route (with 2FA)
// ===================
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });
    if (!user.isEmailVerified) return res.status(403).json({ message: 'Please verify your email before logging in' });

    // Check if password is correct
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: 'Invalid credentials' });

    // Always send 2FA code on login
    const twoFactorCode = crypto.randomInt(100000, 999999).toString();
    user.twoFactorCode = twoFactorCode;
    user.twoFactorCodeExpiration = Date.now() + 5 * 60 * 1000;
    await user.save();
    await send2FACode(user.email, twoFactorCode, 'Your MaggieGPT Login Code');
    return res.status(200).json({ message: '2FA code sent to your email', is2FA: true });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
});

// ===================
// Verify 2FA Route
// ===================
router.post('/verify-2fa', async (req, res) => {
  const { email, code } = req.body;

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    if (user.twoFactorCode !== code) {
      return res.status(400).json({ message: 'Invalid 2FA code' });
    }

    if (Date.now() > user.twoFactorCodeExpiration) {
      return res.status(400).json({ message: '2FA code expired' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

    user.twoFactorCode = '';
    user.twoFactorCodeExpiration = Date.now();
    await user.save();

    // Send login welcome email
    await sendEmail(user.email, 'Welcome to MaggieGPT — Login Success', `
      <div style="font-family:Arial,sans-serif">
        <h2>Login Successful</h2>
        <p>Hi ${user.name}, welcome back to MaggieGPT — developed by Mahesh.</p>
        <p>Tips: start a new chat, upload a file for context, or try voice input.</p>
      </div>
    `);

    res.json({ message: '2FA verified successfully', token });
  } catch (err) {
    res.status(500).json({ message: 'Failed to verify 2FA', error: err.message });
  }
});

// ===================
// Profile Route (JWT protected)
// ===================
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('name');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ name: user.name });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

// ===================
// Google OAuth Routes
// ===================

// Start OAuth login
router.get('/auth/google', 
  passport.authenticate('google', { scope: ['profile', 'email'], accessType: 'offline', prompt: 'consent' })
);

// Callback after Google authentication
router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  async (req, res) => {
    try {
      const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
  const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
  console.log('Google OAuth redirecting to frontend:', frontend);
      // Send login welcome email for Google users as well
      if (req.user?.email) {
        try { await send2FACode(req.user.email, 'Welcome to MaggieGPT! You have logged in successfully.', 'Welcome to MaggieGPT'); } catch {}
      }
      // Redirect to chat page with token in query param; frontend will capture and store it
      res.redirect(`${frontend}/chat?token=${token}`);
    } catch (err) {
      res.status(500).json({ message: 'Google login failed', error: err.message });
    }
  }
);

module.exports = router;
