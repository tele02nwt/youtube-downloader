const fs = require('fs');

const ACTIVE_STATUSES = new Set(['downloading', 'merging', 'uploading', 'pending', 'queued']);
const FAILED_STATUSES = new Set(['error', 'cancelled']);

function parseSizeToBytes(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  const raw = String(value).trim();
  const match = raw.match(/^([\d.]+)\s*([kmgt]?i?b)$/i);
  if (!match) return 0;

  const amount = Number(match[1]);
  const unit = match[2].toUpperCase();
  const multipliers = {
    B: 1,
    KB: 1000,
    MB: 1000 ** 2,
    GB: 1000 ** 3,
    TB: 1000 ** 4,
    KIB: 1024,
    MIB: 1024 ** 2,
    GIB: 1024 ** 3,
    TIB: 1024 ** 4
  };

  return Math.round(amount * (multipliers[unit] || 0));
}

function getTrackedBytes(download) {
  if (download && download.localPath && fs.existsSync(download.localPath)) {
    try {
      return fs.statSync(download.localPath).size;
    } catch (_) {
      return 0;
    }
  }

  return parseSizeToBytes(download && download.filesize);
}

function getFormatLabel(download) {
  if (!download) return 'unknown';
  if (download.audioOnly) return (download.audioFormat || 'audio').toLowerCase();
  return (download.remuxFormat || 'video').toLowerCase();
}

function toDayKey(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function getStartOfUtcDay(now) {
  const date = new Date(now);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function buildRecentActivity(downloads, now, days = 7) {
  const today = getStartOfUtcDay(now);
  const buckets = [];

  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(today);
    day.setUTCDate(today.getUTCDate() - i);
    buckets.push({
      date: day.toISOString().slice(0, 10),
      completed: 0,
      failed: 0
    });
  }

  const index = new Map(buckets.map(entry => [entry.date, entry]));
  downloads.forEach(download => {
    if (download.status === 'completed') {
      const key = toDayKey(download.completedAt || download.createdAt);
      if (key && index.has(key)) index.get(key).completed += 1;
    }
    if (FAILED_STATUSES.has(download.status)) {
      const key = toDayKey(download.completedAt || download.createdAt);
      if (key && index.has(key)) index.get(key).failed += 1;
    }
  });

  return buckets;
}

function countBy(list, mapper) {
  return list.reduce((acc, item) => {
    const key = mapper(item);
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function toSortedPairs(counts) {
  return Object.entries(counts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

function buildLogStats(logs, now) {
  const startOfDay = getStartOfUtcDay(now).toISOString();
  const todayLogs = logs.filter(log => log.timestamp >= startOfDay);
  return {
    total: logs.length,
    today: todayLogs.length,
    byLevel: {
      info: logs.filter(log => log.level === 'info').length,
      success: logs.filter(log => log.level === 'success').length,
      warn: logs.filter(log => log.level === 'warn').length,
      error: logs.filter(log => log.level === 'error').length
    },
    byCategory: countBy(logs, log => log.category || 'system')
  };
}

function buildStats({ downloads = [], categories = [], logs = [], now = new Date() } = {}) {
  const normalizedNow = new Date(now);
  const startOfDay = getStartOfUtcDay(normalizedNow).toISOString();
  const completed = downloads.filter(download => download.status === 'completed');
  const failed = downloads.filter(download => FAILED_STATUSES.has(download.status));
  const active = downloads.filter(download => ACTIVE_STATUSES.has(download.status));
  const scheduled = downloads.filter(download => download.status === 'scheduled');
  const completedToday = completed.filter(download => {
    const stamp = download.completedAt || download.createdAt;
    return stamp && stamp >= startOfDay;
  }).length;

  const completionDurations = completed
    .map(download => {
      const startedAt = new Date(download.createdAt);
      const finishedAt = new Date(download.completedAt);
      if (Number.isNaN(startedAt.getTime()) || Number.isNaN(finishedAt.getTime())) return null;
      const durationMs = finishedAt.getTime() - startedAt.getTime();
      return durationMs > 0 ? durationMs : null;
    })
    .filter(Boolean);

  const averageCompletionMinutes = completionDurations.length
    ? Math.round(completionDurations.reduce((sum, value) => sum + value, 0) / completionDurations.length / 60000)
    : 0;

  const storageBytes = downloads.reduce((sum, download) => sum + getTrackedBytes(download), 0);
  const finishedCount = completed.length + failed.length;
  const successRate = finishedCount ? Math.round((completed.length / finishedCount) * 100) : 0;

  return {
    generatedAt: normalizedNow.toISOString(),
    overview: {
      totalDownloads: downloads.length,
      completedDownloads: completed.length,
      activeDownloads: active.length,
      failedDownloads: failed.length,
      scheduledDownloads: scheduled.length,
      successRate,
      completedToday,
      uploadedToDrive: downloads.filter(download => !!(download.gdriveFileId || download.gdriveLink)).length,
      localFiles: downloads.filter(download => !!download.localPath).length,
      categories: categories.length,
      storageBytes,
      averageCompletionMinutes
    },
    breakdowns: {
      byCategory: toSortedPairs(countBy(downloads, download => download.categoryName || '未分類')),
      byFormat: toSortedPairs(countBy(downloads, getFormatLabel)),
      recentActivity: buildRecentActivity(downloads, normalizedNow)
    },
    logs: buildLogStats(logs, normalizedNow)
  };
}

module.exports = {
  buildStats,
  parseSizeToBytes
};
