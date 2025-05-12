const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('./models');
const { authMiddleware } = require('./middleware');  // Correct destructuring

const router = express.Router();

// Register Route
// Register Route
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashed });
    await user.save();
    res.json({ message: "User registered" });
  } catch (err) {
    console.error(err.message); // Log detailed error
    res.status(400).json({ message: "Registration failed", error: err.message });
  }
});


// Login Route
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
// Get user profile using token
router.get("/profile", authMiddleware, async (req, res) => {
  try {
  const user = await User.findById(req.user.id).select("name");
if (!user) return res.status(404).json({ message: "User not found" });
res.json({ name: user.name });
;  // Send the registered name
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch profile" });
  }
});

module.exports = router;
