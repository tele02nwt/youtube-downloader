const crypto = require('crypto');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const users = require('./users');
const passwords = require('./passwords');

let AUTH_USER = process.env.YT_AUTH_USER || 'admin';
let AUTH_PASS = process.env.YT_AUTH_PASS || null;
let AUTH_PASS_HASH = process.env.YT_AUTH_PASS_HASH || null;

const SESSION_TTL = 24 * 60 * 60 * 1000;
const CODE_TTL = 10 * 60 * 1000;
const ENV_PATH = path.join(__dirname, '..', '.env');

const verificationCodes = new Map();
const sessions = new Map();

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function digest(input) {
  return crypto.createHash('sha256').update(String(input || '')).digest();
}

async function initialize() {
  await users.migrateFromEnv();
}

function cleanExpired() {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL) {
      sessions.delete(token);
    }
  }
}

setInterval(cleanExpired, 10 * 60 * 1000);

function verifyEnvUsername(username) {
  return crypto.timingSafeEqual(
    digest(String(username || '').toLowerCase()),
    digest(String(AUTH_USER || '').toLowerCase())
  );
}

async function verifyEnvPassword(password) {
  if (AUTH_PASS_HASH) {
    return passwords.verifyPassword(password, AUTH_PASS_HASH, null, 'argon2id');
  }
  if (!AUTH_PASS) return false;
  return crypto.timingSafeEqual(digest(password), digest(AUTH_PASS));
}

async function login(username, password) {
  if (!username || !password) {
    throw Object.assign(new Error('Missing username or password'), { status: 400 });
  }

  if (users.isMultiUserMode()) {
    const user = await users.verifyPassword(username, password);
    if (!user) {
      throw Object.assign(new Error('用戶名或密碼錯誤'), { status: 401 });
    }
    await users.updateUser(user.id, { lastLoginAt: new Date().toISOString() });
    const token = generateToken();
    sessions.set(token, { username: user.username, userId: user.id, role: user.role, createdAt: Date.now() });
    return token;
  }

  if (!AUTH_PASS && !AUTH_PASS_HASH) {
    throw Object.assign(new Error('Server auth not configured — set YT_AUTH_PASS or YT_AUTH_PASS_HASH'), { status: 500 });
  }

  const userOk = verifyEnvUsername(username);
  const passOk = await verifyEnvPassword(password);
  if (!userOk || !passOk) {
    throw Object.assign(new Error('用戶名或密碼錯誤'), { status: 401 });
  }

  const token = generateToken();
  sessions.set(token, { username, userId: null, role: 'admin', createdAt: Date.now() });
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

function getSession(token) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() - session.createdAt > SESSION_TTL) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function logout(token) {
  sessions.delete(token);
}

function authMiddleware(req, res, next) {
  if (req.path === '/login.html' || req.path === '/login' || req.path.startsWith('/api/auth/') || req.path.startsWith('/api/health')) {
    return next();
  }

  if (req.path.match(/\.(woff2?|ttf|eot)$/)) {
    return next();
  }

  const token = req.cookies && req.cookies.yt_session;
  if (validate(token)) {
    const session = getSession(token);
    if (session) req.session = session;
    return next();
  }

  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return res.redirect('/login.html');
}

async function updateCredentials(currentPassword, newUsername, newPassword) {
  if (!AUTH_PASS && !AUTH_PASS_HASH) {
    throw Object.assign(new Error('Server auth not configured'), { status: 500 });
  }

  const passOk = await verifyEnvPassword(currentPassword);
  if (!passOk) {
    throw Object.assign(new Error('當前密碼錯誤'), { status: 401 });
  }

  if (newUsername) AUTH_USER = newUsername;
  if (newPassword) {
    const hashed = await passwords.hashPassword(newPassword);
    AUTH_PASS = null;
    AUTH_PASS_HASH = hashed.passwordHash;
  }

  writeEnv();
  sessions.clear();
  return { ok: true };
}

function writeEnv() {
  let lines = [];
  if (fs.existsSync(ENV_PATH)) {
    lines = fs.readFileSync(ENV_PATH, 'utf8').split('\n');
  }

  let foundUser = false;
  let foundPass = false;
  let foundPassHash = false;
  lines = lines.map((line) => {
    if (line.startsWith('YT_AUTH_USER=')) {
      foundUser = true;
      return 'YT_AUTH_USER=' + AUTH_USER;
    }
    if (line.startsWith('YT_AUTH_PASS=')) {
      foundPass = true;
      return AUTH_PASS ? 'YT_AUTH_PASS=' + AUTH_PASS : '';
    }
    if (line.startsWith('YT_AUTH_PASS_HASH=')) {
      foundPassHash = true;
      return AUTH_PASS_HASH ? 'YT_AUTH_PASS_HASH=' + AUTH_PASS_HASH : '';
    }
    return line;
  }).filter(Boolean);

  if (!foundUser) lines.push('YT_AUTH_USER=' + AUTH_USER);
  if (AUTH_PASS && !foundPass) lines.push('YT_AUTH_PASS=' + AUTH_PASS);
  if (AUTH_PASS_HASH && !foundPassHash) lines.push('YT_AUTH_PASS_HASH=' + AUTH_PASS_HASH);
  fs.writeFileSync(ENV_PATH, lines.join('\n'), 'utf8');
}

function getUsername() {
  return AUTH_USER;
}

function sendVerificationCode(email) {
  if (!email) {
    throw Object.assign(new Error('請輸入 Email'), { status: 400 });
  }

  const emailOk = crypto.timingSafeEqual(
    digest(email.toLowerCase()),
    digest(AUTH_USER.toLowerCase())
  );
  if (!emailOk) return { ok: true };

  const code = String(crypto.randomInt(100000, 999999));
  verificationCodes.set(email.toLowerCase(), {
    code,
    createdAt: Date.now(),
    attempts: 0
  });

  try {
    const subject = 'YT Downloader - Verification Code';
    const body = [
      'Your verification code is: ' + code,
      '',
      'This code expires in 10 minutes.',
      '',
      'If you did not request this, please ignore this email.',
      '',
      '- YT Downloader System'
    ].join('\n');

    execFileSync('gog', [
      'gmail', 'send',
      '--to', email,
      '--subject', subject,
      '--body', body
    ], { timeout: 30000, stdio: 'pipe' });
  } catch (err) {
    console.error('Failed to send verification email:', err.message);
    throw Object.assign(new Error('發送郵件失敗，請稍後重試'), { status: 500 });
  }

  return { ok: true };
}

function verifyCode(email, code) {
  if (!email || !code) {
    throw Object.assign(new Error('請輸入驗證碼'), { status: 400 });
  }

  const entry = verificationCodes.get(email.toLowerCase());
  if (!entry) {
    throw Object.assign(new Error('驗證碼無效或已過期'), { status: 400 });
  }

  if (Date.now() - entry.createdAt > CODE_TTL) {
    verificationCodes.delete(email.toLowerCase());
    throw Object.assign(new Error('驗證碼已過期，請重新發送'), { status: 400 });
  }

  entry.attempts++;
  if (entry.attempts > 5) {
    verificationCodes.delete(email.toLowerCase());
    throw Object.assign(new Error('嘗試次數過多，請重新發送驗證碼'), { status: 429 });
  }

  if (entry.code !== code.trim()) {
    throw Object.assign(new Error('驗證碼錯誤（剩餘 ' + (5 - entry.attempts) + ' 次機會）'), { status: 400 });
  }

  verificationCodes.delete(email.toLowerCase());

  const emailOk = crypto.timingSafeEqual(
    digest(email.toLowerCase()),
    digest(AUTH_USER.toLowerCase())
  );
  if (!emailOk) {
    throw Object.assign(new Error('帳號不匹配'), { status: 400 });
  }

  return { success: true };
}

module.exports = {
  initialize,
  login,
  validate,
  logout,
  authMiddleware,
  updateCredentials,
  getUsername,
  sendVerificationCode,
  verifyCode,
  getSession
};
