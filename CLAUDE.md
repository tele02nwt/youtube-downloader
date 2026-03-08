# YouTube Downloader Web App

## 項目概述
一個本地 YouTube 下載器 Web App，提供 Cyber/Futuristic 風格 UI，支援影片下載、分類管理、進度追蹤。

## 技術棧
- **後端**: Node.js (Express) — REST API server
- **前端**: 單頁應用 (SPA)，純 HTML/CSS/JS，Cyber/Futuristic 風格
- **下載引擎**: yt-dlp（透過 video-transcript-downloader skill 的 vtd.js 作參考）
- **數據存儲**: JSON 文件（categories.json, downloads.json）— 輕量，不需要數據庫
- **Google Drive**: 透過 rclone 或直接 mount 路徑輸出
- **通知**: OpenClaw message API（Telegram 通知）

## 目錄結構
```
youtube-downloader/
├── CLAUDE.md           # 本文件
├── TODO.md             # 任務清單
├── PROGRESS.md         # 進度記錄
├── package.json
├── server.js           # Express server 入口
├── public/             # 前端靜態文件
│   ├── index.html      # SPA 主頁
│   ├── css/
│   │   └── style.css   # Cyber/Futuristic 風格
│   └── js/
│       ├── app.js      # 主應用邏輯 + routing
│       ├── tab-categories.js   # 分類管理
│       ├── tab-download.js     # 下載設定
│       └── tab-manager.js      # 下載管理
├── lib/
│   ├── downloader.js   # yt-dlp 封裝（格式偵測、下載、進度）
│   ├── categories.js   # 分類 CRUD
│   └── storage.js      # JSON 持久化
└── data/
    ├── categories.json # 分類數據
    └── downloads.json  # 下載記錄
```

## API 端點設計
```
GET    /api/categories          # 列出所有分類
POST   /api/categories          # 新增分類
PUT    /api/categories/:id      # 修改分類
DELETE /api/categories/:id      # 刪除分類

POST   /api/download/probe      # 探測 URL（返回標題、可用畫質、估算大小）
POST   /api/download/start      # 開始下載
GET    /api/download/status/:id # 查詢下載進度
GET    /api/downloads           # 列出所有下載記錄
DELETE /api/downloads/:id       # 刪除記錄

GET    /api/settings            # 取得設定（輸出路徑等）
PUT    /api/settings            # 更新設定
```

## 關鍵實現細節

### yt-dlp 進度追蹤
- 用 `--progress` + `--newline` 解析 stdout 進度行
- 正則: `/\[download\]\s+([\d.]+)%\s+of\s+~?([\d.]+\w+)/`
- 進度存入 downloads.json，前端 SSE 或 polling 取得

### 畫質檔案大小估算
- `yt-dlp -j <url>` 取得 JSON metadata，內含 `formats[]`
- 每個 format 有 `filesize` 或 `filesize_approx`
- 合併 video + audio format 估算總大小

### 輸出路徑
- 預設: `~/Google Drive/Youtube Downloader/`
- 按分類加子目錄: `~/Google Drive/Youtube Downloader/{category}/`
- 首次使用自動建立

### 格式支援
- MP4: `--remux-video mp4`
- MKV: `--remux-video mkv`  
- MOV: `--remux-video mov`

## 啟動指令
```bash
cd /data/.openclaw/workspace_project/youtube-downloader
npm install
node server.js
# 默認 port: 3847
```

## ⚠️ 注意事項
- yt-dlp 路徑: `/home/linuxbrew/.linuxbrew/bin/yt-dlp`
- ffmpeg 需要安裝: `brew install ffmpeg`
- vtd.js 參考路徑: `/data/.openclaw/workspace/skills/video-transcript-downloader/scripts/vtd.js`
- 下載是異步的，用 child_process spawn + progress parsing
- 前端用 polling（每 2 秒）查詢下載進度，簡單可靠

## Checklist（開發時必看）
1. ✅ 每個 API endpoint 都要有 error handling
2. ✅ 下載前必須 probe 成功才能開始
3. ✅ 分類刪除時要檢查是否有進行中的下載
4. ✅ 前端 tab 切換時保持狀態（不清空輸入）
5. ✅ CSS 用 CSS variables 統一 cyber 色調
6. ✅ 所有金額/大小用 human-readable 格式（MB/GB）
