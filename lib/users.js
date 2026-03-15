/**
 * users.js — Multi-user management (P4)
 * Store in data/users.json
 */

const crypto = require('crypto');
const { readJSON, writeJSON } = require('./storage');
const passwords = require('./passwords');

const USERS_FILE = 'users.json';

function getUsers() {
  return readJSON(USERS_FILE) || [];
}

function saveUsers(users) {
  writeJSON(USERS_FILE, users);
}

function getUserById(id) {
  return getUsers().find(u => u.id === id) || null;
}

function getUserByUsername(username) {
  if (!username) return null;
  const lower = username.toLowerCase();
  return getUsers().find(u => u.username.toLowerCase() === lower) || null;
}

async function createUser(username, password, role) {
  if (!username || !password) {
    throw Object.assign(new Error('用戶名和密碼為必填'), { status: 400 });
  }
  const users = getUsers();
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    throw Object.assign(new Error('用戶名已存在'), { status: 409 });
  }

  const hashed = await passwords.hashPassword(password);
  const user = {
    id: crypto.randomBytes(8).toString('hex'),
    username,
    passwordHash: hashed.passwordHash,
    passwordSalt: hashed.passwordSalt,
    passwordAlgorithm: hashed.passwordAlgorithm,
    role: role || 'user',
    createdAt: new Date().toISOString(),
    lastLoginAt: null
  };

  users.push(user);
  saveUsers(users);
  return _sanitize(user);
}

async function updateUser(id, updates) {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) throw Object.assign(new Error('用戶不存在'), { status: 404 });

  if (updates.username) {
    const dup = users.find(u => u.id !== id && u.username.toLowerCase() === updates.username.toLowerCase());
    if (dup) throw Object.assign(new Error('用戶名已存在'), { status: 409 });
    users[idx].username = updates.username;
  }
  if (updates.password) {
    const hashed = await passwords.hashPassword(updates.password);
    users[idx].passwordHash = hashed.passwordHash;
    users[idx].passwordSalt = hashed.passwordSalt;
    users[idx].passwordAlgorithm = hashed.passwordAlgorithm;
  }
  if (updates.role && (updates.role === 'admin' || updates.role === 'user')) {
    users[idx].role = updates.role;
  }
  if (updates.lastLoginAt) {
    users[idx].lastLoginAt = updates.lastLoginAt;
  }

  saveUsers(users);
  return _sanitize(users[idx]);
}

function deleteUser(id) {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) throw Object.assign(new Error('用戶不存在'), { status: 404 });
  const removed = users.splice(idx, 1)[0];
  saveUsers(users);
  return _sanitize(removed);
}

/**
 * Verify password, returns user object (sanitized) or null
 */
async function verifyPassword(username, password) {
  const allUsers = getUsers();
  const user = allUsers.find(entry => entry.username.toLowerCase() === String(username || '').toLowerCase());
  if (!user) return null;

  const match = await passwords.verifyPassword(
    password,
    user.passwordHash,
    user.passwordSalt,
    user.passwordAlgorithm
  );
  if (!match) return null;

  if (passwords.needsRehash(user)) {
    const hashed = await passwords.hashPassword(password);
    user.passwordHash = hashed.passwordHash;
    user.passwordSalt = hashed.passwordSalt;
    user.passwordAlgorithm = hashed.passwordAlgorithm;
    saveUsers(allUsers);
  }

  return _sanitize(user);
}

/**
 * Migrate existing .env credentials to users.json on first run
 * Called once at startup if users.json doesn't exist or is empty
 */
async function migrateFromEnv() {
  const users = getUsers();
  if (users.length > 0) return false; // already has users

  const envUser = process.env.YT_AUTH_USER || 'admin';
  const envPass = process.env.YT_AUTH_PASS;
  if (!envPass) return false; // no password to migrate

  const hashed = await passwords.hashPassword(envPass);
  const admin = {
    id: crypto.randomBytes(8).toString('hex'),
    username: envUser,
    passwordHash: hashed.passwordHash,
    passwordSalt: hashed.passwordSalt,
    passwordAlgorithm: hashed.passwordAlgorithm,
    role: 'admin',
    createdAt: new Date().toISOString(),
    lastLoginAt: null
  };

  saveUsers([admin]);
  console.log(`[Users] Migrated env credentials for '${envUser}' as admin user`);
  return true;
}

/**
 * Check if multi-user mode is active (users.json exists and has entries)
 */
function isMultiUserMode() {
  const users = getUsers();
  return users.length > 0;
}

function _sanitize(user) {
  if (!user) return null;
  const { passwordHash, passwordSalt, passwordAlgorithm, ...safe } = user;
  return safe;
}

module.exports = {
  getUsers: () => getUsers().map(_sanitize),
  getUserById,
  getUserByUsername,
  createUser,
  updateUser,
  deleteUser,
  verifyPassword,
  migrateFromEnv,
  isMultiUserMode,
  hashPassword: passwords.hashPassword
};
