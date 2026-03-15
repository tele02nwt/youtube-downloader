const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJSON(filename, defaultValue) {
  ensureDataDir();
  const filepath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filepath)) return defaultValue !== undefined ? defaultValue : null;
  const raw = fs.readFileSync(filepath, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[WARN] Failed to parse ${filename}: ${err.message}`);
    return defaultValue !== undefined ? defaultValue : null;
  }
}

function writeJSON(filename, data) {
  ensureDataDir();
  const filepath = path.join(DATA_DIR, filename);
  const tmp = filepath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, filepath);
}

module.exports = { readJSON, writeJSON, DATA_DIR };
