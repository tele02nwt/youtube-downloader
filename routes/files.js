function register(app) {
  const ctx = app.locals.routeContext;
  const { fs, path, categories, downloader, tenantAccess, logger } = ctx;
  const { formatFileSize } = ctx.helpers;

  app.get('/api/files', (req, res) => {
    try {
      const basePath = ctx.constants.DOWNLOAD_DIR;
      if (!fs.existsSync(basePath)) return res.json({ files: [] });

      const files = [];
      const cats = categories.list(req.session);
      const downloads = downloader.listDownloadsForSession(req.session);

      function scanDir(dir, categoryName) {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir);
        for (const name of entries) {
          const fullPath = path.join(dir, name);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            const cat = cats.find(c => c.name === name);
            if (cat) scanDir(fullPath, name);
            continue;
          }

          const ext = path.extname(name).toLowerCase();
          const mimeMap = {
            '.mp4': 'video/mp4', '.mkv': 'video/x-matroska', '.mov': 'video/quicktime',
            '.webm': 'video/webm', '.avi': 'video/x-msvideo',
            '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.opus': 'audio/opus',
            '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.flac': 'audio/flac',
            '.srt': 'text/srt', '.vtt': 'text/vtt'
          };
          const mimeType = mimeMap[ext] || 'application/octet-stream';
          const dl = downloads.find(d => d.localPath === fullPath);
          files.push({
            name,
            path: fullPath,
            size: stat.size,
            sizeHuman: formatFileSize(stat.size),
            mtime: stat.mtimeMs,
            category: categoryName || '未分類',
            mimeType,
            downloadId: dl ? dl.id : null
          });
        }
      }

      scanDir(basePath, '未分類');
      files.sort((a, b) => b.mtime - a.mtime);

      const catFilter = req.query.category;
      const scopedFiles = tenantAccess.filterFilesForSession(files, downloads, req.session);
      const filtered = catFilter ? scopedFiles.filter(f => f.category === catFilter) : scopedFiles;

      res.json({ files: filtered });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/files/serve/:encodedPath', (req, res) => {
    try {
      const filePath = decodeURIComponent(req.params.encodedPath);
      const basePath = ctx.constants.DOWNLOAD_DIR;
      const resolved = path.resolve(filePath);
      if (!resolved.startsWith(basePath)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      if (!fs.existsSync(resolved)) {
        return res.status(404).json({ error: 'File not found' });
      }
      if (!tenantAccess.canAccessFilePath(resolved, downloader.getDownloads(), req.session)) {
        return res.status(404).json({ error: 'File not found' });
      }

      const stat = fs.statSync(resolved);
      const ext = path.extname(resolved).toLowerCase();
      const mimeMap = {
        '.mp4': 'video/mp4', '.mkv': 'video/x-matroska', '.mov': 'video/quicktime',
        '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4',
        '.opus': 'audio/opus', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
        '.flac': 'audio/flac', '.srt': 'text/plain', '.vtt': 'text/vtt'
      };
      const contentType = mimeMap[ext] || 'application/octet-stream';

      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunkSize = end - start + 1;
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': contentType
        });
        fs.createReadStream(resolved, { start, end }).pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': stat.size,
          'Content-Type': contentType
        });
        fs.createReadStream(resolved).pipe(res);
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/files/:encodedPath', (req, res) => {
    try {
      const filePath = decodeURIComponent(req.params.encodedPath);
      const basePath = ctx.constants.DOWNLOAD_DIR;
      const resolved = path.resolve(filePath);
      if (!resolved.startsWith(basePath)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      if (!fs.existsSync(resolved)) {
        return res.status(404).json({ error: 'File not found' });
      }
      if (!tenantAccess.canAccessFilePath(resolved, downloader.getDownloads(), req.session)) {
        return res.status(404).json({ error: 'File not found' });
      }
      fs.unlinkSync(resolved);
      logger.info('system', `文件已刪除: ${path.basename(resolved)}`);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

module.exports = { register };
