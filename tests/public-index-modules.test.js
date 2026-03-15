const assert = require('assert');
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const indexPath = path.join(projectRoot, 'public', 'index.html');
const jsDir = path.join(projectRoot, 'public', 'js');

const html = fs.readFileSync(indexPath, 'utf8');

[
  'i18n.js',
  'state.js',
  'api.js',
  'ui.js',
  'tabs.js'
].forEach((file) => {
  assert.ok(
    fs.existsSync(path.join(jsDir, file)),
    `expected public/js/${file} to exist`
  );
  assert.ok(
    html.includes(`<script src="/js/${file}"></script>`),
    `expected public/index.html to load /js/${file}`
  );
});

[
  'zh-TW.json',
  'en.json'
].forEach((file) => {
  assert.ok(
    fs.existsSync(path.join(projectRoot, 'public', 'i18n', file)),
    `expected public/i18n/${file} to exist`
  );
});

// Check i18n integration: language toggle in HTML, setLanguage in i18n.js, i18n() calls in HTML
assert.ok(html.includes('id="language-toggle"'), 'expected index.html to include language-toggle element');
assert.ok(html.includes('i18n('), 'expected index.html to include i18n() calls');
var i18nJs = fs.readFileSync(path.join(jsDir, 'i18n.js'), 'utf8');
assert.ok(i18nJs.includes('setLanguage'), 'expected i18n.js to define setLanguage');

[
  'const state = {',
  'async function api(method, path, body) {',
  "function toast(msg, type = 'success') {",
  'function showModal(msg, onConfirm) {',
  'function hideModal() {',
  'function updateThemeToggle(theme) {',
  'function setTheme(theme) {',
  'function toggleTheme() {',
  'function goToTab(name) {',
  'function switchInstallTab(platform) {'
].forEach((snippet) => {
  assert.ok(
    !html.includes(snippet),
    `expected inline script to stop defining: ${snippet}`
  );
});

console.log('public index module split tests passed');
