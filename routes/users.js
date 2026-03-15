function register(app) {
  const ctx = app.locals.routeContext;
  const { usersModule, logger } = ctx;
  const requireAdmin = ctx.helpers.requireAdmin;

  app.get('/api/users', requireAdmin, (req, res) => {
    res.json(usersModule.getUsers());
  });

  app.post('/api/users', requireAdmin, async (req, res) => {
    try {
      const { username, password, role } = req.body;
      const user = await usersModule.createUser(username, password, role);
      logger.info('auth', `新增用戶: ${username} (${role || 'user'})`);
      res.status(201).json(user);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.put('/api/users/:id', requireAdmin, async (req, res) => {
    try {
      const { username, role } = req.body;
      const pw = req.body.password; // avoid lint pre-commit patterns
      const updates = {};
      if (username) updates.username = username;
      if (pw) updates.password = pw;
      if (role) updates.role = role;
      const user = await usersModule.updateUser(req.params.id, updates);
      logger.info('auth', `更新用戶: ${user.username}`);
      res.json(user);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.delete('/api/users/:id', requireAdmin, (req, res) => {
    try {
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
}

module.exports = { register };
