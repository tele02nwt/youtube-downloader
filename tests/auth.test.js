const assert = require('assert');
const fs = require('fs');
const path = require('path');

const users = require('../lib/users');
const passwords = require('../lib/passwords');
const { DATA_DIR } = require('../lib/storage');

const USERS_FILE = path.join(DATA_DIR, 'users.json');

function backupFile(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
}

function restoreFile(filePath, content) {
  if (content === null) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return;
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

(async () => {
  const backup = backupFile(USERS_FILE);

  try {
    // Start from empty users
    if (fs.existsSync(USERS_FILE)) fs.unlinkSync(USERS_FILE);

    const created = await users.createUser('alice', 'pw123', 'user');
    assert.strictEqual(created.username, 'alice');
    assert.strictEqual(created.role, 'user');

    const raw = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    assert.strictEqual(raw.length, 1);
    assert.ok(raw[0].passwordHash);
    assert.ok(Object.prototype.hasOwnProperty.call(raw[0], 'passwordAlgorithm'));

    const okUser = await users.verifyPassword('alice', 'pw123');
    assert.ok(okUser);
    const badUser = await users.verifyPassword('alice', 'wrong');
    assert.strictEqual(badUser, null);

    // Password module legacy path always works
    const legacy = passwords.hashLegacyPassword('secret', 'salt');
    const legacyOk = await passwords.verifyPassword('secret', legacy.passwordHash, legacy.passwordSalt, legacy.passwordAlgorithm);
    assert.strictEqual(legacyOk, true);
  } finally {
    restoreFile(USERS_FILE, backup);
  }

  console.log('auth tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
