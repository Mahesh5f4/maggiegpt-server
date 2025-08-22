const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
<<<<<<< HEAD
  password: { type: String, required: true },
  twoFactorCode: { type: String, default: '' },  // Stores the 2FA code
  twoFactorCodeExpiration: { type: Date, default: Date.now },  // Stores the expiration time of the code
  isTwoFactorEnabled: { type: Boolean, default: false },  // Optional, for managing 2FA status
  isEmailVerified: { type: Boolean, default: false }
=======
  password: { type: String }, // password hashed; undefined for Google OAuth users
  googleId: { type: String, unique: true, sparse: true },

  // Two-step verification fields
  isVerified: { type: Boolean, default: false },
  verificationCode: { type: String },
  verificationCodeExpires: { type: Date },

  // Password reset fields
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },

  // Rate limiting for verification email sending (timestamp of last sent)
  lastVerificationEmailSentAt: { type: Date },
>>>>>>> a931c1e34bbce6bc1f2c87d06560f7fffff34ace
});

const User = mongoose.model("User", userSchema);

<<<<<<< HEAD
module.exports = { User };
=======
const chatSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  messages: [
    {
      role: String,
      content: String,
      timestamp: { type: Date, default: Date.now }
    }
  ]
});

const Chat = mongoose.model("Chat", chatSchema);

module.exports = { User, Chat };
>>>>>>> a931c1e34bbce6bc1f2c87d06560f7fffff34ace
