const assert = require('assert');
const fs = require('fs');
const path = require('path');

const categories = require('../lib/categories');
const downloader = require('../lib/downloader');
const logger = require('../lib/logger');
const tenantAccess = require('../lib/tenant-access');
const { DATA_DIR, writeJSON } = require('../lib/storage');

const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');
const DOWNLOADS_FILE = path.join(DATA_DIR, 'downloads.json');
const LOGS_FILE = path.join(DATA_DIR, 'activity-log.json');

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

const backups = {
  categories: backupFile(CATEGORIES_FILE),
  downloads: backupFile(DOWNLOADS_FILE),
  logs: backupFile(LOGS_FILE)
};

try {
  writeJSON('categories.json', [
    { id: 'default', name: '未分類', createdAt: '2026-03-01T00:00:00.000Z', userId: null },
    { id: 'cat-u1', name: 'User 1', createdAt: '2026-03-01T00:00:00.000Z', userId: 'user-1' },
    { id: 'cat-u2', name: 'User 2', createdAt: '2026-03-01T00:00:00.000Z', userId: 'user-2' }
  ]);

  writeJSON('downloads.json', [
    {
      id: 'dl-u1',
      title: 'User 1 Download',
      url: 'https://example.com/1',
      status: 'completed',
      categoryName: 'User 1',
      createdAt: '2026-03-01T00:00:00.000Z',
      localPath: '/data/youtube-downloads/User 1/video-1.mp4',
      userId: 'user-1'
    },
    {
      id: 'dl-u2',
      title: 'User 2 Download',
      url: 'https://example.com/2',
      status: 'completed',
      categoryName: 'User 2',
      createdAt: '2026-03-01T00:00:00.000Z',
      localPath: '/data/youtube-downloads/User 2/video-2.mp4',
      userId: 'user-2'
    }
  ]);

  writeJSON('activity-log.json', [
    {
      id: 'log-u1',
      timestamp: '2026-03-01T00:00:00.000Z',
      level: 'info',
      category: 'download',
      message: 'user 1 log',
      userId: 'user-1',
      details: { userId: 'user-1' }
    },
    {
      id: 'log-u2',
      timestamp: '2026-03-01T00:00:00.000Z',
      level: 'info',
      category: 'download',
      message: 'user 2 log',
      userId: 'user-2',
      details: { userId: 'user-2' }
    }
  ]);

  const adminSession = { role: 'admin', userId: 'admin-1' };
  const userSession = { role: 'user', userId: 'user-1' };

  const userCategories = categories.list(userSession);
  assert.deepStrictEqual(
    userCategories.map(category => category.id).sort(),
    ['cat-u1', 'default']
  );

  const adminCategories = categories.list(adminSession);
  assert.deepStrictEqual(
    adminCategories.map(category => category.id).sort(),
    ['cat-u1', 'cat-u2', 'default']
  );

  const newCategory = categories.add('User 1 New', userSession.userId);
  assert.strictEqual(newCategory.userId, 'user-1');

  const userDownloads = downloader.listDownloads({ userId: userSession.userId });
  assert.deepStrictEqual(userDownloads.map(download => download.id), ['dl-u1']);

  const adminDownloads = downloader.listDownloads();
  assert.deepStrictEqual(adminDownloads.map(download => download.id).sort(), ['dl-u1', 'dl-u2']);

  const userLogs = logger.listLogs({ userId: userSession.userId });
  assert.deepStrictEqual(userLogs.map(log => log.id), ['log-u1']);

  const adminLogs = logger.listLogs({});
  assert.deepStrictEqual(adminLogs.map(log => log.id).sort(), ['log-u1', 'log-u2']);

  const visibleFiles = tenantAccess.filterFilesForSession([
    { path: '/data/youtube-downloads/User 1/video-1.mp4', name: 'video-1.mp4' },
    { path: '/data/youtube-downloads/User 2/video-2.mp4', name: 'video-2.mp4' },
    { path: '/data/youtube-downloads/orphan.mp4', name: 'orphan.mp4' }
  ], adminDownloads, userSession);
  assert.deepStrictEqual(visibleFiles.map(file => file.name), ['video-1.mp4']);

  const adminFiles = tenantAccess.filterFilesForSession([
    { path: '/data/youtube-downloads/User 1/video-1.mp4', name: 'video-1.mp4' },
    { path: '/data/youtube-downloads/User 2/video-2.mp4', name: 'video-2.mp4' },
    { path: '/data/youtube-downloads/orphan.mp4', name: 'orphan.mp4' }
  ], adminDownloads, adminSession);
  assert.deepStrictEqual(adminFiles.map(file => file.name).sort(), ['orphan.mp4', 'video-1.mp4', 'video-2.mp4']);

  console.log('tenant isolation tests passed');
} finally {
  restoreFile(CATEGORIES_FILE, backups.categories);
  restoreFile(DOWNLOADS_FILE, backups.downloads);
  restoreFile(LOGS_FILE, backups.logs);
}
