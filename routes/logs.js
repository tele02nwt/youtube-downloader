function register(app) {
  const ctx = app.locals.routeContext;
  const { logger, tenantAccess } = ctx;

  app.get('/api/logs', (req, res) => {
    try {
      const { category, level, limit, before } = req.query;
      const logs = logger.listLogs({
        category: category || undefined,
        level: level || undefined,
        limit: limit ? parseInt(limit) : 100,
        before: before || undefined,
        userId: tenantAccess.getScopedUserId(req.session) || undefined
      });
      res.json(logs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/logs/stats', (req, res) => {
    try {
      res.json(logger.getStats({ userId: tenantAccess.getScopedUserId(req.session) || undefined }));
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
}

module.exports = { register };
