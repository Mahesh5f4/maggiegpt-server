const express = require('express');
const axios = require('axios');
const { Chat } = require('./models');
const { authMiddleware } = require('./middleware');
const { v4: uuidv4 } = require('uuid');  // To generate unique session IDs

const router = express.Router();

// Helper to detect image generation prompts
function isImagePrompt(prompt) {
  const keywords = ['draw', 'generate an image', 'picture of', 'create an image', 'image of', 'visualize'];
  return keywords.some(k => prompt.toLowerCase().includes(k));
}

// ✅ POST /chat — Send a message and get AI response or image
router.post("/chat", authMiddleware, async (req, res) => {
  const { prompt, sessionId } = req.body;
  const userId = req.user.id;

  try {
    let aiMessage;
    let imageUrl = null;

    // Check if the prompt is an image generation request
    if (isImagePrompt(prompt)) {
      // If it's an image-related prompt, generate image using DALL·E
      const imageResponse = await axios.post(
        'https://api.openai.com/v1/images/generations',
        {
          prompt,
          n: 1,
          size: "512x512"
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.IMAGE_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Fetch the image URL from the API response
      imageUrl = imageResponse.data.data[0]?.url;
      aiMessage = `Here is the image for your prompt: ${prompt}`;
    } else {
      // If not an image-related prompt, generate a text response using Gemini
      const geminiResponse = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          contents: [{ parts: [{ text: prompt }] }]
        }
      );

      aiMessage = geminiResponse.data.candidates[0]?.content?.parts[0]?.text || "No response.";
    }

    // Find the user's chat or create a new one if not found
    let chat = await Chat.findOne({ userId });
    if (!chat) {
      chat = new Chat({ userId, sessions: [], history: [] });
    }

    let session;
    if (sessionId) {
      // Find the specific session if sessionId exists
      session = chat.sessions.find(session => session.sessionId === sessionId);
      if (session) {
        session.messages.push({ role: "user", content: prompt });
        session.messages.push({ role: "ai", content: imageUrl || aiMessage });
      } else {
        return res.status(404).json({ message: "Session not found" });
      }
    } else {
      // Create a new session if no sessionId is provided
      session = {
        sessionId: uuidv4(),
        messages: [
          { role: "user", content: prompt },
          { role: "ai", content: imageUrl || aiMessage }
        ]
      };
    }

    // Update or insert the session in the database
    await Chat.findOneAndUpdate(
      { userId },
      {
        $push: { sessions: session },
        $pull: { sessions: { sessionId: session.sessionId } },
      },
      { upsert: true }
    );

    // Return the AI reply and image URL (if any)
    res.json({ reply: aiMessage, sessionId: session.sessionId, imageUrl });

  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ message: "Chat API failed", error: err.message });
  }
});

// ✅ GET /chat/history — Retrieve all chat sessions
router.get("/chat/history", authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    const chat = await Chat.findOne({ userId }).select('sessions');
    res.json({ chatHistory: chat?.sessions || [] });
  } catch (err) {
    console.error('Chat history fetch error:', err.message);
    res.status(500).json({ message: "Failed to fetch chat history", error: err.message });
  }
});

// ✅ POST /new-chat — Start a new chat
router.post("/new-chat", authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    let chat = await Chat.findOne({ userId });

    if (!chat) {
      chat = new Chat({ userId, sessions: [], history: [] });
    }

    if (!chat.sessions) chat.sessions = [];
    if (!chat.history) chat.history = [];

    chat.history.push(...chat.sessions);

    const sessionId = uuidv4();
    const newSession = { sessionId, messages: [] };

    chat.sessions = [newSession];

    await chat.save();

    res.json({ message: "New chat started", sessionId });
  } catch (err) {
    console.error('New chat error:', err.message);
    res.status(500).json({ message: "Failed to start a new chat", error: err.message });
  }
});

module.exports = router;
