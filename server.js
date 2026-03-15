// Load .env
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const categories = require('./lib/categories');
const downloader = require('./lib/downloader');
const auth = require('./lib/auth');
const logger = require('./lib/logger');

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Promise Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err);
});

const app = express();
const PORT = 3847;
const COOKIES_PATH = path.join(__dirname, 'data', 'cookies.txt');

// SSE clients for download progress streaming (P2)
const _sseClients = new Map();
const MAX_SSE_CLIENTS = 10;

function broadcastDownloads() {
  if (_sseClients.size === 0) return;
  const data = JSON.stringify(downloader.getDownloads());
  for (const [id, res] of _sseClients) {
    try { res.write(`data: ${data}\n\n`); } catch (e) { _sseClients.delete(id); }
  }
}

// Listen to downloader events for SSE broadcasting
downloader.downloadEvents.on('update', broadcastDownloads);

// Middleware
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || 'https://yt.ac02nwt.work', credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '5mb' }));
app.use(express.text({ type: 'text/plain', limit: '5mb' }));

// Auth middleware (before static files!)
app.use(auth.authMiddleware);

app.use(express.static(path.join(__dirname, 'public')));

// --- Auth API ---

app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const token = auth.login(username, password);
    logger.info('auth', `用戶登入: ${username}`);
    res.cookie('yt_session', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24h
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies && req.cookies.yt_session;
  if (token) auth.logout(token);
  res.clearCookie('yt_session');
  res.json({ ok: true });
});

app.get('/api/auth/check', (req, res) => {
  const token = req.cookies && req.cookies.yt_session;
  res.json({ authenticated: auth.validate(token) });
});

app.get('/api/auth/info', (req, res) => {
  res.json({ username: auth.getUsername() });
});

app.post('/api/auth/update-credentials', (req, res) => {
  try {
    const { currentPassword, newUsername, newPassword } = req.body;
    const result = auth.updateCredentials(currentPassword, newUsername, newPassword);
    res.clearCookie('yt_session');
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/auth/forgot-password', (req, res) => {
  try {
    const { email } = req.body;
    const result = auth.sendVerificationCode(email);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/auth/verify-code', (req, res) => {
  try {
    const { email, code } = req.body;
    const result = auth.verifyCode(email, code);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// --- Categories API ---

app.get('/api/categories', (req, res) => {
  try {
    res.json(categories.list());
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/categories', (req, res) => {
  try {
    const cat = categories.add(req.body.name);
    logger.info('category', `新增分類: ${req.body.name}`);
    res.status(201).json(cat);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.put('/api/categories/reorder', (req, res) => {
  try {
    const result = categories.reorder(req.body.ids);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.put('/api/categories/:id', (req, res) => {
  try {
    const cat = categories.update(req.params.id, req.body.name);
    res.json(cat);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.delete('/api/categories/:id', (req, res) => {
  try {
    const cat = categories.remove(req.params.id);
    logger.info('category', `刪除分類: ${cat.name || req.params.id}`);
    res.json(cat);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// --- Download API ---

app.post('/api/download/probe', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    const info = await downloader.probe(url);
    res.json(info);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/download/start', (req, res) => {
  try {
    const { url, title, formatId, audioFormatId, resolution, categoryId, categoryName, remuxFormat, datePrefix, audioOnly, audioFormat, speedLimit, subtitles } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    console.log('[DEBUG] startDownload datePrefix:', datePrefix, '| audioOnly:', audioOnly, '| req.body keys:', Object.keys(req.body));
    const record = downloader.startDownload({
      url, title, formatId, audioFormatId, resolution, categoryId, categoryName, remuxFormat, datePrefix, audioOnly, audioFormat, speedLimit, subtitles
    });
    res.status(201).json(record);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/api/download/status/:id', (req, res) => {
  try {
    const status = downloader.getStatus(req.params.id);
    if (!status) {
      return res.status(404).json({ error: 'Download not found' });
    }
    res.json(status);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// --- Download Queue Status (P1) ---
app.get('/api/downloads/queue', (req, res) => {
  res.json(downloader.getQueueStatus());
});

// --- Retry failed download (P1) ---
app.post('/api/downloads/:id/retry', (req, res) => {
  try {
    const newRecord = downloader.retryDownload(req.params.id);
    res.status(201).json({ success: true, newId: newRecord.id, record: newRecord });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/api/downloads', (req, res) => {
  try {
    const { status } = req.query;
    res.json(downloader.listDownloads(status));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// --- SSE Download Stream (P2) ---
app.get('/api/downloads/stream', (req, res) => {
  if (_sseClients.size >= MAX_SSE_CLIENTS) {
    return res.status(503).json({ error: 'Too many SSE connections' });
  }
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const clientId = Date.now() + Math.random();
  _sseClients.set(clientId, res);

  // Send current state immediately
  const downloads = downloader.getDownloads();
  res.write(`data: ${JSON.stringify(downloads)}\n\n`);

  // Keepalive every 30s
  const keepalive = setInterval(() => {
    try { res.write(': keepalive\n\n'); } catch (e) { /* ignore */ }
  }, 30000);

  req.on('close', () => {
    _sseClients.delete(clientId);
    clearInterval(keepalive);
  });
});

app.delete('/api/downloads/:id', (req, res) => {
  try {
    const removed = downloader.deleteDownload(req.params.id);
    res.json(removed);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// --- Logs API ---

app.get('/api/logs', (req, res) => {
  try {
    const { category, level, limit, before } = req.query;
    const logs = logger.listLogs({
      category: category || undefined,
      level: level || undefined,
      limit: limit ? parseInt(limit) : 100,
      before: before || undefined
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/logs/stats', (req, res) => {
  try {
    res.json(logger.getStats());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/logs', (req, res) => {
  try {
    logger.clearLogs();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Cookies API ---

app.get('/api/cookies/status', (req, res) => {
  const exists = fs.existsSync(COOKIES_PATH);
  let lines = 0;
  if (exists) {
    const content = fs.readFileSync(COOKIES_PATH, 'utf8');
    lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#')).length;
  }
  res.json({ hasCookies: exists, cookieCount: lines });
});

app.post('/api/cookies/upload', (req, res) => {
  try {
    let content = '';
    if (typeof req.body === 'string') {
      content = req.body;
    } else if (req.body && req.body.content) {
      content = req.body.content;
    }
    if (!content || !content.includes('.youtube.com')) {
      return res.status(400).json({ error: 'Invalid cookies.txt — must contain .youtube.com entries' });
    }
    fs.writeFileSync(COOKIES_PATH, content, 'utf8');
    const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#')).length;
    res.json({ ok: true, cookieCount: lines });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/cookies', (req, res) => {
  if (fs.existsSync(COOKIES_PATH)) fs.unlinkSync(COOKIES_PATH);
  res.json({ ok: true });
});

// --- Settings API (Telegram) ---
const appSettings = require('./lib/settings');

app.get('/api/settings/telegram', (req, res) => {
  res.json(appSettings.getTelegramSettings());
});

app.post('/api/settings/telegram', (req, res) => {
  try {
    const { enabled, groupId, topicId } = req.body;
    const saved = appSettings.saveTelegramSettings({ enabled, groupId, topicId });
    logger.info('system', `Telegram 設定已更新: group=${saved.groupId}, topic=${saved.topicId}, enabled=${saved.enabled}`);
    res.json({ ok: true, telegram: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings/telegram/test', (req, res) => {
  try {
    const { groupId, topicId } = req.body;
    if (!groupId) return res.status(400).json({ error: '請填寫 Group ID' });
    const { execFile } = require('child_process');
    const args = [
      'message', 'send',
      '--channel', 'telegram',
      '--target', groupId.trim(),
      '--message', '✅ YouTube Downloader — Telegram 通知測試成功！'
    ];
    if (topicId && topicId.trim()) args.push('--thread-id', topicId.trim());
    execFile('openclaw', args, { timeout: 15000 }, (err) => {
      if (err) {
        logger.warn('system', `Telegram 測試失敗: ${err.message}`);
        return res.status(500).json({ error: err.message });
      }
      res.json({ ok: true });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Speed Limit Settings (P2) ---
app.get('/api/settings/speed-limit', (req, res) => {
  res.json({ speedLimit: appSettings.getDownloadSpeedLimit() });
});

app.post('/api/settings/speed-limit', (req, res) => {
  try {
    const { speedLimit } = req.body;
    const saved = appSettings.saveDownloadSpeedLimit(speedLimit);
    logger.info('system', `下載速度限制已更新: ${saved || '無限制'}`);
    res.json({ ok: true, speedLimit: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Playlist Probe (P2) ---
app.post('/api/probe/playlist', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    const { execFile: ef } = require('child_process');
    const YT_DLP_BIN = '/home/linuxbrew/.linuxbrew/bin/yt-dlp';
    const COOKIES_FILE = path.join(__dirname, 'data', 'cookies.txt');
    const args = ['--flat-playlist', '-J', '--no-warnings'];
    if (fs.existsSync(COOKIES_FILE)) args.unshift('--cookies', COOKIES_FILE);
    args.push(url);
    ef(YT_DLP_BIN, args, { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
      if (err) return res.status(500).json({ error: err.message });
      try {
        const data = JSON.parse(stdout);
        const entries = (data.entries || []).slice(0, 50).map(e => ({
          id: e.id,
          title: e.title || 'Unknown',
          duration: e.duration || null,
          url: e.url || (e.id ? 'https://www.youtube.com/watch?v=' + e.id : null)
        }));
        res.json({
          isPlaylist: true,
          title: data.title || 'Playlist',
          count: (data.entries || []).length,
          entries
        });
      } catch (e) {
        res.status(500).json({ error: 'Failed to parse playlist: ' + e.message });
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- yt-dlp Auto-Update API (P1) ---
const { execFile: execFileCb } = require('child_process');
const YT_DLP_BIN = '/home/linuxbrew/.linuxbrew/bin/yt-dlp';
const YTDLP_UPDATE_LOG = path.join(__dirname, 'data', 'ytdlp-update.log');
let _ytdlpUpdateRunning = false;

app.get('/api/setup/ytdlp/version', (req, res) => {
  execFileCb(YT_DLP_BIN, ['--version'], { timeout: 10000 }, (err, stdout) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ version: stdout.trim() });
  });
});

app.post('/api/setup/ytdlp/update', (req, res) => {
  if (_ytdlpUpdateRunning) return res.json({ started: false, message: 'Update already in progress' });
  _ytdlpUpdateRunning = true;
  fs.writeFileSync(YTDLP_UPDATE_LOG, '', 'utf8');

  const child = require('child_process').spawn(YT_DLP_BIN, ['-U'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env
  });

  function appendLog(text) {
    fs.appendFileSync(YTDLP_UPDATE_LOG, text, 'utf8');
  }
  child.stdout.on('data', d => appendLog(d.toString()));
  child.stderr.on('data', d => appendLog(d.toString()));
  child.on('close', () => { _ytdlpUpdateRunning = false; });
  child.on('error', (err) => {
    appendLog('ERROR: ' + err.message + '\n');
    _ytdlpUpdateRunning = false;
  });

  res.json({ started: true });
});

app.get('/api/setup/ytdlp/update-status', (req, res) => {
  let log = '';
  try { log = fs.readFileSync(YTDLP_UPDATE_LOG, 'utf8'); } catch (_) {}
  const lines = log.split('\n').filter(Boolean);
  const last20 = lines.slice(-20);
  // Get current version after update
  execFileCb(YT_DLP_BIN, ['--version'], { timeout: 10000 }, (err, stdout) => {
    res.json({
      running: _ytdlpUpdateRunning,
      lines: last20,
      version: err ? null : stdout.trim()
    });
  });
});

// --- Setup API (Cloudflare + Google Drive) ---
const setup = require('./lib/setup');

app.get('/api/setup/cloudflare/status', (req, res) => {
  res.json(setup.getCloudflaredStatus());
});

app.post('/api/setup/cloudflare/start', (req, res) => {
  try {
    const { mode, port, token } = req.body;
    res.json(setup.startTunnel(mode || 'quick', { port, token }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/setup/cloudflare/stop', (req, res) => {
  try { res.json(setup.stopTunnel()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/setup/gdrive/status', (req, res) => {
  res.json(setup.getGdriveStatus());
});

app.post('/api/setup/gdrive/auth', (req, res) => {
  try { res.json(setup.startGdriveAuth()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/setup/gdrive/auth-poll', (req, res) => {
  res.json(setup.getAuthPoll());
});

// --- Start server ---

// --- Health endpoint ---
app.get('/api/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

const server = app.listen(PORT, () => {
  console.log(`YouTube Downloader server running on http://localhost:${PORT}`);
});

// --- Graceful shutdown ---
let shuttingDown = false;
function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[${signal}] Shutting down gracefully...`);

  // Flush in-memory download state to disk before exit
  try { downloader.flushToDisk(); } catch (e) {
    console.error('Failed to flush downloads:', e.message);
  }

  // Kill all active download child processes
  const active = downloader.activeProcesses;
  for (const id of Object.keys(active)) {
    try { active[id].kill('SIGTERM'); } catch (e) {}
    delete active[id];
  }

  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });

  // Force exit after 5s
  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 5000).unref();
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
