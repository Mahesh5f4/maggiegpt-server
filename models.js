const mongoose = require('mongoose');

// User schema and model
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  twoFactorCode: { type: String, default: '' },  // Stores the 2FA code
  twoFactorCodeExpiration: { type: Date, default: Date.now },  // Stores the expiration time of the code
  isTwoFactorEnabled: { type: Boolean, default: false },  // Optional, for managing 2FA status
  isEmailVerified: { type: Boolean, default: false }
});

const User = mongoose.model("User", userSchema);

module.exports = { User };
