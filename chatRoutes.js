const express = require('express');
const axios = require('axios');
const { Chat } = require('./models');
const { v4: uuidv4 } = require('uuid');  // To generate unique session IDs

const router = express.Router();

// Helper to detect image generation prompts
function isImagePrompt(prompt) {
  const keywords = ['draw', 'generate an image', 'picture of', 'create an image', 'image of', 'visualize'];
  return keywords.some(k => prompt.toLowerCase().includes(k));
}

// POST /chat — Send a message and get AI response or image
router.post("/chat", async (req, res) => {
  const { prompt, sessionId } = req.body;

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

    let chat;
    if (sessionId) {
      // Find the chat by sessionId if it exists
      chat = await Chat.findOne({ 'sessions.sessionId': sessionId });
      if (chat) {
        const session = chat.sessions.find(session => session.sessionId === sessionId);
        session.messages.push({ role: "user", content: prompt });
        session.messages.push({ role: "ai", content: imageUrl || aiMessage });
      } else {
        return res.status(404).json({ message: "Session not found" });
      }
    } else {
      // Create a new chat session if no sessionId is provided
      const newSessionId = uuidv4();
      chat = new Chat({
        sessions: [{
          sessionId: newSessionId,
          messages: [
            { role: "user", content: prompt },
            { role: "ai", content: imageUrl || aiMessage }
          ]
        }]
      });
    }

    // Save the chat session in the database
    await chat.save();

    // Return the AI reply and image URL (if any)
    const currentSessionId = sessionId || chat.sessions[0].sessionId;
    res.json({ reply: aiMessage, sessionId: currentSessionId, imageUrl });

  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ message: "Chat API failed", error: err.message });
  }
});

// GET /chat/history — Retrieve all chat sessions
router.get("/chat/history", async (req, res) => {
  try {
    const chat = await Chat.findOne().select('sessions');
    res.json({ chatHistory: chat?.sessions || [] });
  } catch (err) {
    console.error('Chat history fetch error:', err.message);
    res.status(500).json({ message: "Failed to fetch chat history", error: err.message });
  }
});

// POST /new-chat — Start a new chat
router.post("/new-chat", async (req, res) => {
  try {
    const sessionId = uuidv4();
    const newSession = {
      sessionId,
      messages: []
    };

    const chat = new Chat({
      sessions: [newSession]
    });

    await chat.save();

    res.json({ message: "New chat started", sessionId });
  } catch (err) {
    console.error('New chat error:', err.message);
    res.status(500).json({ message: "Failed to start a new chat", error: err.message });
  }
});

module.exports = router;
