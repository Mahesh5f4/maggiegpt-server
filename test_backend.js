const axios = require('axios');

// Configuration
const BACKEND_URL = process.env.BACKEND_URL || 'https://maggiegpt-server-1.onrender.com';
const LOCAL_BACKEND = 'http://localhost:5000';

async function testBackend(url, description) {
  console.log(`\n🧪 Testing ${description}: ${url}`);
  
  try {
    // Test health endpoint
    const healthResponse = await axios.get(`${url}/api/health`);
    console.log(`✅ Health check: ${healthResponse.status} - ${healthResponse.data.message}`);
    
    // Test CORS with preflight request
    const corsResponse = await axios.options(`${url}/api/health`, {
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    console.log(`✅ CORS preflight: ${corsResponse.status}`);
    
    // Test a simple API call
    const testResponse = await axios.post(`${url}/api/public-chat`, {
      prompt: 'Hello, this is a test message'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000'
      }
    });
    console.log(`✅ Public chat API: ${testResponse.status} - Response received`);
    
    return true;
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return false;
  }
}

async function runTests() {
  console.log('🚀 Backend Connectivity Test Suite');
  console.log('=====================================');
  
  // Test local backend if running
  await testBackend(LOCAL_BACKEND, 'Local Backend');
  
  // Test deployed backend
  await testBackend(BACKEND_URL, 'Deployed Backend');
  
  console.log('\n📋 Test Summary:');
  console.log('================');
  console.log('1. Health endpoint should return 200 OK');
  console.log('2. CORS preflight should return 200 OK');
  console.log('3. API calls should work from localhost:3000');
  console.log('\n💡 If tests fail, check:');
  console.log('   - Backend is running and deployed');
  console.log('   - Environment variables are set correctly');
  console.log('   - CORS configuration allows localhost:3000');
}

// Run tests
runTests().catch(console.error);
