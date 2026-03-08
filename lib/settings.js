/**
 * settings.js — 持久化應用設定
 * 存儲於 data/settings.json
 */

const { readJSON, writeJSON } = require('./storage');

const SETTINGS_FILE = 'settings.json'; // 相對於 data/

const DEFAULTS = {
  telegram: {
    enabled: false,
    groupId: '',
    topicId: ''
  }
};

function loadSettings() {
  const saved = readJSON(SETTINGS_FILE) || {};
  // Deep merge with defaults
  return {
    ...DEFAULTS,
    ...saved,
    telegram: {
      ...DEFAULTS.telegram,
      ...(saved.telegram || {})
    }
  };
}

function saveSettings(settings) {
  writeJSON(SETTINGS_FILE, settings);
  return settings;
}

function getTelegramSettings() {
  return loadSettings().telegram;
}

function saveTelegramSettings({ enabled, groupId, topicId }) {
  const settings = loadSettings();
  settings.telegram = {
    enabled: !!enabled,
    groupId: (groupId || '').trim(),
    topicId: (topicId || '').trim()
  };
  saveSettings(settings);
  return settings.telegram;
}

module.exports = { loadSettings, saveSettings, getTelegramSettings, saveTelegramSettings };
