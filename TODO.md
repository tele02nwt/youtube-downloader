# TODO.md - YouTube Downloader Web App

## Phase 1: 基礎建設 ✅

### Task 1.1: 項目初始化 + Express Server 骨架
- [x] `npm init`，安裝 express, cors, uuid
- [x] 建立 `server.js`：Express app, static files, JSON body parser
- [x] 建立 `data/` 目錄，初始化 `categories.json`、`downloads.json`
- [x] 建立 `lib/storage.js`：JSON 讀寫封裝（atomic write）
- [x] 啟動測試

### Task 1.2: Categories API
- [x] CRUD（list, add, update, delete）
- [x] 預設分類 "未分類" 不可刪除
- [x] 驗證：名稱不可重複、不可為空
- [x] 拖曳排序 reorder API（PUT /categories/reorder）
- [x] 前端隱藏 default 分類的編輯/刪除按鈕 + error toast
- [x] Google Drive upload/mkdir JSON response wrapper unwrap 修正
- [x] 分類下拉移到 URL 輸入列（probe 前可見）+ 未分類路徑修正

### Task 1.3: yt-dlp Probe 封裝
- [x] `probe(url)` 函數：呼叫 `yt-dlp -j`，解析 JSON
- [x] 格式映射：8 標準解析度 + 合併檔案大小估算

## Phase 2: 下載核心 ✅

### Task 2.1: 下載引擎 + 進度追蹤
- [x] spawn yt-dlp 進程 + `--progress --newline` 進度解析
- [x] 狀態機：queued → downloading → merging → uploading_drive → completed / error

### Task 2.2: 下載狀態 API + 輸出路徑
- [x] GET/DELETE endpoints + status filter
- [x] 輸出路徑：`/data/youtube-downloads/{category}/`

## Phase 3: 前端 UI ✅

### Task 3.1: HTML 骨架 + Cyber CSS 主題
- [x] SPA 結構，4 個 tab（分類 | 下載 | 管理 | ⚙️設定）
- [x] Cyber/Futuristic 配色 + 動畫

### Task 3.2: 分類頁面
- [x] 卡片列表、inline edit、確認 modal

### Task 3.3: 下載頁面
- [x] URL 分析、格式/畫質選擇、分類下拉

### Task 3.4: 管理頁面
- [x] 進度條、status badges、auto-refresh、Drive 連結

## Phase 4: 整合 + 通知 ✅

### Task 4.1: 下載完成 Telegram 通知
- [x] 成功/失敗都通知（標題、大小、畫質、路徑）

### Task 4.2: Google Drive 整合
- [x] 自動建立根資料夾 + 分類子目錄
- [x] 下載完成自動上傳 Drive
- [x] 已完成清單顯示 Drive 連結

## Phase 5: 安全 + 部署 ✅

### Task 5.1: Cloudflare Tunnel 部署
- [x] 安裝 + 登入 cloudflared
- [x] 建立 tunnel `yt-downloader`
- [x] DNS route: `yt.ac02nwt.work` → localhost:3847
- [x] config.yml + credentials JSON
- [x] `start.sh` 啟動腳本（server + tunnel PID 管理）

### Task 5.2: 登入認證系統
- [x] `lib/auth.js`：session-based auth（cookie, timingSafeEqual）
- [x] `public/login.html`：Cyber 風格登入頁（粒子動畫、glow 效果）
- [x] Auth middleware（保護所有路由，放行 login + auth API）
- [x] HttpOnly + Secure + SameSite cookie
- [x] 密碼存 `.env` 環境變數

### Task 5.3: 帳號管理（設定頁）
- [x] 修改 username / password（需驗證當前密碼）
- [x] 修改後自動寫入 `.env` + 清除所有 session
- [x] 登出按鈕

### Task 5.4: 忘記密碼流程
- [x] Login 頁 "Forgot Password?" 連結
- [x] Step 1：輸入 email → `gog gmail send` 發 6 位驗證碼
- [x] Step 2：輸入驗證碼（10 分鐘過期，最多 5 次）
- [x] Step 3：驗證成功 → 顯示密碼 + 複製按鈕
- [x] Resend code 功能

### Task 5.5: Autocomplete 修復
- [x] 分類 input 加 `autocomplete="off" data-form-type="other"`
- [x] 防止 browser 把 login credentials 填入其他 input

## Phase 6: 活動日誌 + UI 增強 ✅

### Task 6.1: Activity Log 系統
- [x] `lib/logger.js`：JSON 存儲（data/activity-log.json），max 500 條
- [x] 6 種分類：download / upload / probe / auth / category / system
- [x] 4 種等級：info / success / warn / error
- [x] downloader.js 關鍵時刻寫 log（開始/完成/失敗/上傳）
- [x] server.js 加 log（auth 登入、分類新增/刪除）
- [x] API: GET /api/logs, GET /api/logs/stats, DELETE /api/logs

### Task 6.2: LOG Tab（前端）
- [x] Stats bar（全部/今日/成功/錯誤計數）
- [x] Filter dropdowns（分類 + 等級）
- [x] Log entries（level dot + category badge + timestamp + expandable details）
- [x] 清除全部日誌（確認 modal）
- [x] 載入更多（cursor-based pagination）

### Task 6.3: 文字亮度提升
- [x] `--text-primary`: `#e2e8f0` → `#f1f5f9`
- [x] `--text-secondary`: `#94a3b8` → `#cbd5e1`
- [x] `--text-dim`: `#475569` → `#94a3b8`

### Task 6.4: 字體大小設定
- [x] CSS variable `--font-scale` + `calc(16px * var(--font-scale))`
- [x] 三個 preset：中（1x）、大（1.2x）、特大（1.4x）
- [x] 設定頁按鈕切換 + localStorage 持久化
- [x] 頁面載入 IIFE 立即套用（防 FOUC）

## Phase 7: 下載增強 ✅

### Task 7.1: 檔名日期前綴（Date Prefix）
- [x] 後端 `probe()` 返回 `uploadDate`（yt-dlp `upload_date`，YYYYMMDD）
- [x] 後端 `startDownload()` 接受 `datePrefix`，嵌入 output template
- [x] 前端 probe result 頁面加 toggle switch（預設開啟）
- [x] 開啟：`YYYYMMDD-title.ext`；關閉：`title.ext`
- [x] 無 upload_date 時 toggle 自動隱藏
- [x] CSS-only toggle switch（cyber 風格，cyan accent）

## Phase 8: UI 修正 + 體驗優化 ✅

### Task 8.1: 分類下拉佈局修正
- [x] Select 移到 URL 輸入左邊（HTML 順序對調）
- [x] Select CSS 改成 `width:130px; flex-shrink:0`，URL input 保持 `flex:1`

### Task 8.2: 字體大小全域 scaling 修正
- [x] `font-size: calc(16px * var(--font-scale))` 從 `body` 移到 `html`
- [x] body 改用 `font-size: 1rem`（繼承 html）
- [x] 效果：全頁 `rem` 單位一齊 scale，唔再只影響 body

### Task 8.3: Probe 後保留分類選擇
- [x] `loadCategorySelect()` rebuild 前記錄 `prevValue`
- [x] rebuild 後 restore：`sel.value = prevValue`（若分類仍存在）

### Task 8.4: 格式按鈕 UX 說明
- [x] 格式區下方加說明文字（封裝格式不影響大小）
- [x] 畫質 header 加「（串流大小估算）」標籤

### Task 8.5: Telegram 通知群組更新
- [x] TG_GROUP → `-1003817368779`，TG_TOPIC → `191`

### Task 8.6: 日誌「載入更多」HTML error 修正
- [x] 修復重複 `style` attribute（`display:none` 被 browser 忽略）
- [x] `fetchLogs` 加 content-type 驗證、`credentials:'include'`、401 redirect
- [x] 確認 data 係 array 先 concat

### Task 8.7: 日誌 Timestamp 獨立欄位
- [x] Timestamp 從 `.log-meta`（.log-body 內）移到獨立 `.log-time` div
- [x] 固定寬 108px，右對齊，monospace

### Task 8.8: 架構 Tab（Workflow Infographic）
- [x] 新增「架構」Tab（日誌與設定之間）
- [x] 顯示 Gemini 生成的 workflow infographic（/workflow.jpg）

### Task 8.9: 指南 Tab（User Guide）
- [x] 新增「指南」Tab，完整使用說明
- [x] 頂部 anchor nav（8 個區域快速跳轉）
- [x] 每個 section 有「前往 XX Tab」按鈕（`goToTab()` helper）
- [x] 涵蓋：登入、分類、下載、管理、日誌、設定、FAQ

### Task 8.10: 頁面 Title + Subtitle
- [x] Browser tab title → `YT DOWNLOADER`
- [x] 副標題 → `// Powered by Wilson NG`

---

## Phase 9: Standalone Setup + Windows 支援 ✅

### Task 9.1: `lib/setup.js` — 跨平台 Setup 模組
- [x] `findBinary(name)` — 跨平台 binary 偵測（Windows winget/scoop/choco + Unix brew/which）
- [x] `getCloudflaredStatus()` — cloudflared 安裝狀態、PID 存活、最近日誌
- [x] `startTunnel(mode, options)` — Quick Tunnel（免帳號）+ Token Tunnel（固定域名）
- [x] `stopTunnel()` — SIGTERM + cleanup PID file
- [x] `getGdriveStatus()` — gog CLI 偵測 + 認證狀態（`gog drive ls` 測試）
- [x] `startGdriveAuth()` — spawn `gog auth login`（開瀏覽器 OAuth）
- [x] `getAuthPoll()` — 返回 auth 程序 output/running/done/success

### Task 9.2: Server API 路由
- [x] `GET  /api/setup/cloudflare/status`
- [x] `POST /api/setup/cloudflare/start` — body: `{mode, port, token}`
- [x] `POST /api/setup/cloudflare/stop`
- [x] `GET  /api/setup/gdrive/status`
- [x] `POST /api/setup/gdrive/auth`
- [x] `GET  /api/setup/gdrive/auth-poll`

### Task 9.3: Settings Tab UI
- [x] `// CLOUDFLARE TUNNEL` panel — status badge, Quick/Token 模式選擇, token input, port, 日誌, 安裝指引
- [x] `// GOOGLE DRIVE` panel — status badge, 一鍵授權, auth log 串流, 安裝指引
- [x] CSS 新增：`.status-badge(.ok/.warn/.err/.off)`, `.status-dot(.green/.yellow/.red/.grey)`, `.setup-section`, `.setup-log`, `.cf-mode-card`
- [x] Tab 切換時自動 refresh 狀態（settings tab click → cfRefreshStatus + gdRefreshStatus）
- [x] Windows 警告框（Google Drive panel 內）— 黃色邊框說明 gog 不支援 Windows
- [x] Windows install 指令（cloudflared 安裝框加 winget 優先）

### Task 9.4: Guide Tab 更新
- [x] 新增 `🪟 Windows 安裝指南` 章節（nav + section id=guide-windows）
- [x] WSL2 方案完整步驟（wsl --install → brew → node server）
- [x] 原生 Windows 方案（winget 4 工具 + .env 路徑 + start.bat）
- [x] Cloudflare 章節加 Windows winget install 步驟
- [x] Google Drive 章節加 Windows WSL2 推薦框 + macOS/Linux/WSL2 clarification

### Task 9.5: Windows 支援文件
- [x] `.env.example` — 配置範本，含 Windows 工具路徑示例
- [x] `start.bat` — Windows 一鍵啟動（npm install + node server.js + 開瀏覽器）
- [x] `stop.bat` — Windows 停止腳本（taskkill by PID）

---

---

## Phase 10: Telegram 設定 UI + 分發打包 ✅

### Task 10.1: lib/settings.js — 應用設定持久化模組
- [x] `loadSettings()` — 從 `data/settings.json` 讀取，deep merge DEFAULTS
- [x] `saveSettings(settings)` — atomic write via storage.js
- [x] `getTelegramSettings()` / `saveTelegramSettings()` — Telegram 專用 getter/setter
- [x] DEFAULTS 預填 groupId `-1003817368779` / topicId `191`

### Task 10.2: 後端 API + downloader 更新
- [x] `GET /api/settings/telegram` — 讀取 Telegram 設定
- [x] `POST /api/settings/telegram` — 儲存 Telegram 設定
- [x] `POST /api/settings/telegram/test` — 發測試訊息（直接用 body 值）
- [x] `downloader.js` — 移除 hardcoded TG_GROUP/TG_TOPIC，改用 `getTelegramSettings()`

### Task 10.3: 設定頁 Telegram 面板
- [x] `// TELEGRAM 通知` panel（CSS-only toggle + Group ID + Topic ID）
- [x] `tgLoadSettings()` / `saveTelegramSettings()` / `testTelegramSettings()` JS 函數
- [x] Tab 開啟時自動 load（settings tab click handler 加 `tgLoadSettings()`）
- [x] Info box：如何取得 Group ID / Topic ID

### Task 10.4: 設定頁面板重排
- [x] 帳號與安全（獨立面板，置頂）
- [x] 顯示偏好（原字體大小 panel，重命名）
- [x] YouTube Cookies（獨立 panel，重命名）
- [x] 新排列順序：帳號 → 顯示 → Cookies → Telegram → GDrive → Cloudflare
- [x] DOM IIFE 重排（panel-telegram / panel-gdrive / panel-cloudflare）

### Task 10.5: 指南頁 Telegram 章節
- [x] `📲 Telegram 通知設定` section（id=guide-telegram）
- [x] nav 加 Telegram 連結
- [x] 三步教學：取得 Group ID → 取得 Topic ID → 儲存並測試

### Task 10.6: 分發打包
- [x] `README.md` — 完整安裝說明（需求、安裝步驟、各功能說明、FAQ）
- [x] `.env.example` — Telegram 設定已移至 UI 的說明
- [x] `youtube-downloader.tar.gz` — 252KB，排除 node_modules / .env / data / .git 等

---

## Phase 11: Bug Fixes + 穩健性改善（2026-03-08）

### Task 11.1: yt-dlp 輸出文件路徑追蹤修正 ✅
- [x] **Root cause**: yt-dlp 預設設 mtime = 影片上傳日期 → 舊代碼用 `mtimeMs` 掃目錄拾錯文件
- [x] 加 `--print "after_move:filepath"` arg → yt-dlp 輸出最終路徑到 stdout
- [x] stdout handler 捕捉以 `/` 開頭且非 `[...]` 的行 → `capturedFilePath`
- [x] `close` handler 優先用 `capturedFilePath`；fallback 改用 `ctimeMs` 排序
- [x] 移除 debug console.log（待下次測試確認後）

### Task 11.2: 清理 debug logs（待辦）
- [ ] 確認 fix 生效後移除 `[DEBUG]` console.log 語句（server.js + downloader.js）

---

## Phase 12: SVG 用家流程圖（2026-03-10）✅

### Task 12.1: 架構頁（workflow.jpg）— 保留現狀 ✅
- [x] 架構 Tab 展示 `/workflow.jpg`（開發者技術圖），已於 2026-03-08 完成，繼續保留

### Task 12.2: 指南頁 Inline SVG 用家流程圖 ✅
- [x] 在 `#tab-guide` 的 Quick Nav 後、`#guide-quickstart` 前插入 SVG section
- [x] 標題：🗺️ 下載流程一覽（`.guide-section-title`）
- [x] 5 步水平 SVG：📋 貼URL → 🔍 分析 → ⚙️ 選設定 → ⬇️ 下載 → ✅ 完成
- [x] 完成節點下方兩個虛線分支：📂 Google Drive + 📲 Telegram
- [x] 暗色主題：cyan 邊框（步驟 1-4）+ 綠色邊框（步驟 5）
- [x] Responsive：`viewBox + width="100%" + overflow-x:auto + min-width:700px`

## Phase 13: Process 監控 + Auto-restart ✅（2026-03-12）

### Task 13.1: healthcheck.sh
- [x] 檢查 server PID 存活（`kill -0`）
- [x] 檢查 tunnel PID 存活（`kill -0`）
- [x] HTTP 回應驗證（`curl localhost:3847`，HTTP 000 = dead）
- [x] 任一掛咗自動執行 `start.sh` 重啟
- [x] OK 路徑：只寫 log，無 stdout（靜音）
- [x] 重啟路徑：echo ⚠️ 到 stdout + 寫 log

### Task 13.2: OpenClaw Cron
- [x] `openclaw cron create --every 10m --session isolated --model minimax-portal/MiniMax-M2.1 --light-context`
- [x] Telegram 通知路由：`--to "-1003817368779:topic:191" --channel telegram --announce`
- [x] Cron ID: `5fb3af45-3460-4c46-967c-90267e4a872a`

### Task 13.3: Git 清理
- [x] 加 `.gitignore`（排除 cookies.txt, *.pid, *.log）
- [x] `git rm --cached` 移走已追蹤的敏感文件
- [x] `git filter-repo` 清除 history 中的 cookies.txt 記錄
- [x] Force-push clean history

---

## Phase 14: Guide Split + GitHub Repo + Cron Fix ✅（2026-03-12）

### Task 14.1: Guide Split — Install Tab + Usage Tab
- [x] Split "指南" into "安裝"（install）+ "指南"（usage guide）
- [x] Created `tab-install` with 3 platform sub-tabs: OpenClaw / Linux / Windows
- [x] Added `switchInstallTab()` JS function
- [x] Moved CF/GDrive/Telegram sections to install guide

### Task 14.2: GitHub Standalone Repo
- [x] Created public repo: https://github.com/tele02nwt/youtube-downloader
- [x] `git subtree push --prefix=youtube-downloader yt-downloader master`
- [x] Added git remote `yt-downloader`

### Task 14.3: Install Guide Rewrite (3 Platforms)
- [x] OpenClaw tab: clone from GitHub + 6 steps + CF/GDrive/Telegram sub-steps + troubleshooting
- [x] Linux tab: NodeSource for Node.js + apt for ffmpeg/yt-dlp/cloudflared
- [x] Windows WSL2: 9 steps with NodeSource inside Ubuntu
- [x] Windows Native: 8 steps with nodejs.org + winget

### Task 14.4: Cron Routing Fix
- [x] Added `--session-key "ytdl-healthcheck"` to isolate cron session
- [x] Stricter prompt for MiniMax-M2.1 (explicit "zero characters" rule)

---

## Phase 14b: Notification Routing ✅（2026-03-12）

- ✅ Claude Code notification routing documented + task-meta.json pattern established

---

## 未來可能新增
- [ ] Playlist 批量下載
- [ ] 純音頻模式（MP3/AAC）
- [ ] 排程下載
- [ ] 下載歷史搜尋/篩選
- [ ] 手機響應式優化
- [ ] Cloudflare Access（SSO 保護）
- [ ] 多用戶支援
- [ ] Windows 原生 Google Drive 支援（rclone 整合或原生 API）
- [ ] `start.sh` 自動偵測 Windows/WSL，選擇正確啟動方式
- [ ] `.env` 工具路徑自動偵測（從 `lib/setup.js` findBinary 回填）
- [ ] README.md 完整中英雙語版本
