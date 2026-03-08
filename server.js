const express = require('express');
const cors = require('cors');
const path = require('path');
const categories = require('./lib/categories');
const downloader = require('./lib/downloader');

const app = express();
const PORT = 3847;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Categories API ---

app.get('/api/categories', (req, res) => {
  try {
    res.json(categories.list());
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/categories', (req, res) => {
  try {
    const cat = categories.add(req.body.name);
    res.status(201).json(cat);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.put('/api/categories/:id', (req, res) => {
  try {
    const cat = categories.update(req.params.id, req.body.name);
    res.json(cat);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.delete('/api/categories/:id', (req, res) => {
  try {
    const cat = categories.remove(req.params.id);
    res.json(cat);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// --- Download API ---

app.post('/api/download/probe', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    const info = await downloader.probe(url);
    res.json(info);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/download/start', (req, res) => {
  try {
    const { url, title, formatId, audioFormatId, resolution, categoryId, categoryName, remuxFormat } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    const record = downloader.startDownload({
      url, title, formatId, audioFormatId, resolution, categoryId, categoryName, remuxFormat
    });
    res.status(201).json(record);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/api/download/status/:id', (req, res) => {
  try {
    const status = downloader.getStatus(req.params.id);
    if (!status) {
      return res.status(404).json({ error: 'Download not found' });
    }
    res.json(status);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/api/downloads', (req, res) => {
  try {
    const { status } = req.query;
    res.json(downloader.listDownloads(status));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.delete('/api/downloads/:id', (req, res) => {
  try {
    const removed = downloader.deleteDownload(req.params.id);
    res.json(removed);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// --- Start server ---

app.listen(PORT, () => {
  console.log(`YouTube Downloader server running on http://localhost:${PORT}`);
});
