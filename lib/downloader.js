const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON } = require('./storage');

const YT_DLP = '/home/linuxbrew/.linuxbrew/bin/yt-dlp';
const FFMPEG = '/home/linuxbrew/.linuxbrew/bin/ffmpeg';
const DOWNLOADS_FILE = 'downloads.json';
const DEFAULT_BASE_PATH = '/data/youtube-downloads';

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
    const child = spawn(YT_DLP, ['-j', '--no-warnings', url], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PATH: path.dirname(FFMPEG) + ':' + process.env.PATH }
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => stdout += d.toString());
    child.stderr.on('data', d => stderr += d.toString());
    child.on('close', code => {
      if (code !== 0) {
        return reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`));
      }
      try {
        const info = JSON.parse(stdout);
        const result = parseVideoInfo(info);
        resolve(result);
      } catch (e) {
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
function startDownload({ url, title, formatId, audioFormatId, resolution, categoryId, categoryName, remuxFormat }) {
  const id = uuidv4();
  remuxFormat = remuxFormat || 'mp4';
  const basePath = DEFAULT_BASE_PATH;
  const subdir = categoryName && categoryName !== '未分類' ? categoryName : '';
  const outputDir = subdir ? path.join(basePath, subdir) : basePath;

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  const outputTemplate = path.join(outputDir, '%(title)s.%(ext)s');

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
    '-o', outputTemplate,
    url
  );

  // Spawn yt-dlp
  const child = spawn(YT_DLP, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PATH: path.dirname(FFMPEG) + ':' + process.env.PATH }
  });

  activeProcesses[id] = child;
  updateDownload(id, { status: 'downloading' });

  const progressRegex = /\[download\]\s+([\d.]+)%\s+of\s+~?([\d.]+\w+)(?:\s+at\s+([\d.]+\w+\/s))?(?:\s+ETA\s+(\S+))?/;
  const mergeRegex = /\[Merger\]|\[ExtractAudio\]|\[Remux\]/;

  child.stdout.on('data', data => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      const match = line.match(progressRegex);
      if (match) {
        const progress = parseFloat(match[1]);
        const filesize = match[2] || null;
        const speed = match[3] || null;
        const eta = match[4] || null;
        updateDownload(id, { progress, filesize, speed, eta });
      } else if (mergeRegex.test(line)) {
        updateDownload(id, { status: 'merging', progress: 100 });
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
      updateDownload(id, {
        status: 'completed',
        progress: 100,
        completedAt: new Date().toISOString()
      });
    } else {
      const current = getDownloads().find(d => d.id === id);
      updateDownload(id, {
        status: 'error',
        error: current?.error || `yt-dlp exited with code ${code}`
      });
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
