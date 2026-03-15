const { spawn, execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');
const { readJSON, writeJSON } = require('./storage');
const logger = require('./logger');

// SSE event emitter — server.js listens for 'update' events
const downloadEvents = new EventEmitter();
downloadEvents.setMaxListeners(20);

// Google Drive config
const GOG_BIN = '/home/linuxbrew/.linuxbrew/bin/gog';
const GDRIVE_ROOT_FOLDER_NAME = 'Youtube Downloader';
// Cache folder IDs to avoid repeated lookups
let gdriveRootFolderId = null;
const gdriveCategoryFolderIds = {};

// --- P0: Upload queue (max 2 concurrent) ---
let _uploadConcurrent = 0;
const _uploadQueue = [];
const MAX_UPLOAD_CONCURRENT = 2;

async function queuedUpload(fn) {
  if (_uploadConcurrent >= MAX_UPLOAD_CONCURRENT) {
    await new Promise(resolve => _uploadQueue.push(resolve));
  }
  _uploadConcurrent++;
  try { return await fn(); }
  finally {
    _uploadConcurrent--;
    if (_uploadQueue.length > 0) _uploadQueue.shift()();
  }
}

// --- P0: In-memory download state with periodic flush ---
const _activeDownloads = new Map(); // id -> download object
let _flushTimer = null;
const FLUSH_INTERVAL_MS = 5000;

function _ensureFlushTimer() {
  if (_flushTimer) return;
  _flushTimer = setInterval(() => {
    _flushToDisk();
    if (_activeDownloads.size === 0) {
      clearInterval(_flushTimer);
      _flushTimer = null;
    }
  }, FLUSH_INTERVAL_MS);
  _flushTimer.unref(); // don't prevent process exit
}

function _flushToDisk() {
  if (_activeDownloads.size === 0) return;
  const all = readJSON('downloads.json') || [];
  for (const [id, data] of _activeDownloads) {
    const idx = all.findIndex(d => d.id === id);
    if (idx >= 0) all[idx] = data;
    else all.push(data);
  }
  writeJSON('downloads.json', all);
}

// Telegram notification via openclaw CLI
const appSettings = require('./settings');

function sendTelegramNotification(message) {
  try {
    const tg = appSettings.getTelegramSettings();
    if (!tg.enabled || !tg.groupId) return; // 未啟用或未設定就跳過
    const args = [
      'message', 'send',
      '--channel', 'telegram',
      '--target', tg.groupId,
      '--message', message
    ];
    if (tg.topicId) args.push('--thread-id', tg.topicId);
    execFile('openclaw', args, { timeout: 15000 }, (err) => {
      if (err) console.error('Telegram notification failed:', err.message);
    });
  } catch (e) {
    console.error('Telegram notification error:', e.message);
  }
}

// --- Google Drive helpers (async, P0) ---

function gogExecAsync(args, timeout = 30000) {
  return new Promise((resolve, reject) => {
    execFile(GOG_BIN, args, { timeout, encoding: 'utf8' }, (err, stdout) => {
      if (err) {
        console.error('gog command failed:', args.join(' '), err.message);
        return resolve(null);
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        console.error('gog JSON parse failed:', e.message);
        resolve(null);
      }
    });
  });
}

async function ensureGdriveRootFolder() {
  if (gdriveRootFolderId) return gdriveRootFolderId;

  // Search for existing folder
  const list = await gogExecAsync(['drive', 'ls', '--max', '100', '-j']);
  if (list && list.files) {
    const existing = list.files.find(f =>
      f.name === GDRIVE_ROOT_FOLDER_NAME &&
      f.mimeType === 'application/vnd.google-apps.folder'
    );
    if (existing) {
      gdriveRootFolderId = existing.id;
      return gdriveRootFolderId;
    }
  }

  // Create it — gog drive mkdir -j returns {folder: {...}}
  const createResult = await gogExecAsync(['drive', 'mkdir', GDRIVE_ROOT_FOLDER_NAME, '-j']);
  const created = createResult?.folder || createResult;
  if (created && created.id) {
    gdriveRootFolderId = created.id;
    return gdriveRootFolderId;
  }
  console.error('Failed to create Google Drive root folder');
  return null;
}

async function ensureGdriveCategoryFolder(categoryName) {
  if (!categoryName || categoryName === '未分類') return ensureGdriveRootFolder();
  if (gdriveCategoryFolderIds[categoryName]) return gdriveCategoryFolderIds[categoryName];

  const rootId = await ensureGdriveRootFolder();
  if (!rootId) return null;

  // Search in root folder
  const list = await gogExecAsync(['drive', 'ls', '--parent', rootId, '--max', '100', '-j']);
  if (list && list.files) {
    const existing = list.files.find(f =>
      f.name === categoryName &&
      f.mimeType === 'application/vnd.google-apps.folder'
    );
    if (existing) {
      gdriveCategoryFolderIds[categoryName] = existing.id;
      return existing.id;
    }
  }

  // Create subfolder — gog drive mkdir -j returns {folder: {...}}
  const subResult = await gogExecAsync(['drive', 'mkdir', categoryName, '--parent', rootId, '-j']);
  const subCreated = subResult?.folder || subResult;
  if (subCreated && subCreated.id) {
    gdriveCategoryFolderIds[categoryName] = subCreated.id;
    return subCreated.id;
  }
  console.error('Failed to create category folder:', categoryName);
  return null;
}

async function uploadToGdrive(localFilePath, categoryName) {
  return queuedUpload(async () => {
    const folderId = await ensureGdriveCategoryFolder(categoryName);
    if (!folderId) {
      console.error('No Google Drive folder ID, skipping upload');
      return null;
    }

    try {
      const parsed = await gogExecAsync(
        ['drive', 'upload', localFilePath, '--parent', folderId, '-j'],
        600000 // 10 min timeout for large files
      );
      if (!parsed) return null;
      // gog drive upload -j returns {file: {...}} wrapper
      const file = parsed.file || parsed;
      console.log('Uploaded to Google Drive:', file.name || file.id);
      return file;
    } catch (e) {
      console.error('Google Drive upload failed:', e.message);
      return null;
    }
  });
}

// --- yt-dlp config ---

const YT_DLP = '/home/linuxbrew/.linuxbrew/bin/yt-dlp';
const FFMPEG = '/home/linuxbrew/.linuxbrew/bin/ffmpeg';
const DOWNLOADS_FILE = 'downloads.json';
const DEFAULT_BASE_PATH = '/data/youtube-downloads';
const COOKIES_PATH = path.join(__dirname, '..', 'data', 'cookies.txt');

function getCookiesArgs() {
  if (fs.existsSync(COOKIES_PATH)) {
    return ['--cookies', COOKIES_PATH];
  }
  return [];
}

// Active download processes keyed by download id
const activeProcesses = {};

// --- P1: Concurrent download limiter ---
let _dlActiveCount = 0;
const _dlPendingQueue = []; // { resolve }
const MAX_CONCURRENT_DL = 3;

// --- P3: Download Scheduler ---
const _scheduledDownloads = new Map(); // id -> { params, scheduledAt }

// Scheduler tick: check every 30s for downloads that should start
const _schedulerTick = setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of _scheduledDownloads) {
    if (new Date(entry.scheduledAt).getTime() <= now) {
      _scheduledDownloads.delete(id);
      _launchScheduledDownload(id, entry);
    }
  }
}, 30000);
_schedulerTick.unref();

function getQueueStatus() {
  return { active: _dlActiveCount, queued: _dlPendingQueue.length, maxConcurrent: MAX_CONCURRENT_DL };
}

async function _acquireSlot() {
  if (_dlActiveCount < MAX_CONCURRENT_DL) {
    _dlActiveCount++;
    return;
  }
  await new Promise(resolve => _dlPendingQueue.push(resolve));
  _dlActiveCount++;
}

function _releaseSlot() {
  _dlActiveCount--;
  if (_dlPendingQueue.length > 0) {
    _dlPendingQueue.shift()();
  }
}

// Standard resolution labels
const STANDARD_RESOLUTIONS = [2160, 1440, 1080, 720, 480, 360, 240, 144];

function getDownloads() {
  const disk = readJSON(DOWNLOADS_FILE) || [];
  // Merge in-memory state over disk state
  return disk.map(d => _activeDownloads.has(d.id) ? { ...d, ..._activeDownloads.get(d.id) } : d);
}

function saveDownloads(downloads) {
  writeJSON(DOWNLOADS_FILE, downloads);
}

const TERMINAL_STATUSES = new Set(['completed', 'error', 'cancelled', 'deleted']);

function updateDownload(id, updates) {
  // Try in-memory first, fall back to disk
  let record = _activeDownloads.get(id);
  if (!record) {
    const disk = readJSON(DOWNLOADS_FILE) || [];
    record = disk.find(d => d.id === id);
    if (!record) return null;
  }
  Object.assign(record, updates);
  _activeDownloads.set(id, record);

  if (TERMINAL_STATUSES.has(record.status)) {
    // Terminal state: flush immediately and remove from active
    _flushToDisk();
    _activeDownloads.delete(id);
  } else {
    // Non-terminal: ensure periodic flush is running
    _ensureFlushTimer();
  }
  // Emit SSE update event
  downloadEvents.emit('update');
  return record;
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return 'unknown';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
  return `${val.toFixed(1)} ${units[i]}`;
}

// Probe a URL for video info
async function probe(url) {
  return new Promise((resolve, reject) => {
    const child = spawn(YT_DLP, [...getCookiesArgs(), '-j', '--no-warnings', url], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PATH: path.dirname(FFMPEG) + ':' + process.env.PATH }
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => stdout += d.toString());
    child.stderr.on('data', d => stderr += d.toString());
    child.on('error', err => {
      logger.error('probe', `yt-dlp 啟動失敗: ${err.message}`, { url });
      reject(new Error('Failed to start yt-dlp: ' + err.message));
    });
    child.on('close', code => {
      if (code !== 0) {
        const errMsg = stderr.trim() || `yt-dlp exited with code ${code}`;
        logger.error('probe', `影片分析失敗: ${errMsg.substring(0, 200)}`, { url, code });
        return reject(new Error(errMsg));
      }
      try {
        const info = JSON.parse(stdout);
        const result = parseVideoInfo(info);
        logger.info('probe', `影片分析成功: ${result.title}`, {
          title: result.title,
          uploader: result.uploader,
          duration: result.durationHuman,
          qualities: result.qualityOptions.length
        });
        resolve(result);
      } catch (e) {
        logger.error('probe', `影片分析失敗: ${e.message}`, { url });
        reject(new Error('Failed to parse yt-dlp output: ' + e.message));
      }
    });
  });
}

function parseVideoInfo(info) {
  const formats = info.formats || [];

  // Find best audio track size
  const audioFormats = formats.filter(f => f.acodec !== 'none' && f.vcodec === 'none');
  const bestAudio = audioFormats.reduce((best, f) => {
    const br = f.abr || f.tbr || 0;
    return br > (best.abr || best.tbr || 0) ? f : best;
  }, audioFormats[0] || {});
  const bestAudioSize = bestAudio.filesize || bestAudio.filesize_approx || 0;

  // Group video formats by height into standard resolutions
  const videoFormats = formats.filter(f => f.vcodec !== 'none' && f.height);
  const resolutionMap = {};

  for (const f of videoFormats) {
    // Map to nearest standard resolution
    const height = f.height;
    let matched = null;
    for (const std of STANDARD_RESOLUTIONS) {
      if (height >= std * 0.85 && height <= std * 1.15) {
        matched = std;
        break;
      }
    }
    if (!matched) continue;

    const videoSize = f.filesize || f.filesize_approx || 0;
    const totalSize = videoSize + bestAudioSize;
    const label = `${matched}p`;

    // Keep the best (largest filesize = highest quality) per resolution
    if (!resolutionMap[label] || totalSize > resolutionMap[label].estimatedSize) {
      resolutionMap[label] = {
        resolution: label,
        height: matched,
        formatId: f.format_id,
        videoCodec: f.vcodec,
        fps: f.fps,
        estimatedSize: totalSize,
        estimatedSizeHuman: formatBytes(totalSize),
        videoSize,
        audioSize: bestAudioSize
      };
    }
  }

  // Sort by height descending
  const qualityOptions = STANDARD_RESOLUTIONS
    .map(h => resolutionMap[`${h}p`])
    .filter(Boolean);

  // Extract subtitle info (P2)
  const subtitleList = [];
  const seenLangs = new Set();
  if (info.subtitles) {
    for (const [lang, tracks] of Object.entries(info.subtitles)) {
      if (seenLangs.size >= 10) break;
      if (!seenLangs.has(lang)) {
        seenLangs.add(lang);
        subtitleList.push({ lang, name: (tracks[0] && tracks[0].name) || lang, isAuto: false });
      }
    }
  }
  if (info.automatic_captions) {
    for (const [lang, tracks] of Object.entries(info.automatic_captions)) {
      if (seenLangs.size >= 15) break;
      if (!seenLangs.has(lang)) {
        seenLangs.add(lang);
        subtitleList.push({ lang, name: (tracks[0] && tracks[0].name) || lang, isAuto: true });
      }
    }
  }

  return {
    title: info.title || info.fulltitle || 'Unknown',
    duration: info.duration,
    durationHuman: info.duration ? formatDuration(info.duration) : 'unknown',
    thumbnail: info.thumbnail,
    uploader: info.uploader || info.channel,
    uploadDate: info.upload_date || null, // YYYYMMDD format from yt-dlp
    url: info.webpage_url || info.original_url,
    qualityOptions,
    bestAudioFormatId: bestAudio.format_id,
    subtitles: subtitleList
  };
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Start a download
function startDownload({ url, title, formatId, audioFormatId, resolution, categoryId, categoryName, remuxFormat, datePrefix, audioOnly, audioFormat, speedLimit, subtitles, scheduledAt }) {
  const id = uuidv4();
  remuxFormat = remuxFormat || 'mp4';
  const basePath = DEFAULT_BASE_PATH;
  const subdir = categoryName && categoryName !== '未分類' ? categoryName : '';
  const outputDir = subdir ? path.join(basePath, subdir) : basePath;

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  // Build filename template with optional date prefix (YYYYMMDD-)
  const filenameTemplate = datePrefix
    ? `${datePrefix}-%(title)s.%(ext)s`
    : '%(title)s.%(ext)s';
  const outputTemplate = path.join(outputDir, filenameTemplate);
  console.log('[DEBUG] datePrefix:', datePrefix, '| filenameTemplate:', filenameTemplate, '| outputTemplate:', outputTemplate);

  const record = {
    id,
    url,
    title: title || 'Unknown',
    resolution: audioOnly ? 'audio' : (resolution || 'best'),
    remuxFormat: audioOnly ? (audioFormat || 'mp3') : remuxFormat,
    audioOnly: !!audioOnly,
    audioFormat: audioFormat || null,
    categoryId: categoryId || 'default',
    categoryName: categoryName || '未分類',
    outputDir,
    status: 'queued',
    progress: 0,
    speed: null,
    eta: null,
    filesize: null,
    error: null,
    createdAt: new Date().toISOString(),
    completedAt: null,
    datePrefix: datePrefix || null,
    formatId: formatId || null,
    audioFormatId: audioFormatId || null,
    speedLimit: speedLimit || null,
    subtitles: subtitles || null,
    scheduledAt: scheduledAt || null,
  };

  // Check if this is a scheduled download (P3)
  if (scheduledAt && new Date(scheduledAt).getTime() > Date.now()) {
    record.status = 'scheduled';
    record.scheduledAt = scheduledAt;

    // Save to disk
    _activeDownloads.set(id, record);
    const downloads = readJSON(DOWNLOADS_FILE) || [];
    downloads.push(record);
    writeJSON(DOWNLOADS_FILE, downloads);
    _ensureFlushTimer();

    // Store for scheduler
    _scheduledDownloads.set(id, {
      scheduledAt,
      params: { url, title, formatId, audioFormatId, resolution, categoryId, categoryName, remuxFormat, datePrefix, audioOnly, audioFormat, speedLimit, subtitles }
    });

    logger.info('download', `排程下載: ${title || 'Unknown'} → ${new Date(scheduledAt).toLocaleString('zh-TW')}`, { id, scheduledAt });
    return record;
  }

  // Add to in-memory store and persist to disk
  _activeDownloads.set(id, record);
  const downloads = readJSON(DOWNLOADS_FILE) || [];
  downloads.push(record);
  writeJSON(DOWNLOADS_FILE, downloads);
  _ensureFlushTimer();

  logger.info('download', `開始下載: ${title || 'Unknown'}`, {
    id, url, resolution, remuxFormat, categoryName, outputDir
  });

  // Build yt-dlp args
  const args = [];

  if (audioOnly) {
    // Audio-only mode
    args.push('-x', '--audio-format', audioFormat || 'mp3', '--audio-quality', '0');
  } else {
    // Format selection
    if (formatId && audioFormatId) {
      args.push('-f', `${formatId}+${audioFormatId}`);
    } else if (formatId) {
      args.push('-f', `${formatId}+bestaudio`);
    } else {
      args.push('-f', 'bestvideo+bestaudio');
    }
    args.push('--remux-video', remuxFormat);
  }

  args.push(
    '--progress', '--newline',
    '--no-warnings',
    '--ffmpeg-location', path.dirname(FFMPEG),
    '--print', 'after_move:filepath',  // capture final output path
    '-o', outputTemplate,
    url
  );

  // Bandwidth throttle (P2)
  const effectiveSpeedLimit = speedLimit || appSettings.getDownloadSpeedLimit();
  if (effectiveSpeedLimit) {
    args.push('--limit-rate', effectiveSpeedLimit);
  }

  // Subtitle download (P2)
  if (subtitles && subtitles.length > 0) {
    const autoLangs = subtitles.filter(s => s.isAuto).map(s => s.lang);
    const manualLangs = subtitles.filter(s => !s.isAuto).map(s => s.lang);
    const allLangs = [...new Set([...manualLangs, ...autoLangs])];
    if (manualLangs.length > 0) args.push('--write-subs');
    if (autoLangs.length > 0) args.push('--write-auto-subs');
    args.push('--sub-langs', allLangs.join(','));
    const embed = subtitles.some(s => s.embed);
    if (embed) {
      args.push('--embed-subs', '--convert-subs', 'srt');
    }
  }

  // Prepend cookies args
  args.unshift(...getCookiesArgs());

  // --- Concurrency limiter: wait for a slot ---
  _spawnDownload(id, args, title, url, resolution, remuxFormat, categoryName, outputDir, audioOnly, audioFormat);

  return record;
}

// Internal: spawn yt-dlp with concurrency control
async function _spawnDownload(id, args, title, url, resolution, remuxFormat, categoryName, outputDir, audioOnly, audioFormat) {
  await _acquireSlot();

  // Spawn yt-dlp
  const child = spawn(YT_DLP, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PATH: path.dirname(FFMPEG) + ':' + process.env.PATH }
  });

  activeProcesses[id] = child;
  updateDownload(id, { status: 'downloading' });

  child.on('error', err => {
    delete activeProcesses[id];
    _releaseSlot();
    console.error('yt-dlp spawn error:', err.message);
    updateDownload(id, { status: 'error', error: 'Failed to start yt-dlp: ' + err.message });
    logger.error('download', `yt-dlp 啟動失敗: ${err.message}`, { id, url });
  });

  const progressRegex = /\[download\]\s+([\d.]+)%\s+of\s+~?([\d.]+\w+)(?:\s+at\s+([\d.]+\w+\/s))?(?:\s+ETA\s+(\S+))?/;
  const mergeRegex = /\[Merger\]|\[ExtractAudio\]|\[Remux\]/;
  let capturedFilePath = null;  // captured via --print after_move:filepath

  child.stdout.on('data', data => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const match = trimmed.match(progressRegex);
      if (match) {
        const progress = parseFloat(match[1]);
        const filesize = match[2] || null;
        const speed = match[3] || null;
        const eta = match[4] || null;
        updateDownload(id, { progress, filesize, speed, eta });
      } else if (mergeRegex.test(trimmed)) {
        updateDownload(id, { status: 'merging', progress: 100 });
      } else if (trimmed.startsWith('/') && !trimmed.startsWith('[')) {
        // --print after_move:filepath outputs absolute path (no brackets)
        capturedFilePath = trimmed;
        console.log('[DEBUG] yt-dlp captured output path:', capturedFilePath);
      }
    }
  });

  child.stderr.on('data', data => {
    const text = data.toString();
    // Log errors but don't fail yet — some stderr is informational
    if (text.includes('ERROR')) {
      updateDownload(id, { error: text.trim() });
    }
  });

  child.on('close', async (code) => {
    delete activeProcesses[id];
    _releaseSlot();
    if (code === 0) {
      // Prefer the path captured from --print after_move:filepath
      // Fallback to directory scan (sorted by mtime) if not captured
      let downloadedFile = null;
      if (capturedFilePath && fs.existsSync(capturedFilePath)) {
        downloadedFile = capturedFilePath;
        console.log('[DEBUG] Using captured filepath:', downloadedFile);
      } else {
        // Fallback: scan directory for most recently created file (ctimeMs, not mtime which yt-dlp may override)
        try {
          const files = fs.readdirSync(outputDir)
            .map(f => ({ name: f, path: path.join(outputDir, f), stat: fs.statSync(path.join(outputDir, f)) }))
            .filter(f => f.stat.isFile())
            .sort((a, b) => b.stat.ctimeMs - a.stat.ctimeMs);  // ctime = inode change time, more reliable
          if (files.length > 0) downloadedFile = files[0].path;
        } catch (e) {
          console.error('Could not find downloaded file:', e.message);
        }
        console.log('[DEBUG] Fallback directory scan found:', downloadedFile);
      }

      // Upload to Google Drive (async, non-blocking)
      let gdriveInfo = null;
      if (downloadedFile) {
        updateDownload(id, { status: 'uploading', progress: 100 });
        logger.info('upload', `開始上傳 Google Drive: ${title || 'Unknown'}`, {
          id, file: downloadedFile, categoryName
        });
        try {
          gdriveInfo = await uploadToGdrive(downloadedFile, categoryName);
          if (gdriveInfo) {
            logger.success('upload', `Google Drive 上傳成功: ${title || 'Unknown'}`, {
              id, fileId: gdriveInfo.id, link: gdriveInfo.webViewLink
            });
          } else {
            logger.warn('upload', `Google Drive 上傳失敗（無返回值）: ${title || 'Unknown'}`, { id });
          }
        } catch (e) {
          console.error('Google Drive upload error:', e.message);
          logger.error('upload', `Google Drive 上傳錯誤: ${e.message}`, {
            id, title, error: e.message
          });
        }
      }

      const completed = updateDownload(id, {
        status: 'completed',
        progress: 100,
        completedAt: new Date().toISOString(),
        localPath: downloadedFile,
        gdriveFileId: gdriveInfo?.id || null,
        gdriveLink: gdriveInfo?.webViewLink || null
      });

      logger.success('download', `下載完成: ${completed?.title || title || 'Unknown'}`, {
        id, resolution, remuxFormat, filesize: completed?.filesize,
        gdrive: !!gdriveInfo, gdriveLink: gdriveInfo?.webViewLink || null
      });
      // Send Telegram notification
      const driveLink = gdriveInfo?.webViewLink ? `\n🔗 ${gdriveInfo.webViewLink}` : '\n⚠️ Google Drive 上傳失敗';
      const msg = `✅ 下載完成\n📺 ${completed?.title || title || 'Unknown'}\n📐 ${resolution || 'best'} | ${remuxFormat.toUpperCase()}\n📁 ${outputDir}\n📂 分類: ${categoryName || '未分類'}${driveLink}`;
      sendTelegramNotification(msg);
    } else {
      const current = _activeDownloads.get(id) || (readJSON(DOWNLOADS_FILE) || []).find(d => d.id === id);
      const errMsg = current?.error || `yt-dlp exited with code ${code}`;
      updateDownload(id, {
        status: 'error',
        error: errMsg
      });

      logger.error('download', `下載失敗: ${title || 'Unknown'}`, {
        id, url, resolution, error: errMsg.substring(0, 500)
      });
      // Notify failure too
      sendTelegramNotification(`❌ 下載失敗\n📺 ${title || 'Unknown'}\n⚠️ ${errMsg.substring(0, 200)}`);
    }
  });
}

// Retry a failed download
function retryDownload(id) {
  const downloads = readJSON(DOWNLOADS_FILE) || [];
  const original = downloads.find(d => d.id === id);
  if (!original) throw Object.assign(new Error('Download not found'), { status: 404 });
  if (original.status !== 'error') throw Object.assign(new Error('Only failed downloads can be retried'), { status: 400 });

  const newRecord = startDownload({
    url: original.url,
    title: original.title,
    formatId: original.formatId || null,
    audioFormatId: original.audioFormatId || null,
    resolution: original.audioOnly ? 'audio' : original.resolution,
    categoryId: original.categoryId,
    categoryName: original.categoryName,
    remuxFormat: original.audioOnly ? (original.audioFormat || 'mp3') : (original.remuxFormat || 'mp4'),
    datePrefix: original.datePrefix || null,
    audioOnly: original.audioOnly || false,
    audioFormat: original.audioFormat || null,
    speedLimit: original.speedLimit || null,
    subtitles: original.subtitles || null,
  });

  logger.info('download', `重試下載: ${original.title}`, { oldId: id, newId: newRecord.id });
  return newRecord;
}

// Get status of a single download
function getStatus(id) {
  // Check in-memory first for active downloads (faster, fresher)
  if (_activeDownloads.has(id)) return _activeDownloads.get(id);
  const downloads = readJSON(DOWNLOADS_FILE) || [];
  return downloads.find(d => d.id === id) || null;
}

// List all downloads, with flexible filtering
// Backward compat: accepts a string (old statusFilter) or an object (new filters)
function listDownloads(filters) {
  let downloads = getDownloads();
  if (!filters) return downloads;

  // Backward compat: if filters is a string, treat as status filter
  if (typeof filters === 'string') {
    return downloads.filter(d => d.status === filters);
  }

  // Object-based filtering
  if (filters.status) {
    downloads = downloads.filter(d => d.status === filters.status);
  }
  if (filters.q) {
    const q = filters.q.toLowerCase();
    downloads = downloads.filter(d => (d.title || '').toLowerCase().includes(q));
  }
  if (filters.from) {
    const fromDate = new Date(filters.from);
    downloads = downloads.filter(d => d.completedAt && new Date(d.completedAt) >= fromDate);
  }
  if (filters.to) {
    const toDate = new Date(filters.to + 'T23:59:59');
    downloads = downloads.filter(d => d.completedAt && new Date(d.completedAt) <= toDate);
  }
  if (filters.category) {
    downloads = downloads.filter(d => d.categoryName === filters.category);
  }
  if (filters.audioOnly === 'true') {
    downloads = downloads.filter(d => d.audioOnly);
  }
  return downloads;
}

// Delete a download record (kill process if active)
function deleteDownload(id) {
  // Kill active process if any
  if (activeProcesses[id]) {
    activeProcesses[id].kill('SIGTERM');
    delete activeProcesses[id];
  }

  // Remove from in-memory if present
  _activeDownloads.delete(id);

  const downloads = readJSON(DOWNLOADS_FILE) || [];
  const idx = downloads.findIndex(d => d.id === id);
  if (idx === -1) {
    throw Object.assign(new Error('Download not found'), { status: 404 });
  }
  const removed = downloads.splice(idx, 1)[0];
  writeJSON(DOWNLOADS_FILE, downloads);
  return removed;
}

// --- P3: Launch a scheduled download (rebuilds yt-dlp args from stored params) ---
function _launchScheduledDownload(id, entry) {
  const p = entry.params;
  const remuxFormat = p.remuxFormat || 'mp4';
  const basePath = DEFAULT_BASE_PATH;
  const subdir = p.categoryName && p.categoryName !== '未分類' ? p.categoryName : '';
  const outputDir = subdir ? path.join(basePath, subdir) : basePath;
  fs.mkdirSync(outputDir, { recursive: true });

  const filenameTemplate = p.datePrefix
    ? `${p.datePrefix}-%(title)s.%(ext)s`
    : '%(title)s.%(ext)s';
  const outputTemplate = path.join(outputDir, filenameTemplate);

  const args = [];
  if (p.audioOnly) {
    args.push('-x', '--audio-format', p.audioFormat || 'mp3', '--audio-quality', '0');
  } else {
    if (p.formatId && p.audioFormatId) {
      args.push('-f', `${p.formatId}+${p.audioFormatId}`);
    } else if (p.formatId) {
      args.push('-f', `${p.formatId}+bestaudio`);
    } else {
      args.push('-f', 'bestvideo+bestaudio');
    }
    args.push('--remux-video', remuxFormat);
  }

  args.push(
    '--progress', '--newline',
    '--no-warnings',
    '--ffmpeg-location', path.dirname(FFMPEG),
    '--print', 'after_move:filepath',
    '-o', outputTemplate,
    p.url
  );

  const effectiveSpeedLimit = p.speedLimit || appSettings.getDownloadSpeedLimit();
  if (effectiveSpeedLimit) args.push('--limit-rate', effectiveSpeedLimit);

  if (p.subtitles && p.subtitles.length > 0) {
    const autoLangs = p.subtitles.filter(s => s.isAuto).map(s => s.lang);
    const manualLangs = p.subtitles.filter(s => !s.isAuto).map(s => s.lang);
    const allLangs = [...new Set([...manualLangs, ...autoLangs])];
    if (manualLangs.length > 0) args.push('--write-subs');
    if (autoLangs.length > 0) args.push('--write-auto-subs');
    args.push('--sub-langs', allLangs.join(','));
    if (p.subtitles.some(s => s.embed)) args.push('--embed-subs', '--convert-subs', 'srt');
  }

  args.unshift(...getCookiesArgs());

  updateDownload(id, { status: 'queued' });
  logger.info('download', `排程時間到，開始下載: ${p.title || 'Unknown'}`, { id });
  _spawnDownload(id, args, p.title, p.url, p.resolution, remuxFormat, p.categoryName, outputDir, p.audioOnly, p.audioFormat);
}

// --- P3: Cancel a scheduled download ---
function cancelSchedule(id) {
  if (_scheduledDownloads.has(id)) {
    _scheduledDownloads.delete(id);
    updateDownload(id, { status: 'cancelled' });
    logger.info('download', `排程已取消: ${id}`);
    return true;
  }
  throw Object.assign(new Error('Scheduled download not found'), { status: 404 });
}

// --- P3: Restore scheduled downloads on restart ---
(function restoreScheduledDownloads() {
  const downloads = readJSON(DOWNLOADS_FILE) || [];
  const now = Date.now();
  for (const d of downloads) {
    if (d.status === 'scheduled' && d.scheduledAt) {
      const params = {
        url: d.url, title: d.title, formatId: d.formatId,
        audioFormatId: d.audioFormatId, resolution: d.audioOnly ? 'audio' : d.resolution,
        categoryId: d.categoryId, categoryName: d.categoryName,
        remuxFormat: d.audioOnly ? (d.audioFormat || 'mp3') : (d.remuxFormat || 'mp4'),
        datePrefix: d.datePrefix, audioOnly: d.audioOnly || false,
        audioFormat: d.audioFormat, speedLimit: d.speedLimit,
        subtitles: d.subtitles
      };
      _scheduledDownloads.set(d.id, { scheduledAt: d.scheduledAt, params });
    }
  }
  if (_scheduledDownloads.size > 0) {
    console.log(`[Scheduler] Restored ${_scheduledDownloads.size} scheduled downloads`);
  }
})();

module.exports = {
  probe,
  startDownload,
  retryDownload,
  getStatus,
  listDownloads,
  getDownloads,
  deleteDownload,
  cancelSchedule,
  getQueueStatus,
  activeProcesses,
  flushToDisk: _flushToDisk,
  downloadEvents
};
