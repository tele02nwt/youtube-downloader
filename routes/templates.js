function register(app) {
  const ctx = app.locals.routeContext;
  const { templates, logger } = ctx;

  app.get('/api/templates', (req, res) => {
    try {
      res.json(templates.list(req.session));
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.post('/api/templates', (req, res) => {
    try {
      const template = templates.create(req.body, req.session);
      logger.info('template', `新增模板: ${template.name}`, { userId: req.session?.userId || null, templateId: template.id });
      res.status(201).json(template);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.put('/api/templates/:id', (req, res) => {
    try {
      const template = templates.update(req.params.id, req.body, req.session);
      res.json(template);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.delete('/api/templates/:id', (req, res) => {
    try {
      const template = templates.remove(req.params.id, req.session);
      logger.info('template', `刪除模板: ${template.name}`, { userId: req.session?.userId || null, templateId: template.id });
      res.json(template);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });
}

module.exports = { register };
