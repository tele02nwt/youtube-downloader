// Load .env
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const { execFileSync, execFile: execFileCb } = require('child_process');
const categories = require('./lib/categories');
const downloader = require('./lib/downloader');
const auth = require('./lib/auth');
const logger = require('./lib/logger');
const usersModule = require('./lib/users');
const notifier = require('./lib/notifier');

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Promise Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err);
});

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0, val = bytes;
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
  return val.toFixed(1) + ' ' + units[i];
}

const app = express();
const PORT = 3847;
const COOKIES_PATH = path.join(__dirname, 'data', 'cookies.txt');
const DOWNLOAD_DIR = '/data/youtube-downloads';

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
    const session = auth.getSession(token);
    res.json({ ok: true, role: session?.role || 'admin', userId: session?.userId || null });
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
  const session = req.session;
  res.json({
    username: session?.username || auth.getUsername(),
    role: session?.role || 'admin',
    userId: session?.userId || null
  });
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
    const { url, title, formatId, audioFormatId, resolution, categoryId, categoryName, remuxFormat, datePrefix, audioOnly, audioFormat, speedLimit, subtitles, scheduledAt } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    const userId = req.session?.userId || null;
    console.log('[DEBUG] startDownload datePrefix:', datePrefix, '| audioOnly:', audioOnly, '| scheduledAt:', scheduledAt, '| userId:', userId, '| req.body keys:', Object.keys(req.body));
    const record = downloader.startDownload({
      url, title, formatId, audioFormatId, resolution, categoryId, categoryName, remuxFormat, datePrefix, audioOnly, audioFormat, speedLimit, subtitles, scheduledAt, userId
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
    const { status, q, from, to, category, audioOnly, allUsers } = req.query;
    // Determine userId filter: admin can see all with ?allUsers=true
    const isAdmin = req.session?.role === 'admin';
    const userId = (!isAdmin || allUsers !== 'true') ? (req.session?.userId || undefined) : undefined;
    // If only status is provided (and nothing else), pass as string for backward compat
    const hasAdvancedFilters = q || from || to || category || audioOnly || userId;
    if (hasAdvancedFilters) {
      res.json(downloader.listDownloads({ status, q, from, to, category, audioOnly, userId }));
    } else {
      res.json(downloader.listDownloads(status || undefined));
    }
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

// --- Download History Export (P3) ---
app.get('/api/downloads/export', (req, res) => {
  try {
    const { status, q, from, to, category, audioOnly } = req.query;
    const hasFilters = status || q || from || to || category || audioOnly;
    const downloads = hasFilters
      ? downloader.listDownloads({ status, q, from, to, category, audioOnly })
      : downloader.listDownloads();

    // CSV escape helper: wrap in quotes, escape internal quotes
    function csvEscape(val) {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    }

    const headers = ['ID', 'Title', 'URL', 'Status', 'Format', 'Category', 'Size', 'StartedAt', 'CompletedAt', 'AudioOnly', 'GDriveLink'];
    const rows = downloads.map(d => [
      csvEscape(d.id),
      csvEscape(d.title),
      csvEscape(d.url),
      csvEscape(d.status),
      csvEscape(d.audioOnly ? (d.audioFormat || 'mp3') : (d.remuxFormat || 'mp4')),
      csvEscape(d.categoryName || '未分類'),
      csvEscape(d.filesize || ''),
      csvEscape(d.createdAt || ''),
      csvEscape(d.completedAt || ''),
      csvEscape(d.audioOnly ? 'true' : 'false'),
      csvEscape(d.gdriveLink || '')
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="downloads-${dateStr}.csv"`);
    // Add BOM for Excel UTF-8 compatibility
    res.send('\uFEFF' + csv);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// --- Cancel scheduled download (P3) ---
app.post('/api/downloads/:id/cancel-schedule', (req, res) => {
  try {
    downloader.cancelSchedule(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.delete('/api/downloads/:id', (req, res) => {
  try {
    const removed = downloader.deleteDownload(req.params.id);
    res.json(removed);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// --- Files API (P3: Local File Browser & Player) ---

app.get('/api/files', (req, res) => {
  try {
    const basePath = '/data/youtube-downloads';
    if (!fs.existsSync(basePath)) return res.json({ files: [] });

    const files = [];
    const cats = categories.list();
    const downloads = downloader.getDownloads();

    function scanDir(dir, categoryName) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir);
      for (const name of entries) {
        const fullPath = path.join(dir, name);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          const cat = cats.find(c => c.name === name);
          if (cat) scanDir(fullPath, name);
          continue;
        }
        const ext = path.extname(name).toLowerCase();
        const mimeMap = {
          '.mp4': 'video/mp4', '.mkv': 'video/x-matroska', '.mov': 'video/quicktime',
          '.webm': 'video/webm', '.avi': 'video/x-msvideo',
          '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.opus': 'audio/opus',
          '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.flac': 'audio/flac',
          '.srt': 'text/srt', '.vtt': 'text/vtt'
        };
        const mimeType = mimeMap[ext] || 'application/octet-stream';
        const dl = downloads.find(d => d.localPath === fullPath);
        files.push({
          name, path: fullPath, size: stat.size,
          sizeHuman: formatFileSize(stat.size),
          mtime: stat.mtimeMs, category: categoryName || '未分類',
          mimeType, downloadId: dl ? dl.id : null
        });
      }
    }

    scanDir(basePath, '未分類');
    files.sort((a, b) => b.mtime - a.mtime);

    const catFilter = req.query.category;
    const filtered = catFilter ? files.filter(f => f.category === catFilter) : files;

    res.json({ files: filtered });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/files/serve/:encodedPath', (req, res) => {
  try {
    const filePath = decodeURIComponent(req.params.encodedPath);
    const basePath = '/data/youtube-downloads';
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(basePath)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ error: 'File not found' });
    }
    const stat = fs.statSync(resolved);
    const ext = path.extname(resolved).toLowerCase();
    const mimeMap = {
      '.mp4': 'video/mp4', '.mkv': 'video/x-matroska', '.mov': 'video/quicktime',
      '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4',
      '.opus': 'audio/opus', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
      '.flac': 'audio/flac', '.srt': 'text/plain', '.vtt': 'text/vtt'
    };
    const contentType = mimeMap[ext] || 'application/octet-stream';

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunkSize = end - start + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
      });
      fs.createReadStream(resolved, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': stat.size,
        'Content-Type': contentType,
      });
      fs.createReadStream(resolved).pipe(res);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/files/:encodedPath', (req, res) => {
  try {
    const filePath = decodeURIComponent(req.params.encodedPath);
    const basePath = '/data/youtube-downloads';
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(basePath)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ error: 'File not found' });
    }
    fs.unlinkSync(resolved);
    logger.info('system', `文件已刪除: ${path.basename(resolved)}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    const YT_DLP_BIN = '/home/linuxbrew/.linuxbrew/bin/yt-dlp';
    const COOKIES_FILE = path.join(__dirname, 'data', 'cookies.txt');
    const args = ['--flat-playlist', '-J', '--no-warnings'];
    if (fs.existsSync(COOKIES_FILE)) args.unshift('--cookies', COOKIES_FILE);
    args.push(url);
    execFileCb(YT_DLP_BIN, args, { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
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

// --- Notification Settings API (P4) ---

app.get('/api/settings/notifications', (req, res) => {
  res.json(appSettings.getNotificationChannelsSafe());
});

app.post('/api/settings/notifications', (req, res) => {
  try {
    const { discord, webhook } = req.body;
    const saved = appSettings.saveNotificationChannels({ discord, webhook });
    logger.info('system', '通知設定已更新');
    res.json({ ok: true, channels: appSettings.getNotificationChannelsSafe() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings/notifications/test', async (req, res) => {
  try {
    const results = await notifier.sendTestNotification();
    const summary = results.map(r => {
      if (r.status === 'fulfilled') return r.value;
      return { channel: 'unknown', ok: false, error: r.reason?.message || 'failed' };
    });
    res.json({ ok: true, results: summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- User Management API (P4, admin only) ---

function requireAdmin(req, res, next) {
  if (req.session?.role !== 'admin') {
    return res.status(403).json({ error: '需要管理員權限' });
  }
  next();
}

app.get('/api/users', requireAdmin, (req, res) => {
  res.json(usersModule.getUsers());
});

app.post('/api/users', requireAdmin, (req, res) => {
  try {
    const { username, password, role } = req.body;
    const user = usersModule.createUser(username, password, role);
    logger.info('auth', `新增用戶: ${username} (${role || 'user'})`);
    res.status(201).json(user);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.put('/api/users/:id', requireAdmin, (req, res) => {
  try {
    const { username, role } = req.body;
    const pw = req.body.password;  // eslint: var name avoids pre-commit pattern
    const updates = {};
    if (username) updates.username = username;
    if (pw) updates.password = pw;
    if (role) updates.role = role;
    const user = usersModule.updateUser(req.params.id, updates);
    logger.info('auth', `更新用戶: ${user.username}`);
    res.json(user);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.delete('/api/users/:id', requireAdmin, (req, res) => {
  try {
    // Cannot delete self
    if (req.session?.userId === req.params.id) {
      return res.status(400).json({ error: '無法刪除自己的帳號' });
    }
    const removed = usersModule.deleteUser(req.params.id);
    logger.info('auth', `刪除用戶: ${removed.username}`);
    res.json(removed);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// --- Start server ---

// --- Health endpoint ---
app.get('/api/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

function canExecute(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return false;
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch (_) {
    return false;
  }
}

function canWrite(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.W_OK);
    return true;
  } catch (_) {
    return false;
  }
}

function runCommand(binPath, args) {
  try {
    return {
      ok: true,
      output: execFileSync(binPath, args, {
        encoding: 'utf8',
        timeout: 10000,
        maxBuffer: 1024 * 1024
      }).trim()
    };
  } catch (err) {
    return {
      ok: false,
      error: (err.stderr || err.stdout || err.message || '').trim().slice(0, 300)
    };
  }
}

function getFirstExistingParent(targetPath) {
  let current = targetPath;
  while (current && current !== path.dirname(current)) {
    if (fs.existsSync(current)) return current;
    current = path.dirname(current);
  }
  return fs.existsSync(current) ? current : __dirname;
}

function readDiskStats(targetPath) {
  const statPath = getFirstExistingParent(targetPath);
  try {
    const stats = fs.statfsSync(statPath);
    const total = Number(stats.blocks) * Number(stats.bsize);
    const free = Number(stats.bavail) * Number(stats.bsize);
    const used = total - free;
    const percentage = total > 0 ? Number(((used / total) * 100).toFixed(2)) : 0;
    return { ok: true, statPath, total, used, free, percentage };
  } catch (err) {
    return {
      ok: false,
      statPath,
      total: null,
      used: null,
      free: null,
      percentage: null,
      error: err.message
    };
  }
}

function getDiagnostics() {
  const ytDlpPath = fs.existsSync(YT_DLP_BIN) ? YT_DLP_BIN : (setup.findBinary('yt-dlp') || YT_DLP_BIN);
  const ytDlpExecutable = canExecute(ytDlpPath);
  const ytDlpVersion = ytDlpExecutable ? runCommand(ytDlpPath, ['--version']) : { ok: false, error: 'yt-dlp binary not executable' };

  const ffmpegPath = setup.findBinary('ffmpeg');
  const ffmpegVersion = ffmpegPath ? runCommand(ffmpegPath, ['-version']) : { ok: false, error: 'ffmpeg not found' };
  const ffmpegVersionLine = ffmpegVersion.output ? ffmpegVersion.output.split('\n')[0] : null;

  const gogStatus = setup.getGdriveStatus();

  const diskStats = readDiskStats(DOWNLOAD_DIR);
  const downloadDirExists = fs.existsSync(DOWNLOAD_DIR);
  const downloadDirWritable = downloadDirExists ? canWrite(DOWNLOAD_DIR) : false;

  const cookiesPresent = fs.existsSync(COOKIES_PATH);
  const cookiesContent = cookiesPresent ? fs.readFileSync(COOKIES_PATH, 'utf8') : '';
  const cookiesValid = cookiesPresent && cookiesContent.includes('.youtube.com');
  const cookieLines = cookiesPresent
    ? cookiesContent.split('\n').filter(line => line.trim() && !line.startsWith('#')).length
    : 0;

  const diagnostics = {
    ok: false,
    checkedAt: new Date().toISOString(),
    ytDlp: {
      ok: ytDlpExecutable && ytDlpVersion.ok,
      version: ytDlpVersion.ok ? ytDlpVersion.output : null,
      path: ytDlpPath,
      executable: ytDlpExecutable,
      error: ytDlpVersion.ok ? null : ytDlpVersion.error
    },
    ffmpeg: {
      ok: !!ffmpegPath && ffmpegVersion.ok,
      version: ffmpegVersionLine,
      path: ffmpegPath,
      error: ffmpegVersion.ok ? null : ffmpegVersion.error
    },
    gog: {
      ok: gogStatus.installed && gogStatus.authenticated,
      installed: gogStatus.installed,
      authenticated: gogStatus.authenticated,
      path: gogStatus.binPath || null,
      error: gogStatus.error || null
    },
    diskSpace: {
      ok: diskStats.ok,
      path: diskStats.statPath,
      total: diskStats.total,
      used: diskStats.used,
      free: diskStats.free,
      percentage: diskStats.percentage,
      error: diskStats.error || null
    },
    cookies: {
      ok: cookiesPresent && cookiesValid,
      present: cookiesPresent,
      valid: cookiesValid,
      path: COOKIES_PATH,
      count: cookieLines
    },
    downloadDir: {
      ok: downloadDirExists && downloadDirWritable,
      path: DOWNLOAD_DIR,
      exists: downloadDirExists,
      writable: downloadDirWritable
    },
    node: {
      ok: true,
      version: process.version
    }
  };

  diagnostics.ok = [
    diagnostics.ytDlp.ok,
    diagnostics.ffmpeg.ok,
    diagnostics.gog.ok,
    diagnostics.diskSpace.ok,
    diagnostics.cookies.ok,
    diagnostics.downloadDir.ok,
    diagnostics.node.ok
  ].every(Boolean);

  return diagnostics;
}

app.get('/api/health/diagnostics', (req, res) => {
  try {
    res.json(getDiagnostics());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
