function register(app) {
  const ctx = app.locals.routeContext;
  const { categories, logger } = ctx;

  app.get('/api/categories', (req, res) => {
    try {
      res.json(categories.list(req.session));
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.post('/api/categories', (req, res) => {
    try {
      const cat = categories.add(req.body.name, req.session?.userId || null);
      logger.info('category', `新增分類: ${req.body.name}`, { userId: req.session?.userId || null, categoryId: cat.id });
      res.status(201).json(cat);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.put('/api/categories/reorder', (req, res) => {
    try {
      const result = categories.reorder(req.body.ids, req.session);
      res.json(result);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.put('/api/categories/:id', (req, res) => {
    try {
      const cat = categories.update(req.params.id, req.body.name, req.session);
      res.json(cat);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.delete('/api/categories/:id', (req, res) => {
    try {
      const cat = categories.remove(req.params.id, req.session);
      logger.info('category', `刪除分類: ${cat.name || req.params.id}`, { userId: req.session?.userId || null, categoryId: cat.id });
      res.json(cat);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });
}

module.exports = { register };
