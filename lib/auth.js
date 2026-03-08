const crypto = require('crypto');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Auth config from environment variables
let AUTH_USER = process.env.YT_AUTH_USER || 'admin';
let AUTH_PASS = process.env.YT_AUTH_PASS; // MUST be set
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours
const CODE_TTL = 10 * 60 * 1000; // 10 minutes
const ENV_PATH = path.join(__dirname, '..', '.env');

// Verification code store: { email: { code, createdAt, attempts } }
const verificationCodes = new Map();

// In-memory session store
const sessions = new Map();

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function cleanExpired() {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL) {
      sessions.delete(token);
    }
  }
}

// Run cleanup every 10 minutes
setInterval(cleanExpired, 10 * 60 * 1000);

function login(username, password) {
  if (!AUTH_PASS) {
    throw Object.assign(new Error('Server auth not configured — set YT_AUTH_PASS env var'), { status: 500 });
  }
  if (!username || !password) {
    throw Object.assign(new Error('Missing username or password'), { status: 400 });
  }
  // Constant-time comparison (hash to equalize lengths)
  const hashA = (s) => crypto.createHash('sha256').update(s).digest();
  const userOk = crypto.timingSafeEqual(
    hashA(username.toLowerCase()),
    hashA(AUTH_USER.toLowerCase())
  );
  const passOk = crypto.timingSafeEqual(
    hashA(password),
    hashA(AUTH_PASS)
  );
  if (!userOk || !passOk) {
    throw Object.assign(new Error('用戶名或密碼錯誤'), { status: 401 });
  }

  const token = generateToken();
  sessions.set(token, { username, createdAt: Date.now() });
  return token;
}

function validate(token) {
  if (!token) return false;
  const session = sessions.get(token);
  if (!session) return false;
  if (Date.now() - session.createdAt > SESSION_TTL) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function logout(token) {
  sessions.delete(token);
}

// Express middleware — protect all routes except login page & auth API
function authMiddleware(req, res, next) {
  // Skip auth for login page and auth endpoints
  if (req.path === '/login.html' || req.path === '/login' || req.path.startsWith('/api/auth/')) {
    return next();
  }

  // Allow static assets needed by login page (fonts, etc.)
  if (req.path.match(/\.(woff2?|ttf|eot)$/)) {
    return next();
  }

  const token = req.cookies && req.cookies.yt_session;
  if (validate(token)) {
    return next();
  }

  // API calls → 401 JSON
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Page requests → redirect to login
  return res.redirect('/login.html');
}

// --- Update credentials ---
function updateCredentials(currentPassword, newUsername, newPassword) {
  if (!AUTH_PASS) {
    throw Object.assign(new Error('Server auth not configured'), { status: 500 });
  }
  // Verify current password
  const hashA = (s) => crypto.createHash('sha256').update(s).digest();
  const passOk = crypto.timingSafeEqual(hashA(currentPassword), hashA(AUTH_PASS));
  if (!passOk) {
    throw Object.assign(new Error('當前密碼錯誤'), { status: 401 });
  }

  // Update in memory
  if (newUsername) AUTH_USER = newUsername;
  if (newPassword) AUTH_PASS = newPassword;

  // Persist to .env
  _writeEnv();

  // Invalidate all sessions
  sessions.clear();

  return { ok: true };
}

function _writeEnv() {
  const lines = [
    '# YouTube Downloader Auth',
    'YT_AUTH_USER=' + AUTH_USER,
    'YT_AUTH_PASS=' + AUTH_PASS,
    ''
  ];
  fs.writeFileSync(ENV_PATH, lines.join('\n'), 'utf8');
}

function getUsername() {
  return AUTH_USER;
}

// --- Forgot password: send verification code via email ---
function sendVerificationCode(email) {
  if (!email) {
    throw Object.assign(new Error('請輸入 Email'), { status: 400 });
  }
  // Check if email matches the registered username
  const hashA = (s) => crypto.createHash('sha256').update(s).digest();
  const emailOk = crypto.timingSafeEqual(
    hashA(email.toLowerCase()),
    hashA(AUTH_USER.toLowerCase())
  );
  if (!emailOk) {
    // Don't reveal whether email exists — just say "sent"
    // But actually don't send anything
    return { ok: true };
  }

  // Generate 6-digit code
  const code = String(crypto.randomInt(100000, 999999));
  verificationCodes.set(email.toLowerCase(), {
    code,
    createdAt: Date.now(),
    attempts: 0
  });

  // Send email via gog CLI
  try {
    const subject = 'YT Downloader - Verification Code';
    const body = [
      'Your verification code is: ' + code,
      '',
      'This code expires in 10 minutes.',
      '',
      'If you did not request this, please ignore this email.',
      '',
      '— YT Downloader System'
    ].join('\n');

    execSync(
      `gog gmail send --to "${email}" --subject "${subject}" --body "${body.replace(/"/g, '\\"')}"`,
      { timeout: 30000, stdio: 'pipe' }
    );
  } catch (err) {
    console.error('Failed to send verification email:', err.message);
    throw Object.assign(new Error('發送郵件失敗，請稍後重試'), { status: 500 });
  }

  return { ok: true };
}

// --- Verify code and return password ---
function verifyCode(email, code) {
  if (!email || !code) {
    throw Object.assign(new Error('請輸入驗證碼'), { status: 400 });
  }

  const entry = verificationCodes.get(email.toLowerCase());
  if (!entry) {
    throw Object.assign(new Error('驗證碼無效或已過期'), { status: 400 });
  }

  // Check expiry
  if (Date.now() - entry.createdAt > CODE_TTL) {
    verificationCodes.delete(email.toLowerCase());
    throw Object.assign(new Error('驗證碼已過期，請重新發送'), { status: 400 });
  }

  // Check attempts (max 5)
  entry.attempts++;
  if (entry.attempts > 5) {
    verificationCodes.delete(email.toLowerCase());
    throw Object.assign(new Error('嘗試次數過多，請重新發送驗證碼'), { status: 429 });
  }

  // Verify code
  if (entry.code !== code.trim()) {
    throw Object.assign(new Error('驗證碼錯誤（剩餘 ' + (5 - entry.attempts) + ' 次機會）'), { status: 400 });
  }

  // Success — clean up and return password
  verificationCodes.delete(email.toLowerCase());

  // Only return password if email matches username
  const hashA = (s) => crypto.createHash('sha256').update(s).digest();
  const emailOk = crypto.timingSafeEqual(
    hashA(email.toLowerCase()),
    hashA(AUTH_USER.toLowerCase())
  );
  if (!emailOk) {
    throw Object.assign(new Error('帳號不匹配'), { status: 400 });
  }

  return { password: AUTH_PASS };
}

module.exports = { login, validate, logout, authMiddleware, updateCredentials, getUsername, sendVerificationCode, verifyCode };
