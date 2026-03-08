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

module.exports = { list, add, update, remove };
