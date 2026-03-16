function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 5 } = {}) {
  const hits = new Map();

  return function rateLimit(req, res, next) {
    const now = Date.now();
    const key = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const entry = hits.get(key);

    if (!entry || now > entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ error: `Too many attempts. Try again in ${retryAfter}s.` });
    }

    return next();
  };
}

function register(app) {
  const ctx = app.locals.routeContext;
  const { auth, logger } = ctx;

  const authLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });

  // --- Auth API ---

  app.post('/api/auth/login', authLimiter, async (req, res) => {
    try {
      const { username, password } = req.body;
      const token = await auth.login(username, password);
      logger.info('auth', `用戶登入: ${username}`, { userId: auth.getSession(token)?.userId || null });

      res.cookie('yt_session', token, {
        httpOnly: true,
        secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
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

  app.post('/api/auth/update-credentials', authLimiter, async (req, res) => {
    try {
      const { currentPassword, newUsername, newPassword } = req.body;
      const result = await auth.updateCredentials(currentPassword, newUsername, newPassword);
      res.clearCookie('yt_session');
      res.json(result);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.post('/api/auth/forgot-password', authLimiter, (req, res) => {
    try {
      const { email } = req.body;
      const result = auth.sendVerificationCode(email);
      res.json(result);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.post('/api/auth/verify-code', authLimiter, (req, res) => {
    try {
      const { email, code } = req.body;
      const result = auth.verifyCode(email, code);
      res.json(result);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });
}

module.exports = { register };
