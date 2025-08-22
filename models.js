const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String }, // password hashed; undefined for Google OAuth users
  googleId: { type: String, unique: true, sparse: true },

  // Two-step verification fields (2FA)
  twoFactorCode: { type: String, default: '' },  // Stores the 2FA code
  twoFactorCodeExpiration: { type: Date, default: Date.now },  // Stores the expiration time of the code
  isTwoFactorEnabled: { type: Boolean, default: false },  // Optional, for managing 2FA status
  isEmailVerified: { type: Boolean, default: false },

  // Email verification fields
  verificationCode: { type: String },
  verificationCodeExpires: { type: Date },

  // Password reset fields
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },

  // Rate limiting for verification email sending (timestamp of last sent)
  lastVerificationEmailSentAt: { type: Date },
});

const User = mongoose.model("User", userSchema);

module.exports = { User };
