const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const { User } = require('./models');
const { authMiddleware } = require('./middleware');

const router = express.Router();

// Local Register
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashed });
    await user.save();
    res.json({ message: "User registered" });
  } catch (err) {
    res.status(400).json({ message: "Registration failed", error: err.message });
  }
});

// Local Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" });
    res.json({ token });
  } catch {
    res.status(500).json({ message: "Login failed" });
  }
});

// Google OAuth - Step 1: Redirect to Google
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
}));

// Google OAuth - Step 2: Callback handler
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  async (req, res) => {
    try {
      const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
      // Option 1: Redirect with token
      res.redirect(`http://localhost:3000/oauth-success?token=${token}`);
      // Option 2: Send token directly
      // res.json({ token });
    } catch (error) {
      console.error("OAuth callback error:", error.message);
      res.status(500).json({ message: "Google Auth Failed" });
    }
  }
);

// Get Profile
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("name");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ name: user.name });
  } catch {
    res.status(500).json({ message: "Failed to fetch profile" });
  }
});

module.exports = router;
