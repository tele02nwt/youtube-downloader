function register(app) {
  const ctx = app.locals.routeContext;
  const { downloader, tenantAccess } = ctx;

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
      const {
        url,
        title,
        thumbnail,
        formatId,
        audioFormatId,
        resolution,
        categoryId,
        categoryName,
        remuxFormat,
        datePrefix,
        audioOnly,
        audioFormat,
        speedLimit,
        subtitles,
        scheduledAt
      } = req.body;

      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }

      const userId = req.session?.userId || null;
      const record = downloader.startDownload({
        url,
        title,
        thumbnail,
        formatId,
        audioFormatId,
        resolution,
        categoryId,
        categoryName,
        remuxFormat,
        datePrefix,
        audioOnly,
        audioFormat,
        speedLimit,
        subtitles,
        scheduledAt,
        userId
      });

      res.status(201).json(record);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.get('/api/download/status/:id', (req, res) => {
    try {
      const status = downloader.getDownloadForSession(req.params.id, req.session);
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
    res.json(downloader.getQueueStatusForSession(req.session));
  });

  // --- Retry failed download (P1) ---
  app.post('/api/downloads/:id/retry', (req, res) => {
    try {
      if (!downloader.getDownloadForSession(req.params.id, req.session)) {
        return res.status(404).json({ error: 'Download not found' });
      }
      const newRecord = downloader.retryDownload(req.params.id);
      res.status(201).json({ success: true, newId: newRecord.id, record: newRecord });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.get('/api/downloads', (req, res) => {
    try {
      const { status, q, from, to, category, audioOnly } = req.query;
      const hasAdvancedFilters = q || from || to || category || audioOnly;
      if (hasAdvancedFilters) {
        res.json(downloader.listDownloadsForSession(req.session, { status, q, from, to, category, audioOnly }));
        return;
      }
      res.json(downloader.listDownloadsForSession(req.session, status || undefined));
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  // --- SSE Download Stream (P2) ---
  app.get('/api/downloads/stream', (req, res) => {
    if (ctx.state.sseClients.size >= ctx.state.maxSseClients) {
      return res.status(503).json({ error: 'Too many SSE connections' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    const clientId = Date.now() + Math.random();
    ctx.state.sseClients.set(clientId, { res, session: req.session });

    // Send current state immediately
    const downloads = downloader.listDownloadsForSession(req.session);
    res.write(`data: ${JSON.stringify(downloads)}\n\n`);

    // Keepalive every 30s
    const keepalive = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch (_) {
        // ignore
      }
    }, 30000);

    req.on('close', () => {
      ctx.state.sseClients.delete(clientId);
      clearInterval(keepalive);
    });
  });

  // --- Download History Export (P3) ---
  app.get('/api/downloads/export', (req, res) => {
    try {
      const { status, q, from, to, category, audioOnly } = req.query;
      const hasFilters = status || q || from || to || category || audioOnly;
      const downloads = hasFilters
        ? downloader.listDownloadsForSession(req.session, { status, q, from, to, category, audioOnly })
        : downloader.listDownloadsForSession(req.session);

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
      res.send('\uFEFF' + csv);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  // --- Cancel scheduled download (P3) ---
  app.post('/api/downloads/:id/cancel-schedule', (req, res) => {
    try {
      if (!downloader.getDownloadForSession(req.params.id, req.session)) {
        return res.status(404).json({ error: 'Download not found' });
      }
      downloader.cancelSchedule(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.delete('/api/downloads/:id', (req, res) => {
    try {
      if (!downloader.getDownloadForSession(req.params.id, req.session)) {
        return res.status(404).json({ error: 'Download not found' });
      }
      const removed = downloader.deleteDownload(req.params.id);
      res.json(removed);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });
}

module.exports = { register };
