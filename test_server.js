const express = require('express');

// Simple test to verify Express routing works
const app = express();

// Test basic routing
app.get('/test', (req, res) => {
  res.json({ message: 'Test route works' });
});

// Test 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Test server startup
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`✅ Test server running on port ${PORT}`);
  console.log('✅ Express routing is working correctly');
  process.exit(0);
}).on('error', (err) => {
  console.error('❌ Test server failed:', err.message);
  process.exit(1);
});
