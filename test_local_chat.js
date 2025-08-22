const axios = require('axios');

async function test() {
  try {
    const res = await axios.post('http://localhost:5001/api/chat', { prompt: 'Hello, test' });
    console.log('Status:', res.status);
    console.log('Data:', res.data);
  } catch (err) {
    console.error('Request failed:', err.response ? err.response.status : err.message, err.response ? err.response.data : '');
  }
}

if (require.main === module) test();
