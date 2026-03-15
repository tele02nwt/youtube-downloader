/**
 * users.js — Multi-user management (P4)
 * Store in data/users.json
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { readJSON, writeJSON } = require('./storage');

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

/**
 * Hash password with salt using SHA256 (consistent with existing auth.js approach)
 */
function hashPassword(password, salt) {
  if (!salt) salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(salt + password).digest('hex');
  return { hash, salt };
}

function createUser(username, password, role) {
  if (!username || !password) {
    throw Object.assign(new Error('用戶名和密碼為必填'), { status: 400 });
  }
  const users = getUsers();
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    throw Object.assign(new Error('用戶名已存在'), { status: 409 });
  }

  const { hash, salt } = hashPassword(password);
  const user = {
    id: crypto.randomBytes(8).toString('hex'),
    username,
    passwordHash: hash,
    passwordSalt: salt,
    role: role || 'user',
    createdAt: new Date().toISOString(),
    lastLoginAt: null
  };

  users.push(user);
  saveUsers(users);
  return _sanitize(user);
}

function updateUser(id, updates) {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) throw Object.assign(new Error('用戶不存在'), { status: 404 });

  if (updates.username) {
    const dup = users.find(u => u.id !== id && u.username.toLowerCase() === updates.username.toLowerCase());
    if (dup) throw Object.assign(new Error('用戶名已存在'), { status: 409 });
    users[idx].username = updates.username;
  }
  if (updates.password) {
    const { hash, salt } = hashPassword(updates.password);
    users[idx].passwordHash = hash;
    users[idx].passwordSalt = salt;
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
function verifyPassword(username, password) {
  const user = getUserByUsername(username);
  if (!user) return null;

  const { hash } = hashPassword(password, user.passwordSalt);
  // Constant-time comparison
  const hashA = crypto.createHash('sha256').update(hash).digest();
  const hashB = crypto.createHash('sha256').update(user.passwordHash).digest();
  const match = crypto.timingSafeEqual(hashA, hashB);

  if (!match) return null;
  return _sanitize(user);
}

/**
 * Migrate existing .env credentials to users.json on first run
 * Called once at startup if users.json doesn't exist or is empty
 */
function migrateFromEnv() {
  const users = getUsers();
  if (users.length > 0) return false; // already has users

  const envUser = process.env.YT_AUTH_USER || 'admin';
  const envPass = process.env.YT_AUTH_PASS;
  if (!envPass) return false; // no password to migrate

  const { hash, salt } = hashPassword(envPass);
  const admin = {
    id: crypto.randomBytes(8).toString('hex'),
    username: envUser,
    passwordHash: hash,
    passwordSalt: salt,
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
  const { passwordHash, passwordSalt, ...safe } = user;
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
  hashPassword
};
