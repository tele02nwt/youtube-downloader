const { spawnSync } = require('child_process');
const path = require('path');

const tests = [
  'public-index-modules.test.js',
  'templates.test.js',
  'tenant-isolation.test.js',
  'stats.test.js',
  'auth.test.js',
  'app-routes.test.js'
].map((name) => path.join(__dirname, name));

for (const file of tests) {
  const result = spawnSync(process.execPath, [file], { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log('all tests passed');
