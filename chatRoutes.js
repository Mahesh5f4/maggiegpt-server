const express = require('express');
const axios = require('axios');
const { Chat } = require('./models');
const { authMiddleware } = require('./middleware');  // Correct destructuring

const router = express.Router();

router.post("/chat", authMiddleware, async (req, res) => {
  const { prompt } = req.body;
  const userId = req.user.id;

  try {
    // Using the updated endpoint for Gemini 2.0 Flash
    const geminiResponse = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }]
      }
    );

    const aiMessage = geminiResponse.data.candidates[0]?.content?.parts[0]?.text || "No response.";

    // Save the chat interaction to the database
    await Chat.findOneAndUpdate(
      { userId },
      {
        $push: {
          messages: [
            { role: "user", content: prompt },
            { role: "ai", content: aiMessage }
          ]
        }
      },
      { upsert: true }
    );

    // Retrieve chat history after adding the new messages
    const chatHistory = await Chat.findOne({ userId }).select('messages');

    // Return the AI response along with the updated chat history
    res.json({ reply: aiMessage, chatHistory: chatHistory.messages });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Gemini API failed", error: err.message });
  }
});

module.exports = router;
