window.toast = function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
};

window.showModal = function showModal(msg, onConfirm) {
  document.getElementById('delete-modal-msg').textContent = msg;
  document.getElementById('delete-modal').classList.add('active');
  window.state.deleteCallback = onConfirm;
};

window.hideModal = function hideModal() {
  document.getElementById('delete-modal').classList.remove('active');
  window.state.deleteCallback = null;
};

window.updateThemeToggle = function updateThemeToggle(theme) {
  var toggle = document.getElementById('theme-toggle');
  if (!toggle) return;
  var nextTheme = theme === 'light' ? 'dark' : 'light';
  toggle.setAttribute('aria-label', 'Switch to ' + nextTheme + ' theme');
  toggle.setAttribute('title', theme === 'light' ? 'Light theme active' : 'Dark theme active');
};

window.setTheme = function setTheme(theme) {
  var normalized = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', normalized);
  document.documentElement.style.colorScheme = normalized;
  try {
    localStorage.setItem('yt-theme', normalized);
  } catch (_) {}
  window.updateThemeToggle(normalized);
};

window.toggleTheme = function toggleTheme() {
  var currentTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  window.setTheme(currentTheme === 'light' ? 'dark' : 'light');
};
