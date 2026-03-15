function register(app) {
  const ctx = app.locals.routeContext;
  const {
    fs,
    path,
    execFileCb,
    logger,
    appSettings,
    setup,
    notifier
  } = ctx;

  const COOKIES_PATH = ctx.constants.COOKIES_PATH;
  const YT_DLP_BIN = ctx.constants.YT_DLP_BIN;
  const YTDLP_UPDATE_LOG = ctx.constants.YTDLP_UPDATE_LOG;

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
      const cookiesFile = COOKIES_PATH;
      const args = ['--flat-playlist', '-J', '--no-warnings'];
      if (fs.existsSync(cookiesFile)) args.unshift('--cookies', cookiesFile);
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

  app.get('/api/setup/ytdlp/version', (req, res) => {
    execFileCb(YT_DLP_BIN, ['--version'], { timeout: 10000 }, (err, stdout) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ version: stdout.trim() });
    });
  });

  app.post('/api/setup/ytdlp/update', (req, res) => {
    if (ctx.state.ytdlpUpdateRunning) return res.json({ started: false, message: 'Update already in progress' });
    ctx.state.ytdlpUpdateRunning = true;
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
    child.on('close', () => { ctx.state.ytdlpUpdateRunning = false; });
    child.on('error', (err) => {
      appendLog('ERROR: ' + err.message + '\n');
      ctx.state.ytdlpUpdateRunning = false;
    });

    res.json({ started: true });
  });

  app.get('/api/setup/ytdlp/update-status', (req, res) => {
    let log = '';
    try { log = fs.readFileSync(YTDLP_UPDATE_LOG, 'utf8'); } catch (_) {}
    const lines = log.split('\n').filter(Boolean);
    const last20 = lines.slice(-20);
    execFileCb(YT_DLP_BIN, ['--version'], { timeout: 10000 }, (err, stdout) => {
      res.json({
        running: ctx.state.ytdlpUpdateRunning,
        lines: last20,
        version: err ? null : stdout.trim()
      });
    });
  });

  // --- Setup API (Cloudflare + Google Drive) ---

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
    try {
      res.json(setup.stopTunnel());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/setup/gdrive/status', (req, res) => {
    res.json(setup.getGdriveStatus());
  });

  app.post('/api/setup/gdrive/auth', (req, res) => {
    try {
      res.json(setup.startGdriveAuth());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
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
      appSettings.saveNotificationChannels({ discord, webhook });
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
}

module.exports = { register };
