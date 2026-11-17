const { spawn } = require('child_process');
const http = require('http');

console.log('Testing Backend Service on Port 9000...');

const server = spawn('node', ['apps/backend/dist/index.js'], { stdio: 'inherit' });

setTimeout(() => {
  const req = http.get('http://127.0.0.1:9000/health', (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log('HTTP Status:', res.statusCode);
      console.log('Response Body:', data);
      server.kill();
      process.exit(res.statusCode === 200 ? 0 : 1);
    });
  });

  req.on('error', (err) => {
    console.error('Probe failed:', err);
    server.kill();
    process.exit(1);
  });
}, 2000);
