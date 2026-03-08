const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Find binary in common install locations
function findBinary(name) {
  const candidates = [
    `/home/linuxbrew/.linuxbrew/bin/${name}`,
    `/opt/homebrew/bin/${name}`,
    `/usr/local/bin/${name}`,
    `/usr/bin/${name}`,
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  try {
    const found = execFileSync('which', [name], { encoding: 'utf8' }).trim();
    if (found) return found;
  } catch (e) {}
  return null;
}

// ═══════════════════════════════════════
// CLOUDFLARE TUNNEL
// ═══════════════════════════════════════

function getCloudflaredStatus() {
  const bin = findBinary('cloudflared');
  const installed = !!bin;

  let running = false;
  let pid = null;
  const pidFile = path.join(__dirname, '..', 'data', 'tunnel.pid');
  if (fs.existsSync(pidFile)) {
    const pidStr = fs.readFileSync(pidFile, 'utf8').trim();
    pid = parseInt(pidStr);
    if (pid) {
      try { process.kill(pid, 0); running = true; } catch (e) { running = false; pid = null; }
    }
  }

  // Read tunnel log (last 8 lines)
  let recentLog = '';
  const logPath = path.join(__dirname, '..', 'data', 'tunnel.log');
  if (fs.existsSync(logPath)) {
    const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
    recentLog = lines.slice(-8).join('\n');
  }

  return { installed, running, pid, binPath: bin || null, recentLog };
}

function stopTunnel() {
  const pidFile = path.join(__dirname, '..', 'data', 'tunnel.pid');
  if (fs.existsSync(pidFile)) {
    const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim());
    if (pid) { try { process.kill(pid, 'SIGTERM'); } catch (e) {} }
    try { fs.unlinkSync(pidFile); } catch (e) {}
  }
  return { ok: true };
}

// mode: 'quick' | 'token'
// options: { port, token }
function startTunnel(mode, options = {}) {
  const bin = findBinary('cloudflared');
  if (!bin) throw new Error('cloudflared 未安裝，請先安裝後再試');

  stopTunnel();

  const logPath = path.join(__dirname, '..', 'data', 'tunnel.log');
  const pidFile = path.join(__dirname, '..', 'data', 'tunnel.pid');

  let args;
  if (mode === 'token') {
    if (!options.token || !options.token.trim()) throw new Error('需要提供 Tunnel Token');
    args = ['tunnel', '--no-autoupdate', 'run', '--token', options.token.trim()];
  } else {
    // quick tunnel (default)
    const port = options.port || 3847;
    args = ['tunnel', '--url', `http://localhost:${port}`];
  }

  // Append log header
  fs.appendFileSync(logPath, `\n[${new Date().toISOString()}] ─── Starting tunnel (mode: ${mode}) ───\n`);

  const logFd = fs.openSync(logPath, 'a');
  const child = spawn(bin, args, {
    detached: true,
    stdio: ['ignore', logFd, logFd]
  });
  child.unref();
  fs.writeFileSync(pidFile, String(child.pid));

  return { ok: true, pid: child.pid, mode };
}

// ═══════════════════════════════════════
// GOOGLE DRIVE (via gog CLI)
// ═══════════════════════════════════════

function getGdriveStatus() {
  const bin = findBinary('gog');
  const installed = !!bin;
  if (!installed) return { installed, authenticated: false, binPath: null };

  try {
    const result = execFileSync(bin, ['drive', 'ls', '--max', '1', '-j'], {
      timeout: 12000, encoding: 'utf8'
    });
    const parsed = JSON.parse(result);
    const authenticated = !!(parsed && (Array.isArray(parsed.files) || parsed.files !== undefined));
    return { installed, authenticated, binPath: bin };
  } catch (e) {
    const errMsg = (e.stderr || e.message || '').substring(0, 300);
    return { installed, authenticated: false, binPath: bin, error: errMsg };
  }
}

// Track running auth process
let _authProc = null;
let _authOutput = '';
let _authDone = false;
let _authSuccess = false;

function startGdriveAuth() {
  const bin = findBinary('gog');
  if (!bin) throw new Error('gog CLI 未安裝。請先執行：brew install steipete/tap/gogcli');

  // Kill any existing auth process
  if (_authProc) {
    try { _authProc.kill(); } catch (e) {}
    _authProc = null;
  }
  _authOutput = '';
  _authDone = false;
  _authSuccess = false;

  const child = spawn(bin, ['auth', 'login'], {
    stdio: ['ignore', 'pipe', 'pipe']
  });
  _authProc = child;

  child.stdout.on('data', d => { _authOutput += d.toString(); });
  child.stderr.on('data', d => { _authOutput += d.toString(); });
  child.on('close', code => {
    _authProc = null;
    _authDone = true;
    _authSuccess = (code === 0);
    _authOutput += `\n[授權程序已結束，退出碼 ${code}]`;
  });

  return { ok: true, pid: child.pid };
}

function getAuthPoll() {
  return {
    output: _authOutput,
    running: !!_authProc,
    done: _authDone,
    success: _authSuccess
  };
}

module.exports = {
  findBinary,
  getCloudflaredStatus,
  startTunnel,
  stopTunnel,
  getGdriveStatus,
  startGdriveAuth,
  getAuthPoll
};
