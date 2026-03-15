const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON } = require('./storage');
const tenantAccess = require('./tenant-access');

const FILENAME = 'categories.json';

function getAll() {
  return readJSON(FILENAME) || [];
}

function save(categories) {
  writeJSON(FILENAME, categories);
}

function list(session) {
  return tenantAccess.filterRecordsForSession(getAll(), session, {
    includeShared: true,
    sharedPredicate: category => category?.id === 'default'
  });
}

function add(name, userId) {
  if (!name || !name.trim()) {
    throw Object.assign(new Error('Category name cannot be empty'), { status: 400 });
  }
  const categories = getAll();
  const trimmed = name.trim();
  if (categories.some(c => c.name === trimmed && (c.userId || null) === (userId || null))) {
    throw Object.assign(new Error('Category name already exists'), { status: 409 });
  }
  const cat = { id: uuidv4(), name: trimmed, createdAt: new Date().toISOString(), userId: userId || null };
  categories.push(cat);
  save(categories);
  return cat;
}

function update(id, name, session) {
  if (!name || !name.trim()) {
    throw Object.assign(new Error('Category name cannot be empty'), { status: 400 });
  }
  const categories = getAll();
  const idx = categories.findIndex(c => c.id === id);
  if (idx === -1) {
    throw Object.assign(new Error('Category not found'), { status: 404 });
  }
  if (categories[idx].id === 'default') {
    throw Object.assign(new Error('Cannot modify default category'), { status: 403 });
  }
  if (!tenantAccess.canAccessRecord(categories[idx], session)) {
    throw Object.assign(new Error('Category not found'), { status: 404 });
  }
  const trimmed = name.trim();
  if (categories.some(c => c.name === trimmed && c.id !== id && (c.userId || null) === (categories[idx].userId || null))) {
    throw Object.assign(new Error('Category name already exists'), { status: 409 });
  }
  categories[idx].name = trimmed;
  save(categories);
  return categories[idx];
}

function remove(id, session) {
  const categories = getAll();
  const idx = categories.findIndex(c => c.id === id);
  if (idx === -1) {
    throw Object.assign(new Error('Category not found'), { status: 404 });
  }
  if (categories[idx].id === 'default') {
    throw Object.assign(new Error('Cannot delete default category'), { status: 403 });
  }
  if (!tenantAccess.canAccessRecord(categories[idx], session)) {
    throw Object.assign(new Error('Category not found'), { status: 404 });
  }
  const removed = categories.splice(idx, 1)[0];
  save(categories);
  return removed;
}

function reorder(ids, session) {
  if (!Array.isArray(ids)) {
    throw Object.assign(new Error('ids must be an array'), { status: 400 });
  }
  const categories = getAll();
  const visible = list(session);
  const visibleIdSet = new Set(visible.map(c => c.id));
  for (const id of ids) {
    if (!visibleIdSet.has(id)) {
      throw Object.assign(new Error('Unknown category id: ' + id), { status: 400 });
    }
  }

  const lookup = {};
  categories.forEach(c => { lookup[c.id] = c; });

  const requestedVisibleIds = ids.slice();
  visible.forEach(category => {
    if (!requestedVisibleIds.includes(category.id)) {
      requestedVisibleIds.push(category.id);
    }
  });

  const reorderedVisible = requestedVisibleIds.map(id => lookup[id]).filter(Boolean);
  let visibleIndex = 0;
  const reordered = categories.map(category => {
    if (!visibleIdSet.has(category.id)) {
      return category;
    }
    const nextCategory = reorderedVisible[visibleIndex];
    visibleIndex += 1;
    return nextCategory;
  });

  save(reordered);
  return list(session);
}

module.exports = { list, add, update, remove, reorder };
