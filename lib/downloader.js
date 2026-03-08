const { spawn, execFile, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON } = require('./storage');
const logger = require('./logger');

// Google Drive config
const GOG_BIN = '/home/linuxbrew/.linuxbrew/bin/gog';
const GDRIVE_ROOT_FOLDER_NAME = 'Youtube Downloader';
// Cache folder IDs to avoid repeated lookups
let gdriveRootFolderId = null;
const gdriveCategoryFolderIds = {};

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

// --- Google Drive helpers ---

function gogExec(args, timeout = 30000) {
  try {
    const result = execFileSync(GOG_BIN, args, { timeout, encoding: 'utf8' });
    return JSON.parse(result);
  } catch (e) {
    console.error('gog command failed:', args.join(' '), e.message);
    return null;
  }
}

function ensureGdriveRootFolder() {
  if (gdriveRootFolderId) return gdriveRootFolderId;

  // Search for existing folder
  const list = gogExec(['drive', 'ls', '--max', '100', '-j']);
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
  const createResult = gogExec(['drive', 'mkdir', GDRIVE_ROOT_FOLDER_NAME, '-j']);
  const created = createResult?.folder || createResult;
  if (created && created.id) {
    gdriveRootFolderId = created.id;
    return gdriveRootFolderId;
  }
  console.error('Failed to create Google Drive root folder');
  return null;
}

function ensureGdriveCategoryFolder(categoryName) {
  if (!categoryName || categoryName === '未分類') return ensureGdriveRootFolder();
  if (gdriveCategoryFolderIds[categoryName]) return gdriveCategoryFolderIds[categoryName];

  const rootId = ensureGdriveRootFolder();
  if (!rootId) return null;

  // Search in root folder
  const list = gogExec(['drive', 'ls', '--parent', rootId, '--max', '100', '-j']);
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
  const subResult = gogExec(['drive', 'mkdir', categoryName, '--parent', rootId, '-j']);
  const subCreated = subResult?.folder || subResult;
  if (subCreated && subCreated.id) {
    gdriveCategoryFolderIds[categoryName] = subCreated.id;
    return subCreated.id;
  }
  console.error('Failed to create category folder:', categoryName);
  return null;
}

function uploadToGdrive(localFilePath, categoryName) {
  const folderId = ensureGdriveCategoryFolder(categoryName);
  if (!folderId) {
    console.error('No Google Drive folder ID, skipping upload');
    return null;
  }

  try {
    const result = execFileSync(GOG_BIN, [
      'drive', 'upload', localFilePath,
      '--parent', folderId,
      '-j'
    ], { timeout: 600000, encoding: 'utf8' }); // 10 min timeout for large files
    const parsed = JSON.parse(result);
    // gog drive upload -j returns {file: {...}} wrapper
    const file = parsed.file || parsed;
    console.log('Uploaded to Google Drive:', file.name || file.id);
    return file;
  } catch (e) {
    console.error('Google Drive upload failed:', e.message);
    return null;
  }
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

// Standard resolution labels
const STANDARD_RESOLUTIONS = [2160, 1440, 1080, 720, 480, 360, 240, 144];

function getDownloads() {
  return readJSON(DOWNLOADS_FILE) || [];
}

function saveDownloads(downloads) {
  writeJSON(DOWNLOADS_FILE, downloads);
}

function updateDownload(id, updates) {
  const downloads = getDownloads();
  const idx = downloads.findIndex(d => d.id === id);
  if (idx === -1) return null;
  Object.assign(downloads[idx], updates);
  saveDownloads(downloads);
  return downloads[idx];
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

  return {
    title: info.title || info.fulltitle || 'Unknown',
    duration: info.duration,
    durationHuman: info.duration ? formatDuration(info.duration) : 'unknown',
    thumbnail: info.thumbnail,
    uploader: info.uploader || info.channel,
    uploadDate: info.upload_date || null, // YYYYMMDD format from yt-dlp
    url: info.webpage_url || info.original_url,
    qualityOptions,
    bestAudioFormatId: bestAudio.format_id
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
function startDownload({ url, title, formatId, audioFormatId, resolution, categoryId, categoryName, remuxFormat, datePrefix }) {
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
    resolution: resolution || 'best',
    remuxFormat,
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
    completedAt: null
  };

  const downloads = getDownloads();
  downloads.push(record);
  saveDownloads(downloads);

  logger.info('download', `開始下載: ${title || 'Unknown'}`, {
    id, url, resolution, remuxFormat, categoryName, outputDir
  });

  // Build yt-dlp args
  const args = [];

  // Format selection
  if (formatId && audioFormatId) {
    args.push('-f', `${formatId}+${audioFormatId}`);
  } else if (formatId) {
    args.push('-f', `${formatId}+bestaudio`);
  } else {
    args.push('-f', 'bestvideo+bestaudio');
  }

  args.push(
    '--remux-video', remuxFormat,
    '--progress', '--newline',
    '--no-warnings',
    '--ffmpeg-location', path.dirname(FFMPEG),
    '--print', 'after_move:filepath',  // capture final output path
    '-o', outputTemplate,
    url
  );

  // Prepend cookies args
  args.unshift(...getCookiesArgs());

  // Spawn yt-dlp
  const child = spawn(YT_DLP, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PATH: path.dirname(FFMPEG) + ':' + process.env.PATH }
  });

  activeProcesses[id] = child;
  updateDownload(id, { status: 'downloading' });

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

  child.on('close', code => {
    delete activeProcesses[id];
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

      // Upload to Google Drive (async, don't block status update)
      let gdriveInfo = null;
      if (downloadedFile) {
        updateDownload(id, { status: 'uploading', progress: 100 });
        logger.info('upload', `開始上傳 Google Drive: ${title || 'Unknown'}`, {
          id, file: downloadedFile, categoryName
        });
        try {
          gdriveInfo = uploadToGdrive(downloadedFile, categoryName);
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
      const current = getDownloads().find(d => d.id === id);
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

  return record;
}

// Get status of a single download
function getStatus(id) {
  const downloads = getDownloads();
  return downloads.find(d => d.id === id) || null;
}

// List all downloads, optionally filtered by status
function listDownloads(statusFilter) {
  const downloads = getDownloads();
  if (statusFilter) {
    return downloads.filter(d => d.status === statusFilter);
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

  const downloads = getDownloads();
  const idx = downloads.findIndex(d => d.id === id);
  if (idx === -1) {
    throw Object.assign(new Error('Download not found'), { status: 404 });
  }
  const removed = downloads.splice(idx, 1)[0];
  saveDownloads(downloads);
  return removed;
}

module.exports = {
  probe,
  startDownload,
  getStatus,
  listDownloads,
  deleteDownload
};
