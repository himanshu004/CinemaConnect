import fetch from 'node-fetch';

const BASE_URL = 'https://cinemaconnect-backend.onrender.com';

async function testDeployment() {
  console.log('Testing deployment...');
  
  try {
    // Test with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(`${BASE_URL}/`, {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.text();
      console.log('Response body:', data);
    } else {
      console.log('Error response:', await response.text());
    }
    
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('❌ Request timed out - server might not be responding');
    } else {
      console.log('❌ Error:', error.message);
    }
  }
}

testDeployment();
