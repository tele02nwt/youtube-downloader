const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const stats = require('../lib/stats');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yt-stats-'));

try {
  const existingFile = path.join(tmpDir, 'video-a.mp4');
  fs.writeFileSync(existingFile, Buffer.alloc(2048));

  const result = stats.buildStats({
    downloads: [
      {
        id: 'dl-1',
        title: 'Alpha',
        status: 'completed',
        categoryName: 'AI',
        remuxFormat: 'mp4',
        createdAt: '2026-03-14T10:00:00.000Z',
        completedAt: '2026-03-14T10:10:00.000Z',
        localPath: existingFile,
        gdriveFileId: 'g-1'
      },
      {
        id: 'dl-2',
        title: 'Beta',
        status: 'completed',
        categoryName: 'AI',
        audioOnly: true,
        audioFormat: 'mp3',
        createdAt: '2026-03-15T09:00:00.000Z',
        completedAt: '2026-03-15T09:02:00.000Z',
        filesize: '1.5MiB',
        localPath: path.join(tmpDir, 'missing.mp3')
      },
      {
        id: 'dl-3',
        title: 'Gamma',
        status: 'error',
        categoryName: 'News',
        remuxFormat: 'mkv',
        createdAt: '2026-03-15T11:00:00.000Z'
      },
      {
        id: 'dl-4',
        title: 'Delta',
        status: 'downloading',
        categoryName: 'News',
        remuxFormat: 'mp4',
        createdAt: '2026-03-15T12:00:00.000Z'
      },
      {
        id: 'dl-5',
        title: 'Epsilon',
        status: 'scheduled',
        categoryName: 'Podcasts',
        audioOnly: true,
        audioFormat: 'opus',
        createdAt: '2026-03-15T13:00:00.000Z'
      }
    ],
    categories: [
      { id: 'default', name: '未分類' },
      { id: 'ai', name: 'AI' },
      { id: 'news', name: 'News' }
    ],
    logs: [
      { id: 'log-1', timestamp: '2026-03-15T08:00:00.000Z', level: 'info', category: 'download' },
      { id: 'log-2', timestamp: '2026-03-15T08:30:00.000Z', level: 'error', category: 'download' }
    ],
    now: '2026-03-15T15:00:00.000Z'
  });

  assert.deepStrictEqual(result.overview, {
    totalDownloads: 5,
    completedDownloads: 2,
    activeDownloads: 1,
    failedDownloads: 1,
    scheduledDownloads: 1,
    successRate: 67,
    completedToday: 1,
    uploadedToDrive: 1,
    localFiles: 2,
    categories: 3,
    storageBytes: 1574912,
    averageCompletionMinutes: 6
  });

  assert.deepStrictEqual(result.breakdowns.byCategory, [
    { label: 'AI', value: 2 },
    { label: 'News', value: 2 },
    { label: 'Podcasts', value: 1 }
  ]);

  assert.deepStrictEqual(result.breakdowns.byFormat, [
    { label: 'mp4', value: 2 },
    { label: 'mkv', value: 1 },
    { label: 'mp3', value: 1 },
    { label: 'opus', value: 1 }
  ]);

  assert.deepStrictEqual(result.breakdowns.recentActivity.slice(-2), [
    { date: '2026-03-14', completed: 1, failed: 0 },
    { date: '2026-03-15', completed: 1, failed: 1 }
  ]);

  assert.deepStrictEqual(result.logs, {
    total: 2,
    today: 2,
    byLevel: {
      info: 1,
      success: 0,
      warn: 0,
      error: 1
    },
    byCategory: {
      download: 2
    }
  });

  console.log('stats tests passed');
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
