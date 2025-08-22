const express = require('express');
<<<<<<< HEAD
const axios = require('axios');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const rateLimit = require('express-rate-limit');
const Chat = require('./Chat');
const { authMiddleware } = require('./middleware');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');  // To generate unique session IDs
=======
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const { User } = require('./models');
const { authMiddleware } = require('./middleware');
>>>>>>> a931c1e34bbce6bc1f2c87d06560f7fffff34ace

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// In-memory recent request log for debugging (non-persistent)
const recentChatRequests = [];

<<<<<<< HEAD
// Helper to detect image generation prompts
function isImagePrompt(prompt) {
  const keywords = ['draw', 'generate an image', 'picture of', 'create an image', 'image of', 'visualize'];
  return keywords.some(k => prompt.toLowerCase().includes(k));
}

// Public chat rate limiter (e.g., 10 requests per IP per hour)
const publicChatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

// ✅ POST /public-chat — Unauthenticated limited chat (no DB persistence)
router.post('/public-chat', publicChatLimiter, async (req, res) => {
  const { prompt } = req.body;
  try {
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ message: 'Prompt is required' });
    }

    let aiMessage;
    let imageUrl = null;

    if (isImagePrompt(prompt)) {
      const imageResponse = await axios.post(
        'https://api.openai.com/v1/images/generations',
        { prompt, n: 1, size: '512x512' },
        { headers: { 'Authorization': `Bearer ${process.env.IMAGE_API_KEY}`, 'Content-Type': 'application/json' } }
      );
      imageUrl = imageResponse.data.data[0]?.url || null;
      aiMessage = imageUrl ? `Here is the image for your prompt: ${prompt}` : 'Failed to generate image.';
    } else {
      const geminiResponse = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        { contents: [{ parts: [{ text: prompt }] }] }
      );
      aiMessage = geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.';
    }

    return res.json({ reply: aiMessage, imageUrl });
  } catch (err) {
    console.error('Public chat error:', err.message);
    res.status(500).json({ message: 'Chat API failed', error: err.message });
  }
});

// ✅ POST /chat — Send a message and get AI response or image
// Allow unauthenticated (guest) users to get up to GUEST_LIMIT responses per IP.
const GUEST_LIMIT = 5;
const guestCounts = new Map(); // key: ip -> { count, firstSeen }

router.post('/chat', async (req, res) => {
  const { prompt, sessionId } = req.body;
  let userId = null;

  // Try to extract JWT if provided
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.id;
    } catch (err) {
      // invalid token - treat as unauthenticated guest
      userId = null;
    }
  }

  try {
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ message: 'Prompt is required' });
    }

    // If guest (no userId) enforce per-IP limit
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    console.log('POST /chat - prompt length:', (prompt || '').length, 'sessionId:', sessionId, 'userId:', userId, 'ip:', ip);
    // keep a short in-memory trace (rotate)
    try {
      recentChatRequests.push({ ts: Date.now(), ip, userId, prompt: prompt && prompt.slice(0, 500), sessionId });
      if (recentChatRequests.length > 100) recentChatRequests.shift();
    } catch (e) { /* ignore logging issues */ }
    if (!userId) {
      const entry = guestCounts.get(ip) || { count: 0, firstSeen: Date.now() };
      if (entry.count >= GUEST_LIMIT) {
        return res.status(401).json({ status: 'unauthenticated', message: 'Guest limit reached, please log in' });
      }
      entry.count += 1;
      guestCounts.set(ip, entry);
      console.log(`Guest usage for ${ip}: ${entry.count}/${GUEST_LIMIT}`);
    }

    let aiMessage;
    let imageUrl = null;

    // Generate AI response
    console.log('Generating AI response, checking if image prompt...');
    if (isImagePrompt(prompt)) {
      console.log('Detected image prompt. Calling image generation API.');
      const imageResponse = await axios.post(
        'https://api.openai.com/v1/images/generations',
        {
          prompt,
          n: 1,
          size: '512x512'
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.IMAGE_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      imageUrl = imageResponse.data.data[0]?.url || null;
  aiMessage = imageUrl ? `Here is the image for your prompt: ${prompt}` : 'Failed to generate image.';
  console.log('Image generation result, imageUrl present:', !!imageUrl);
    } else {
  console.log('Detected text prompt. Calling Gemini/text API.');
      const geminiResponse = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        { contents: [{ parts: [{ text: prompt }] }] }
      );
  aiMessage = geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.';
  console.log('Gemini response length:', (aiMessage || '').length);
    }

  // no server-side streaming: proceed to normal JSON response flow

    // If authenticated, persist to DB similar to previous behavior
    if (userId) {
      let chat = await Chat.findOne({ userId });
      if (!chat) {
        chat = new Chat({ userId, sessions: [], history: [] });
      }

      // Find or create session
      let activeSessionId = sessionId;
      if (activeSessionId) {
        const idx = chat.sessions.findIndex(s => s.sessionId === activeSessionId);
        if (idx === -1) {
          return res.status(404).json({ message: 'Session not found' });
        }
        chat.sessions[idx].messages.push({ role: 'user', content: prompt, timestamp: new Date() });
        chat.sessions[idx].messages.push({ role: 'ai', content: imageUrl || aiMessage, timestamp: new Date() });
      } else {
        activeSessionId = uuidv4();
        chat.sessions.push({
          sessionId: activeSessionId,
          messages: [
            { role: 'user', content: prompt, timestamp: new Date() },
            { role: 'ai', content: imageUrl || aiMessage, timestamp: new Date() }
          ],
          updatedAt: new Date()
        });
      }

      // update updatedAt for the modified session
      const sessionIdx = chat.sessions.findIndex(s => s.sessionId === activeSessionId);
      if (sessionIdx !== -1) {
        chat.sessions[sessionIdx].updatedAt = new Date();
      }
      await chat.save();

      return res.json({ reply: aiMessage, sessionId: activeSessionId, imageUrl });
    }

    // Guest response - do not persist
    const remaining = guestCounts.get(ip)?.count || 0;
    return res.json({ reply: aiMessage, sessionId: null, imageUrl, guestRemaining: Math.max(0, GUEST_LIMIT - remaining) });
  } catch (err) {
    console.error('Chat error:', err && err.stack ? err.stack : err);
    res.status(500).json({ message: 'Chat API failed', error: err && err.message ? err.message : String(err) });
  }
});

// Dev-only endpoint to inspect recent /chat requests
router.get('/chat/debug-requests', (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(403).json({ message: 'Forbidden' });
  res.json({ recent: recentChatRequests.slice().reverse() });
});

// ✅ GET /chat/history — Retrieve all chat sessions (active + history)
router.get("/chat/history", authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    const chat = await Chat.findOne({ userId }).select('sessions history');
    const sessions = (chat?.sessions || []).map(s => ({
      sessionId: s.sessionId,
      messages: s.messages,
      updatedAt: s.updatedAt || s.messages?.[s.messages.length - 1]?.timestamp || chat.updatedAt
    }));
    const history = (chat?.history || []).map(s => ({
      sessionId: s.sessionId,
      messages: s.messages,
      updatedAt: s.updatedAt || s.messages?.[s.messages.length - 1]?.timestamp || chat.updatedAt
    }));

    // combine and sort by updatedAt desc
    const combined = [...sessions, ...history].sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    res.json({ chatHistory: combined });
  } catch (err) {
    console.error('Chat history fetch error:', err.message);
    res.status(500).json({ message: "Failed to fetch chat history", error: err.message });
=======
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
>>>>>>> a931c1e34bbce6bc1f2c87d06560f7fffff34ace
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

<<<<<<< HEAD
    if (!chat.sessions) chat.sessions = [];
    if (!chat.history) chat.history = [];

    // Move current sessions to history and start a fresh one
    if (chat.sessions.length > 0) {
      chat.history.push(...chat.sessions);
    }

    const sessionId = uuidv4();
    chat.sessions = [{ sessionId, messages: [] }];

    await chat.save();

    res.json({ message: 'New chat started', sessionId });
  } catch (err) {
    console.error('New chat error:', err.message);
    res.status(500).json({ message: "Failed to start a new chat", error: err.message });
=======
// Get Profile
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("name");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ name: user.name });
  } catch {
    res.status(500).json({ message: "Failed to fetch profile" });
>>>>>>> a931c1e34bbce6bc1f2c87d06560f7fffff34ace
  }
});

// ✅ DELETE /chat/session/:sessionId — Delete a specific chat session
router.delete('/chat/session/:sessionId', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { sessionId } = req.params;
  try {
    const chat = await Chat.findOne({ userId });
    if (!chat) return res.status(404).json({ message: 'No chats found' });

    const originalCountSessions = chat.sessions?.length || 0;
    const originalCountHistory = chat.history?.length || 0;
    chat.sessions = (chat.sessions || []).filter(s => s.sessionId !== sessionId);
    chat.history = (chat.history || []).filter(s => s.sessionId !== sessionId);
    await chat.save();

    if (originalCountSessions === chat.sessions.length && originalCountHistory === chat.history.length) {
      return res.status(404).json({ message: 'Session not found' });
    }
    return res.json({ message: 'Session deleted', sessionId });
  } catch (err) {
    console.error('Delete session error:', err.message);
    res.status(500).json({ message: 'Failed to delete session', error: err.message });
  }
});

// ✅ DELETE /chat/all — Delete all chat sessions and history for the user
router.delete('/chat/all', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  try {
    const chat = await Chat.findOne({ userId });
    if (!chat) return res.json({ message: 'No chats to delete' });

    chat.sessions = [];
    chat.history = [];
    await chat.save();
    return res.json({ message: 'All chats cleared' });
  } catch (err) {
    console.error('Clear all chats error:', err.message);
    res.status(500).json({ message: 'Failed to clear chats', error: err.message });
  }
});

// ✅ POST /analyze-file — Upload a document and get summarized content
router.post('/analyze-file', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const mime = req.file.mimetype;
    let text = '';
    if (mime === 'application/pdf') {
      const parsed = await pdfParse(req.file.buffer);
      text = parsed.text || '';
    } else if (
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mime === 'application/msword'
    ) {
      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      text = result.value || '';
    } else if (mime.startsWith('text/')) {
      text = req.file.buffer.toString('utf8');
    } else {
      return res.status(415).json({ message: 'Unsupported file type' });
    }

    if (!text.trim()) return res.status(400).json({ message: 'No extractable text found' });

    // Summarize with Gemini
    const prompt = `Summarize the following document in bullet points, then extract key insights and action items.\n\n${text.slice(0, 8000)}`;
    const geminiResponse = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { contents: [{ parts: [{ text: prompt }] }] }
    );
    const summary = geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.';
    res.json({ summary });
  } catch (err) {
    console.error('Analyze file error:', err.message);
    res.status(500).json({ message: 'Failed to analyze file', error: err.message });
  }
});

// ✅ POST /analyze-image — Upload an image and get a description/analysis
router.post('/analyze-image', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const mime = req.file.mimetype || '';
    if (!mime.startsWith('image/')) {
      return res.status(415).json({ message: 'Unsupported image type' });
    }
    const base64 = req.file.buffer.toString('base64');
    const prompt = 'Describe the image, list key objects, and infer possible context in concise bullet points.';
    const body = {
      contents: [
        {
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mime, data: base64 } }
          ]
        }
      ]
    };
    const geminiResponse = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      body
    );
    const analysis = geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.';
    res.json({ analysis });
  } catch (err) {
    console.error('Analyze image error:', err.message);
    res.status(500).json({ message: 'Failed to analyze image', error: err.message });
  }
});

module.exports = router;
