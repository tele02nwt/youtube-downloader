const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON } = require('./storage');
const tenantAccess = require('./tenant-access');

const FILENAME = 'templates.json';

function getAll() {
  return readJSON(FILENAME, []);
}

function save(templates) {
  writeJSON(FILENAME, templates);
}

function normalizePayload(payload, existingTemplate) {
  const name = (payload?.name || '').trim();
  const format = (payload?.format || '').trim();
  const categoryId = (payload?.categoryId || 'default').trim() || 'default';
  const categoryName = (payload?.categoryName || '未分類').trim() || '未分類';
  const audioOnly = !!payload?.audioOnly;
  const resolution = audioOnly ? null : ((payload?.resolution || '').trim() || null);
  const speedLimit = ((payload?.speedLimit || '').trim() || null);

  if (!name) {
    throw Object.assign(new Error('Template name cannot be empty'), { status: 400 });
  }
  if (!format) {
    throw Object.assign(new Error('Template format cannot be empty'), { status: 400 });
  }

  return {
    id: existingTemplate?.id || uuidv4(),
    name,
    format,
    resolution,
    audioOnly,
    categoryId,
    categoryName,
    datePrefix: !!payload?.datePrefix,
    speedLimit,
    createdAt: existingTemplate?.createdAt || new Date().toISOString(),
    userId: existingTemplate?.userId !== undefined ? existingTemplate.userId : (payload?.userId || null)
  };
}

function list(session) {
  return tenantAccess.filterRecordsForSession(getAll(), session);
}

function create(payload, session) {
  const templates = getAll();
  const userId = tenantAccess.getScopedUserId(session);
  const normalized = normalizePayload({ ...payload, userId });

  if (templates.some(template => template.name === normalized.name && (template.userId || null) === (normalized.userId || null))) {
    throw Object.assign(new Error('Template name already exists'), { status: 409 });
  }

  templates.push(normalized);
  save(templates);
  return normalized;
}

function update(id, payload, session) {
  const templates = getAll();
  const index = templates.findIndex(template => template.id === id);

  if (index === -1 || !tenantAccess.canAccessRecord(templates[index], session)) {
    throw Object.assign(new Error('Template not found'), { status: 404 });
  }

  const existing = templates[index];
  const normalized = normalizePayload(payload, existing);

  if (templates.some(template => template.id !== id && template.name === normalized.name && (template.userId || null) === (existing.userId || null))) {
    throw Object.assign(new Error('Template name already exists'), { status: 409 });
  }

  normalized.userId = existing.userId || null;
  templates[index] = normalized;
  save(templates);
  return normalized;
}

function remove(id, session) {
  const templates = getAll();
  const index = templates.findIndex(template => template.id === id);

  if (index === -1 || !tenantAccess.canAccessRecord(templates[index], session)) {
    throw Object.assign(new Error('Template not found'), { status: 404 });
  }

  const removed = templates.splice(index, 1)[0];
  save(templates);
  return removed;
}

module.exports = {
  list,
  create,
  update,
  remove
};
