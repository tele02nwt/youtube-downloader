const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { DATA_DIR } = require('../lib/storage');
const templates = require('../lib/templates');

const TEMPLATES_FILE = path.join(DATA_DIR, 'templates.json');

function backupFile(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
}

function restoreFile(filePath, content) {
  if (content === null) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return;
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

const backup = backupFile(TEMPLATES_FILE);

try {
  restoreFile(TEMPLATES_FILE, '[]');

  const userSession = { role: 'user', userId: 'user-1' };
  const otherUserSession = { role: 'user', userId: 'user-2' };
  const adminSession = { role: 'admin', userId: 'admin-1' };

  const created = templates.create({
    name: 'Audio Fast',
    format: 'mp3',
    resolution: '',
    audioOnly: true,
    categoryId: 'cat-u1',
    categoryName: 'User 1',
    datePrefix: true,
    speedLimit: '2M'
  }, userSession);

  assert.ok(created.id);
  assert.strictEqual(created.name, 'Audio Fast');
  assert.strictEqual(created.userId, 'user-1');
  assert.strictEqual(created.audioOnly, true);
  assert.strictEqual(created.datePrefix, true);

  assert.deepStrictEqual(
    templates.list(userSession).map(template => template.id),
    [created.id]
  );
  assert.deepStrictEqual(templates.list(otherUserSession), []);
  assert.deepStrictEqual(
    templates.list(adminSession).map(template => template.id),
    [created.id]
  );

  const updated = templates.update(created.id, {
    name: 'Video HQ',
    format: 'mp4',
    resolution: '1080p',
    audioOnly: false,
    categoryId: 'default',
    categoryName: '未分類',
    datePrefix: false,
    speedLimit: ''
  }, userSession);

  assert.strictEqual(updated.name, 'Video HQ');
  assert.strictEqual(updated.audioOnly, false);
  assert.strictEqual(updated.resolution, '1080p');
  assert.strictEqual(updated.datePrefix, false);
  assert.strictEqual(updated.speedLimit, null);

  assert.throws(() => {
    templates.update(created.id, { name: 'Nope' }, otherUserSession);
  }, /Template not found/);

  const removed = templates.remove(created.id, userSession);
  assert.strictEqual(removed.id, created.id);
  assert.deepStrictEqual(templates.list(userSession), []);

  console.log('template tests passed');
} finally {
  restoreFile(TEMPLATES_FILE, backup);
}
