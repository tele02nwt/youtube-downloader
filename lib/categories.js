const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON } = require('./storage');

const FILENAME = 'categories.json';

function getAll() {
  return readJSON(FILENAME) || [];
}

function save(categories) {
  writeJSON(FILENAME, categories);
}

function list() {
  return getAll();
}

function add(name) {
  if (!name || !name.trim()) {
    throw Object.assign(new Error('Category name cannot be empty'), { status: 400 });
  }
  const categories = getAll();
  const trimmed = name.trim();
  if (categories.some(c => c.name === trimmed)) {
    throw Object.assign(new Error('Category name already exists'), { status: 409 });
  }
  const cat = { id: uuidv4(), name: trimmed, createdAt: new Date().toISOString() };
  categories.push(cat);
  save(categories);
  return cat;
}

function update(id, name) {
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
  const trimmed = name.trim();
  if (categories.some(c => c.name === trimmed && c.id !== id)) {
    throw Object.assign(new Error('Category name already exists'), { status: 409 });
  }
  categories[idx].name = trimmed;
  save(categories);
  return categories[idx];
}

function remove(id) {
  const categories = getAll();
  const idx = categories.findIndex(c => c.id === id);
  if (idx === -1) {
    throw Object.assign(new Error('Category not found'), { status: 404 });
  }
  if (categories[idx].id === 'default') {
    throw Object.assign(new Error('Cannot delete default category'), { status: 403 });
  }
  const removed = categories.splice(idx, 1)[0];
  save(categories);
  return removed;
}

function reorder(ids) {
  if (!Array.isArray(ids)) {
    throw Object.assign(new Error('ids must be an array'), { status: 400 });
  }
  const categories = getAll();
  const idSet = new Set(categories.map(c => c.id));
  // Validate all ids exist
  for (const id of ids) {
    if (!idSet.has(id)) {
      throw Object.assign(new Error('Unknown category id: ' + id), { status: 400 });
    }
  }
  // Build lookup and reorder
  const lookup = {};
  categories.forEach(c => { lookup[c.id] = c; });
  const reordered = ids.map(id => lookup[id]);
  // Append any missing ones (safety)
  categories.forEach(c => {
    if (!ids.includes(c.id)) reordered.push(c);
  });
  save(reordered);
  return reordered;
}

module.exports = { list, add, update, remove, reorder };
