const axios = require('axios');

const listModels = async () => {
  try {
    const response = await axios.get(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
    );
    console.log(response.data);  // Check the list of available models
  } catch (err) {
    console.error('Error fetching available models:', err.message);
  }
};

listModels();
