const axios = require('axios');

async function test() {
  try {
    const BACKEND_URL = process.env.BACKEND_URL || 'https://maggiegpt-server-1.onrender.com';
    const res = await axios.post(`${BACKEND_URL}/api/chat`, { prompt: 'Hello, test' });
    console.log('Status:', res.status);
    console.log('Data:', res.data);
  } catch (err) {
    console.error('Request failed:', err.response ? err.response.status : err.message, err.response ? err.response.data : '');
  }
}

if (require.main === module) test();
