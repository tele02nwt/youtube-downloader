/**
 * notifier.js — Multi-channel notification system (P4)
 * Supports: Telegram, Discord, Generic Webhook
 */

const { execFile } = require('child_process');
const crypto = require('crypto');
const logger = require('./logger');
const appSettings = require('./settings');

/**
 * Send notification to all enabled channels
 * @param {string} event - Event type: download_complete, download_error, upload_complete, server_restart
 * @param {object} data - { title, url, status, fileSize, gdrivePath, error, resolution, format, categoryName }
 */
async function sendNotification(event, data) {
  const channels = appSettings.getNotificationChannels();

  const promises = [];

  // Telegram
  if (channels.telegram && channels.telegram.enabled) {
    promises.push(_sendTelegram(event, data, channels.telegram));
  }

  // Discord
  if (channels.discord && channels.discord.enabled && channels.discord.webhookUrl) {
    promises.push(_sendDiscord(event, data, channels.discord));
  }

  // Generic Webhook
  if (channels.webhook && channels.webhook.enabled && channels.webhook.url) {
    promises.push(_sendWebhook(event, data, channels.webhook));
  }

  // Fire-and-forget: never let notification errors crash main flow
  const results = await Promise.allSettled(promises);
  for (const r of results) {
    if (r.status === 'rejected') {
      console.error('Notification channel error:', r.reason?.message || r.reason);
    }
  }
  return results;
}

/**
 * Send test notification to all enabled channels
 */
async function sendTestNotification() {
  const event = 'test';
  const data = {
    title: 'YouTube Downloader — 通知測試',
    status: 'test',
    timestamp: new Date().toISOString()
  };
  return sendNotification(event, data);
}

// --- Telegram (via openclaw CLI) ---
function _sendTelegram(event, data, config) {
  return new Promise((resolve, reject) => {
    try {
      const tg = appSettings.getTelegramSettings();
      if (!tg.groupId) return resolve({ channel: 'telegram', ok: false, error: 'No group ID' });

      const msg = _formatTelegramMessage(event, data);
      const args = [
        'message', 'send',
        '--channel', 'telegram',
        '--target', tg.groupId,
        '--message', msg
      ];
      if (tg.topicId) args.push('--thread-id', tg.topicId);

      execFile('openclaw', args, { timeout: 15000 }, (err) => {
        if (err) {
          logger.warn('system', `Telegram 通知失敗: ${err.message}`, { event });
          return resolve({ channel: 'telegram', ok: false, error: err.message });
        }
        resolve({ channel: 'telegram', ok: true });
      });
    } catch (e) {
      resolve({ channel: 'telegram', ok: false, error: e.message });
    }
  });
}

function _formatTelegramMessage(event, data) {
  switch (event) {
    case 'download_complete':
      return [
        '✅ 下載完成',
        `📺 ${data.title || 'Unknown'}`,
        `📐 ${data.resolution || 'best'} | ${(data.format || 'mp4').toUpperCase()}`,
        data.categoryName ? `📂 分類: ${data.categoryName}` : '',
        data.gdrivePath ? `🔗 ${data.gdrivePath}` : '⚠️ Google Drive 上傳失敗',
      ].filter(Boolean).join('\n');
    case 'download_error':
      return `❌ 下載失敗\n📺 ${data.title || 'Unknown'}\n⚠️ ${(data.error || '').substring(0, 200)}`;
    case 'upload_complete':
      return `📤 上傳完成\n📺 ${data.title || 'Unknown'}\n🔗 ${data.gdrivePath || ''}`;
    case 'server_restart':
      return `🔄 伺服器已重啟\n⏱️ ${new Date().toLocaleString('zh-TW')}`;
    case 'test':
      return `✅ ${data.title || 'YouTube Downloader — 通知測試成功！'}`;
    default:
      return `📢 ${event}: ${data.title || JSON.stringify(data)}`;
  }
}

// --- Discord (webhook) ---
async function _sendDiscord(event, data, config) {
  try {
    const { title, description, color } = _formatDiscordEmbed(event, data);
    const payload = {
      embeds: [{
        title,
        description,
        color,
        timestamp: new Date().toISOString(),
        footer: { text: 'YouTube Downloader' }
      }]
    };

    const res = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000)
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      logger.warn('system', `Discord 通知失敗: HTTP ${res.status}`, { event, error: errText.substring(0, 200) });
      return { channel: 'discord', ok: false, error: `HTTP ${res.status}` };
    }
    return { channel: 'discord', ok: true };
  } catch (e) {
    logger.warn('system', `Discord 通知失敗: ${e.message}`, { event });
    return { channel: 'discord', ok: false, error: e.message };
  }
}

function _formatDiscordEmbed(event, data) {
  switch (event) {
    case 'download_complete':
      return {
        title: '✅ 下載完成',
        description: [
          `**${data.title || 'Unknown'}**`,
          `📐 ${data.resolution || 'best'} | ${(data.format || 'mp4').toUpperCase()}`,
          data.categoryName ? `📂 ${data.categoryName}` : '',
          data.gdrivePath ? `🔗 [Google Drive](${data.gdrivePath})` : '',
        ].filter(Boolean).join('\n'),
        color: 3066993 // green
      };
    case 'download_error':
      return {
        title: '❌ 下載失敗',
        description: `**${data.title || 'Unknown'}**\n⚠️ ${(data.error || '').substring(0, 500)}`,
        color: 15158332 // red
      };
    case 'upload_complete':
      return {
        title: '📤 上傳完成',
        description: `**${data.title || 'Unknown'}**\n🔗 ${data.gdrivePath || ''}`,
        color: 3447003 // blue
      };
    case 'server_restart':
      return {
        title: '🔄 伺服器已重啟',
        description: `⏱️ ${new Date().toLocaleString('zh-TW')}`,
        color: 16776960 // yellow
      };
    case 'test':
      return {
        title: '🧪 通知測試',
        description: data.title || 'YouTube Downloader 通知測試成功！',
        color: 3066993
      };
    default:
      return {
        title: `📢 ${event}`,
        description: data.title || JSON.stringify(data),
        color: 10070709
      };
  }
}

// --- Generic Webhook ---
async function _sendWebhook(event, data, config) {
  try {
    const payload = JSON.stringify({
      event,
      title: data.title || '',
      url: data.url || '',
      status: data.status || event,
      fileSize: data.fileSize || null,
      gdrivePath: data.gdrivePath || null,
      error: data.error || null,
      timestamp: new Date().toISOString()
    });

    const headers = { 'Content-Type': 'application/json' };

    // HMAC-SHA256 signature if secret is set
    if (config.secret) {
      const sig = crypto.createHmac('sha256', config.secret).update(payload).digest('hex');
      headers['X-Signature-256'] = `sha256=${sig}`;
    }

    const method = (config.method || 'POST').toUpperCase();
    const fetchOpts = {
      method,
      headers,
      signal: AbortSignal.timeout(15000)
    };
    if (method !== 'GET') {
      fetchOpts.body = payload;
    }

    const res = await fetch(config.url, fetchOpts);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      logger.warn('system', `Webhook 通知失敗: HTTP ${res.status}`, { event, error: errText.substring(0, 200) });
      return { channel: 'webhook', ok: false, error: `HTTP ${res.status}` };
    }
    return { channel: 'webhook', ok: true };
  } catch (e) {
    logger.warn('system', `Webhook 通知失敗: ${e.message}`, { event });
    return { channel: 'webhook', ok: false, error: e.message };
  }
}

module.exports = { sendNotification, sendTestNotification };
