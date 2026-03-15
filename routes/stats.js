function register(app) {
  const ctx = app.locals.routeContext;
  const { stats, downloader, categories, logger, tenantAccess } = ctx;

  app.get('/api/stats', (req, res) => {
    try {
      const scopedUserId = tenantAccess.getScopedUserId(req.session) || undefined;
      const logs = scopedUserId
        ? logger.getLogs().filter(log => log.userId === scopedUserId)
        : logger.getLogs();

      res.json(stats.buildStats({
        downloads: downloader.listDownloadsForSession(req.session),
        categories: categories.list(req.session),
        logs
      }));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

module.exports = { register };
