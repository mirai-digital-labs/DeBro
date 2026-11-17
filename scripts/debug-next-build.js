const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const cwd = path.resolve(__dirname, '../apps/storefront');

console.log('Running npx next build in:', cwd);

const child = spawn('npx', ['next', 'build'], {
  cwd,
  shell: true,
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }
});

let output = '';

child.stdout.on('data', (d) => {
  output += d.toString();
  process.stdout.write(d);
});

child.stderr.on('data', (d) => {
  output += d.toString();
  process.stderr.write(d);
});

child.on('close', (code) => {
  fs.writeFileSync(path.resolve(__dirname, 'next-build.log'), output);
  console.log('\nExited with code:', code);
  process.exit(code);
});
