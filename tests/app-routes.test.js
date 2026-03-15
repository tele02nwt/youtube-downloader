const assert = require('assert');

async function requestJson(server, path) {
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`);
  const body = await response.json();
  return { response, body };
}

(async () => {
  const serverModule = require('../server');

  assert.strictEqual(typeof serverModule.createApp, 'function', 'server.js must export createApp()');

  const { app } = serverModule.createApp();
  const server = app.listen(0);

  try {
    const health = await requestJson(server, '/api/health');
    assert.strictEqual(health.response.status, 200);
    assert.strictEqual(health.body.ok, true);

    const authInfo = await requestJson(server, '/api/auth/info');
    assert.strictEqual(authInfo.response.status, 200);
    assert.ok(Object.prototype.hasOwnProperty.call(authInfo.body, 'role'));

    const categories = await requestJson(server, '/api/categories');
    assert.strictEqual(categories.response.status, 401);
    assert.ok(categories.body && categories.body.error);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }

  console.log('app routes tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
