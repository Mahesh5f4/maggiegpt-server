const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const crypto = require('crypto');
const { User } = require('./models');
const { authMiddleware } = require('./middleware');
const nodemailer = require('nodemailer');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your_refresh_secret'; // Add to .env

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Helper: Send verification email with 6-digit code
async function sendVerificationEmail(email, code) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Your Verification Code',
    text: `Your verification code is: ${code}. It expires in 10 minutes.`,
  };
  await transporter.sendMail(mailOptions);
}

// Helper: Send password reset email with token link
async function sendResetPasswordEmail(email, token) {
  const resetUrl = `http://localhost:3000/reset-password?token=${token}`; // Adjust frontend URL
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Password Reset Request',
    text: `You requested a password reset. Use the link below to reset your password. The link expires in 1 hour.\n\n${resetUrl}`,
  };
  await transporter.sendMail(mailOptions);
}

// Generate JWT tokens (access + refresh)
function generateTokens(userId) {
  const accessToken = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '15m' }); // shorter expiry
  const refreshToken = jwt.sign({ id: userId }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
}

// Middleware to rate-limit verification emails (1 per 2 minutes)
async function canSendVerificationEmail(user) {
  if (!user.lastVerificationEmailSentAt) return true;
  const diff = Date.now() - new Date(user.lastVerificationEmailSentAt).getTime();
  return diff > 2 * 60 * 1000; // 2 minutes cooldown
}

// --------------------- ROUTES ---------------------

// Register route
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "Email already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const verificationCode = crypto.randomInt(100000, 999999).toString();

    const user = new User({
      name,
      email,
      password: hashed,
      isVerified: false,
      verificationCode,
      verificationCodeExpires: Date.now() + 10 * 60 * 1000, // 10 mins
      lastVerificationEmailSentAt: new Date(),
    });

    await user.save();

    await sendVerificationEmail(email, verificationCode);

    res.json({ message: "User registered. Please verify your email with the code sent." });
  } catch (err) {
    console.error(err.message);
    res.status(400).json({ message: "Registration failed", error: err.message });
  }
});

// Verify email with code
router.post("/verify-email", async (req, res) => {
  const { email, code } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });
    if (user.isVerified) return res.json({ message: "User already verified" });

    if (user.verificationCode !== code) return res.status(400).json({ message: "Invalid verification code" });
    if (user.verificationCodeExpires < Date.now()) return res.status(400).json({ message: "Verification code expired" });

    user.isVerified = true;
    user.verificationCode = null;
    user.verificationCodeExpires = null;
    await user.save();

    res.json({ message: "Email verified successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Verification failed" });
  }
});

// Login route with 2FA check & refresh token issuance
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    if (!user.isVerified) {
      // Rate limit resend verification email
      if (!user.verificationCode || user.verificationCodeExpires < Date.now()) {
        if (!(await canSendVerificationEmail(user))) {
          return res.status(429).json({ message: "Too many requests. Please wait before requesting a new code." });
        }

        user.verificationCode = crypto.randomInt(100000, 999999).toString();
        user.verificationCodeExpires = Date.now() + 10 * 60 * 1000;
        user.lastVerificationEmailSentAt = new Date();
        await user.save();
        await sendVerificationEmail(email, user.verificationCode);
      }
      return res.status(403).json({ message: "Email not verified. Please verify using the code sent." });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    const tokens = generateTokens(user._id);
    res.json({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Login failed" });
  }
});

// Refresh token route
router.post('/token/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ message: 'Refresh token required' });

  try {
    const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ message: 'Invalid refresh token' });

    const accessToken = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '15m' });
    res.json({ accessToken });
  } catch (err) {
    console.error(err);
    res.status(403).json({ message: 'Invalid or expired refresh token' });
  }
});

// Request password reset (send reset email with token)
router.post('/password-reset/request', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User with this email does not exist" });

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour expiry
    await user.save();

    await sendResetPasswordEmail(email, resetToken);

    res.json({ message: "Password reset email sent" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send reset email" });
  }
});

// Confirm password reset (set new password)
router.post('/password-reset/confirm', async (req, res) => {
  const { token, newPassword } = req.body;
  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) return res.status(400).json({ message: "Invalid or expired reset token" });

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({ message: "Password has been reset successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Password reset failed" });
  }
});

// Protected profile route (unchanged)
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("name");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ name: user.name });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch profile" });
  }
});

// Google OAuth routes (unchanged)
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  async (req, res) => {
    try {
      if (!req.user.isVerified) {
        req.user.isVerified = true;
        await req.user.save();
      }

      const tokens = generateTokens(req.user._id);

      res.redirect(`http://localhost:3000/google-success?token=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`);
    } catch (err) {
      console.error(err);
      res.redirect('/login');
    }
  }
);

module.exports = router;
