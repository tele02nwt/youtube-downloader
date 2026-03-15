/**
 * settings.js — 持久化應用設定
 * 存儲於 data/settings.json
 */

const { readJSON, writeJSON } = require('./storage');

const SETTINGS_FILE = 'settings.json'; // 相對於 data/

const DEFAULTS = {
  telegram: {
    enabled: false,
    groupId: '-1003817368779',
    topicId: '191'
  },
  downloadSpeedLimit: '',  // '' = unlimited, '1M', '2M', '5M', '10M'
  notificationChannels: {
    discord: { enabled: false, webhookUrl: '' },
    webhook: { enabled: false, url: '', method: 'POST', secret: '' }
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
    },
    notificationChannels: {
      discord: { ...DEFAULTS.notificationChannels.discord, ...(saved.notificationChannels?.discord || {}) },
      webhook: { ...DEFAULTS.notificationChannels.webhook, ...(saved.notificationChannels?.webhook || {}) }
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

function getDownloadSpeedLimit() {
  return loadSettings().downloadSpeedLimit || '';
}

function saveDownloadSpeedLimit(limit) {
  const settings = loadSettings();
  settings.downloadSpeedLimit = (limit || '').trim();
  saveSettings(settings);
  return settings.downloadSpeedLimit;
}

function getNotificationChannels() {
  const s = loadSettings();
  return {
    telegram: s.telegram,
    discord: s.notificationChannels.discord,
    webhook: s.notificationChannels.webhook
  };
}

function saveNotificationChannels({ discord, webhook }) {
  const settings = loadSettings();
  if (discord) {
    settings.notificationChannels.discord = {
      enabled: !!discord.enabled,
      webhookUrl: (discord.webhookUrl || '').trim()
    };
  }
  if (webhook) {
    settings.notificationChannels.webhook = {
      enabled: !!webhook.enabled,
      url: (webhook.url || '').trim(),
      method: (webhook.method || 'POST').toUpperCase(),
      secret: (webhook.secret || '').trim()
    };
  }
  saveSettings(settings);
  return getNotificationChannels();
}

function getNotificationChannelsSafe() {
  const channels = getNotificationChannels();
  // Mask secrets for API response
  return {
    telegram: channels.telegram,
    discord: {
      ...channels.discord,
      webhookUrl: channels.discord.webhookUrl ? '••••' + channels.discord.webhookUrl.slice(-8) : ''
    },
    webhook: {
      ...channels.webhook,
      secret: channels.webhook.secret ? '••••••' : ''
    }
  };
}

module.exports = {
  loadSettings, saveSettings,
  getTelegramSettings, saveTelegramSettings,
  getDownloadSpeedLimit, saveDownloadSpeedLimit,
  getNotificationChannels, saveNotificationChannels, getNotificationChannelsSafe
};
