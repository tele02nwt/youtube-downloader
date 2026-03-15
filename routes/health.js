function register(app) {
  const ctx = app.locals.routeContext;

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, uptime: process.uptime() });
  });

  app.get('/api/health/diagnostics', (req, res) => {
    try {
      res.json(ctx.helpers.getDiagnostics());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

module.exports = { register };
