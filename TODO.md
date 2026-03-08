# TODO.md - YouTube Downloader Web App

## Phase 1: 基礎建設（~30 min）

### Task 1.1: 項目初始化 + Express Server 骨架 [~10 min]
- [x] `npm init`，安裝 express, cors, uuid
- [x] 建立 `server.js`：Express app, static files, JSON body parser
- [x] 建立 `data/` 目錄，初始化 `categories.json`（預設分類: "未分類"）, `downloads.json`
- [x] 建立 `lib/storage.js`：JSON 讀寫封裝（atomic write）
- [x] 啟動測試：`node server.js` → `curl localhost:3847/api/categories`

### Task 1.2: Categories API [~10 min]
- [x] 建立 `lib/categories.js`：CRUD（list, add, update, delete）
- [x] 掛載 routes: GET/POST/PUT/DELETE `/api/categories`
- [x] 預設分類 "未分類" 不可刪除
- [x] 驗證：名稱不可重複、不可為空
- [x] curl 測試全部 endpoint

### Task 1.3: yt-dlp Probe 封裝 [~15 min]
- [x] 建立 `lib/downloader.js`
- [x] `probe(url)` 函數：呼叫 `yt-dlp -j <url>`，解析 JSON
- [x] 返回：title, duration, thumbnail, formats（帶 resolution + filesize）
- [x] 格式映射：將 yt-dlp formats 整理為標準解析度清單（2160p/1440p/1080p/720p/480p/360p/240p/144p）
- [x] 每個解析度估算合併檔案大小（video + best audio）
- [x] 掛載 POST `/api/download/probe`
- [x] 用真實 YouTube URL 測試

## Phase 2: 下載核心（~25 min）

### Task 2.1: 下載引擎 + 進度追蹤 [~15 min]
- [x] `download(options)` 函數：spawn yt-dlp 進程
- [x] 參數：url, format, quality, outputDir, remuxFormat
- [x] 進度解析：`--progress --newline`，正則抓取百分比 + 速度 + ETA
- [x] 下載記錄存入 downloads.json（id, url, title, status, progress, createdAt, completedAt）
- [x] 狀態機：queued → downloading → merging → completed / error
- [x] 掛載 POST `/api/download/start`

### Task 2.2: 下載狀態 API + 輸出路徑 [~10 min]
- [x] GET `/api/download/status/:id` — 返回進度百分比、速度、ETA
- [x] GET `/api/downloads` — 返回全部下載記錄（支援 status filter）
- [x] DELETE `/api/downloads/:id` — 刪除記錄（若進行中則先 kill 進程）
- [x] 輸出路徑邏輯：base path + category subfolder，自動建立
- [x] 預設路徑配置：`/data/youtube-downloads/`（VPS 環境）

## Phase 3: 前端 UI（~45 min）

### Task 3.1: HTML 骨架 + Cyber CSS 主題 [~15 min]
- [ ] 建立 `public/index.html`：SPA 結構，3 個 tab
- [ ] 建立 `public/css/style.css`：
  - Cyber/Futuristic 配色（深色底、霓虹色 accent）
  - 特色字體（Google Fonts: Orbitron / Share Tech Mono / Rajdhani）
  - Glow effects, scan lines, grid background
  - Tab navigation 動畫
  - 響應式佈局
- [ ] Tab 框架：分類 | 下載 | 管理

### Task 3.2: 分類頁面 (tab-categories.js) [~10 min]
- [ ] 分類列表顯示（卡片式）
- [ ] 新增分類：input + 確認按鈕
- [ ] 修改分類：inline edit（雙擊 or 編輯按鈕）
- [ ] 刪除分類：確認 dialog
- [ ] "未分類" 標籤鎖定不可刪除
- [ ] 動畫：新增/刪除時的 cyber 過渡效果

### Task 3.3: 下載頁面 (tab-download.js) [~15 min]
- [ ] URL 輸入框 + "分析" 按鈕
- [ ] 分析中 loading 動畫（cyber scanning effect）
- [ ] 分析結果展示：縮略圖、標題、時長
- [ ] 格式選擇：MP4 / MKV / MOV（radio buttons）
- [ ] 畫質選擇：下拉或卡片，右側顯示估算大小
- [ ] 分類選擇：下拉（從 categories API 取）
- [ ] 輸出路徑顯示（根據分類自動更新）
- [ ] "開始下載" 按鈕 → 開始後跳到管理頁

### Task 3.4: 管理頁面 (tab-manager.js) [~10 min]
- [ ] 進行中下載：進度條 + 百分比 + 速度 + ETA
- [ ] 已完成下載：列表（標題、大小、日期、路徑）
- [ ] 失敗下載：錯誤訊息 + 重試按鈕
- [ ] 進度自動刷新（2 秒 polling）
- [ ] 刪除記錄按鈕

## Phase 4: 整合 + 通知（~15 min）

### Task 4.1: 下載完成通知 [~8 min]
- [ ] 下載完成後呼叫 OpenClaw message API 發 Telegram 通知
- [ ] 通知內容：標題、大小、畫質、儲存路徑
- [ ] 失敗也通知（帶錯誤訊息）

### Task 4.2: 最終整合測試 [~7 min]
- [ ] 完整流程測試：建立分類 → 輸入 URL → 分析 → 選擇 → 下載 → 通知
- [ ] Edge cases：無效 URL、網絡錯誤、重複下載
- [ ] UI 微調：spacing, animation timing, 響應式

---

## 任務分配策略
- Task 1.1 ~ 2.2（後端）→ Claude Code Agent #1
- Task 3.1 ~ 3.4（前端）→ Claude Code Agent #2（依賴 Agent #1 的 API 完成）
- Task 4.1 ~ 4.2（整合）→ 任一 Agent 或主 session

## 預計總時間：~2 小時
