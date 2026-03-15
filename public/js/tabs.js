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
