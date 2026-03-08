const path = require('path');
const { readJSON, writeJSON } = require('./storage');

const LOG_FILE = 'activity-log.json';
const MAX_LOGS = 500; // keep last 500 entries

/**
 * Log levels: info, success, warn, error
 * Categories: download, upload, probe, auth, system, category
 */

function getLogs() {
  return readJSON(LOG_FILE) || [];
}

function saveLogs(logs) {
  // Trim to max
  if (logs.length > MAX_LOGS) {
    logs = logs.slice(logs.length - MAX_LOGS);
  }
  writeJSON(LOG_FILE, logs);
}

function addLog({ level, category, message, details }) {
  const logs = getLogs();
  logs.push({
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
    timestamp: new Date().toISOString(),
    level: level || 'info',
    category: category || 'system',
    message,
    details: details || null
  });
  saveLogs(logs);
}

// Convenience methods
function info(category, message, details) {
  addLog({ level: 'info', category, message, details });
}

function success(category, message, details) {
  addLog({ level: 'success', category, message, details });
}

function warn(category, message, details) {
  addLog({ level: 'warn', category, message, details });
}

function error(category, message, details) {
  addLog({ level: 'error', category, message, details });
}

function listLogs({ category, level, limit, before } = {}) {
  let logs = getLogs();

  // Reverse for newest first
  logs = logs.slice().reverse();

  if (category) {
    logs = logs.filter(l => l.category === category);
  }
  if (level) {
    logs = logs.filter(l => l.level === level);
  }
  if (before) {
    logs = logs.filter(l => l.timestamp < before);
  }
  if (limit) {
    logs = logs.slice(0, limit);
  }

  return logs;
}

function clearLogs() {
  writeJSON(LOG_FILE, []);
}

function getStats() {
  const logs = getLogs();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const todayLogs = logs.filter(l => l.timestamp >= today);

  return {
    total: logs.length,
    today: todayLogs.length,
    byLevel: {
      info: logs.filter(l => l.level === 'info').length,
      success: logs.filter(l => l.level === 'success').length,
      warn: logs.filter(l => l.level === 'warn').length,
      error: logs.filter(l => l.level === 'error').length,
    },
    byCategory: logs.reduce((acc, l) => {
      acc[l.category] = (acc[l.category] || 0) + 1;
      return acc;
    }, {})
  };
}

module.exports = { addLog, info, success, warn, error, listLogs, clearLogs, getStats, getLogs };
