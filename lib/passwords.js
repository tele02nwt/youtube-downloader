const crypto = require('crypto');

let argon2 = null;
try {
  argon2 = require('argon2');
} catch (_) {
  argon2 = null;
}

function sha256Buffer(input) {
  return crypto.createHash('sha256').update(input).digest();
}

function hashLegacyPassword(password, salt) {
  const nextSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(nextSalt + password).digest('hex');
  return {
    passwordHash: hash,
    passwordSalt: nextSalt,
    passwordAlgorithm: 'sha256'
  };
}

async function hashPassword(password) {
  if (argon2) {
    return {
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      passwordSalt: null,
      passwordAlgorithm: 'argon2id'
    };
  }
  return hashLegacyPassword(password);
}

async function verifyPassword(password, storedHash, storedSalt, storedAlgorithm) {
  if (!storedHash) return false;

  if (storedAlgorithm === 'argon2id' || storedHash.startsWith('$argon2')) {
    if (!argon2) return false;
    try {
      return await argon2.verify(storedHash, password);
    } catch (_) {
      return false;
    }
  }

  if (!storedSalt) return false;
  const legacy = hashLegacyPassword(password, storedSalt);
  return crypto.timingSafeEqual(
    sha256Buffer(legacy.passwordHash),
    sha256Buffer(storedHash)
  );
}

function needsRehash(record) {
  if (!record) return false;
  return !!argon2 && record.passwordAlgorithm !== 'argon2id' && !String(record.passwordHash || '').startsWith('$argon2');
}

module.exports = {
  argon2Available: !!argon2,
  hashLegacyPassword,
  hashPassword,
  verifyPassword,
  needsRehash
};
