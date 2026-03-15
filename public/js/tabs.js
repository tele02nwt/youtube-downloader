window.goToTab = function goToTab(name) {
  const btn = document.querySelector('.tab-btn[data-tab="' + name + '"]');
  if (btn) btn.click();
};

window.switchInstallTab = function switchInstallTab(platform) {
  document.querySelectorAll('.install-tab-btn').forEach((button) => button.classList.remove('active'));
  document.querySelectorAll('.install-platform').forEach((panel) => panel.classList.remove('active'));
  const activeBtn = document.querySelector('.install-tab-btn[data-itab="' + platform + '"]');
  const activePanel = document.getElementById('install-' + platform);
  if (activeBtn) activeBtn.classList.add('active');
  if (activePanel) activePanel.classList.add('active');
};

// Re-render dynamic content when language changes
window.addEventListener('app:languagechange', function() {
  var activeBtn = document.querySelector('.tab-btn.active');
  if (!activeBtn) return;
  var tab = activeBtn.dataset.tab;
  if (tab === 'categories' && typeof loadCategories === 'function') loadCategories();
  if (tab === 'manager' && typeof loadDownloads === 'function') loadDownloads();
  if (tab === 'logs' && typeof loadLogs === 'function') loadLogs();
  if (tab === 'stats' && typeof loadStats === 'function') loadStats();
  if (tab === 'health' && typeof runHealthDiagnostics === 'function') runHealthDiagnostics();
  if (tab === 'files' && typeof loadFiles === 'function') { loadFilesCategoryFilter(); loadFiles(); }
  if (tab === 'settings') {
    if (typeof cfRefreshStatus === 'function') cfRefreshStatus();
    if (typeof gdRefreshStatus === 'function') gdRefreshStatus();
    if (typeof loadUsers === 'function') loadUsers();
    if (typeof checkCookieStatus === 'function') checkCookieStatus();
  }
});

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((button) => button.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((content) => content.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');

    if (btn.dataset.tab === 'categories') loadCategories();
    if (btn.dataset.tab === 'download') loadCategorySelect();
    if (btn.dataset.tab === 'manager') loadDownloads();
    if (btn.dataset.tab !== 'manager') disconnectSSE();
    if (btn.dataset.tab === 'logs') loadLogs();
    if (btn.dataset.tab === 'stats') loadStats();
    if (btn.dataset.tab === 'health') runHealthDiagnostics();
    if (btn.dataset.tab === 'files') { loadFilesCategoryFilter(); loadFiles(); }
    if (btn.dataset.tab === 'settings') { cfRefreshStatus(); gdRefreshStatus(); tgLoadSettings(); ytdlpLoadVersion(); loadSpeedLimit(); loadNotificationSettings(); loadUsers(); }
  });
});
