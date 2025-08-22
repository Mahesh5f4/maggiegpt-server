const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'ai'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const sessionSchema = new mongoose.Schema({
  sessionId: { 
    type: String, 
    required: true 
  },
  messages: [messageSchema],
});

const chatSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  sessions: [sessionSchema],    // Active chat sessions
  history: [sessionSchema],     // Previous chat history
}, { timestamps: true });

module.exports = mongoose.model('Chat', chatSchema);
