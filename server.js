require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const { execFileSync, execFile: execFileCb } = require('child_process');

const auth = require('./lib/auth');
const categories = require('./lib/categories');
const templates = require('./lib/templates');
const downloader = require('./lib/downloader');
const logger = require('./lib/logger');
const usersModule = require('./lib/users');
const notifier = require('./lib/notifier');
const tenantAccess = require('./lib/tenant-access');
const stats = require('./lib/stats');
const appSettings = require('./lib/settings');
const setup = require('./lib/setup');

const routeModules = [
  require('./routes/auth'),
  require('./routes/categories'),
  require('./routes/templates'),
  require('./routes/downloads'),
  require('./routes/stats'),
  require('./routes/health'),
  require('./routes/logs'),
  require('./routes/users'),
  require('./routes/files'),
  require('./routes/settings')
];

const PORT = 3847;
const COOKIES_PATH = path.join(__dirname, 'data', 'cookies.txt');
const DOWNLOAD_DIR = '/data/youtube-downloads';
const YT_DLP_BIN = '/home/linuxbrew/.linuxbrew/bin/yt-dlp';
const YTDLP_UPDATE_LOG = path.join(__dirname, 'data', 'ytdlp-update.log');

process.on('unhandledRejection', (reason) => {
  console.error('[CRITICAL] Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err);
});

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return val.toFixed(1) + ' ' + units[i];
}

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
    const disk = fs.statfsSync(statPath);
    const total = Number(disk.blocks) * Number(disk.bsize);
    const free = Number(disk.bavail) * Number(disk.bsize);
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

function getDiagnostics(context) {
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
    ? cookiesContent.split('\n').filter((line) => line.trim() && !line.startsWith('#')).length
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
    },
    server: {
      ok: true,
      port: context.port
    }
  };

  diagnostics.ok = [
    diagnostics.ytDlp.ok,
    diagnostics.ffmpeg.ok,
    diagnostics.gog.ok,
    diagnostics.diskSpace.ok,
    diagnostics.cookies.ok,
    diagnostics.downloadDir.ok,
    diagnostics.node.ok,
    diagnostics.server.ok
  ].every(Boolean);

  return diagnostics;
}

function requireAdmin(req, res, next) {
  if (req.session?.role !== 'admin') {
    return res.status(403).json({ error: '需要管理員權限' });
  }
  next();
}

function createRouteContext(overrides = {}) {
  const context = {
    auth,
    categories,
    templates,
    downloader,
    logger,
    usersModule,
    notifier,
    tenantAccess,
    stats,
    appSettings,
    setup,
    path,
    fs,
    execFileSync,
    execFileCb,
    port: overrides.port || PORT,
    constants: {
      PORT,
      COOKIES_PATH,
      DOWNLOAD_DIR,
      YT_DLP_BIN,
      YTDLP_UPDATE_LOG
    },
    state: {
      sseClients: new Map(),
      maxSseClients: 10,
      ytdlpUpdateRunning: false
    },
    helpers: {
      formatFileSize,
      canExecute,
      canWrite,
      runCommand,
      getFirstExistingParent,
      readDiskStats,
      getDiagnostics: () => getDiagnostics(context),
      requireAdmin
    }
  };

  // Kick async initialization tasks (non-blocking)
  if (typeof auth.initialize === 'function') {
    context.state.authInit = auth.initialize().catch((err) => {
      console.error('[Auth] initialize failed:', err && err.message ? err.message : err);
    });
  }

  context.broadcastDownloads = function broadcastDownloads() {
    if (context.state.sseClients.size === 0) return;
    const downloads = downloader.getDownloads();
    for (const [id, client] of context.state.sseClients) {
      try {
        const scoped = tenantAccess.filterRecordsForSession(downloads, client.session);
        client.res.write(`data: ${JSON.stringify(scoped)}\n\n`);
      } catch (_) {
        context.state.sseClients.delete(id);
      }
    }
  };

  downloader.downloadEvents.on('update', context.broadcastDownloads);
  return context;
}

function createApp(options = {}) {
  const app = express();
  const routeContext = createRouteContext(options);

  app.locals.routeContext = routeContext;

  app.set('trust proxy', 1); // Trust Cloudflare/reverse proxy
  app.use(cors({ origin: process.env.ALLOWED_ORIGIN || 'https://yt.ac02nwt.work', credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: '5mb' }));
  app.use(express.text({ type: 'text/plain', limit: '5mb' }));
  app.use(auth.authMiddleware);

  // Disable caching for JS/CSS/HTML so updates are always picked up
  app.use((req, res, next) => {
    if (req.path.match(/\.(js|css|html)$/)) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    next();
  });
  app.use(express.static(path.join(__dirname, 'public')));

  routeModules.forEach((routeModule) => routeModule.register(app));

  return { app, routeContext };
}

function attachGracefulShutdown(server, routeContext) {
  let shuttingDown = false;

  function gracefulShutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[${signal}] Shutting down gracefully...`);

    try {
      downloader.flushToDisk();
    } catch (err) {
      console.error('Failed to flush downloads:', err.message);
    }

    const active = downloader.activeProcesses;
    for (const id of Object.keys(active)) {
      try {
        active[id].kill('SIGTERM');
      } catch (_) {
        // ignore kill failure during shutdown
      }
      delete active[id];
    }

    downloader.downloadEvents.off('update', routeContext.broadcastDownloads);

    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });

    setTimeout(() => {
      console.error('Forced shutdown after timeout.');
      process.exit(1);
    }, 5000).unref();
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

function startServer(options = {}) {
  const { app, routeContext } = createApp(options);
  const port = options.port || PORT;
  routeContext.port = port;

  const server = app.listen(port, () => {
    console.log(`YouTube Downloader server running on http://localhost:${port}`);
  });

  if (options.attachShutdown !== false) {
    attachGracefulShutdown(server, routeContext);
  }

  return { app, server, routeContext };
}

if (require.main === module) {
  startServer();
}

module.exports = {
  PORT,
  createApp,
  startServer
};
