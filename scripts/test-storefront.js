const { spawn } = require('child_process');
const http = require('http');

console.log('Testing Storefront dev server on port 3000...');

const nextBin = require.resolve('next/dist/bin/next');
const child = spawn(process.execPath, [nextBin, 'dev', 'apps/storefront', '-p', '3000'], {
  stdio: 'pipe',
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', PORT: '3000' }
});

child.stdout.on('data', (d) => process.stdout.write(d));
child.stderr.on('data', (d) => process.stderr.write(d));

const timer = setTimeout(() => {
  console.log('Probing http://127.0.0.1:3000...');
  http.get('http://127.0.0.1:3000', (res) => {
    console.log('Storefront Response HTTP Code:', res.statusCode);
    child.kill();
    process.exit(res.statusCode === 200 ? 0 : 1);
  }).on('error', (err) => {
    console.error('Probe failed:', err.message);
    child.kill();
    process.exit(1);
  });
}, 8000);
