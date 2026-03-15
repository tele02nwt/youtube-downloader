# YouTube Downloader Web App

## 項目概述
一個本地 YouTube 下載器 Web App，提供 Cyber/Futuristic 風格 UI，支援影片下載、分類管理、進度追蹤、Google Drive 自動上傳。透過 Cloudflare Tunnel 對外提供 HTTPS 訪問，帶有完整的登入認證系統。

## 技術棧
- **後端**: Node.js (Express) — REST API server
- **前端**: 單頁應用 (SPA)，純 HTML/CSS/JS，Cyber/Futuristic 風格（暗色主題，可調字體大小）
- **下載引擎**: yt-dlp + ffmpeg
- **數據存儲**: JSON 文件（categories.json, downloads.json）— 輕量，不需要數據庫
- **Google Drive**: 透過 gog CLI 上傳（`gog drive upload --parent <folderId>`）
- **通知**: OpenClaw message API（Telegram 通知）
- **認證**: Cookie-based session auth（HttpOnly + Secure + SameSite）
- **網絡**: Cloudflare Tunnel（QUIC 協議，自動 HTTPS）
- **郵件**: gog CLI（`gog gmail send`）用於忘記密碼驗證碼

## 目錄結構
```
youtube-downloader/
├── CLAUDE.md           # 本文件
├── README.md           # 用戶安裝指南（分發用）
├── TODO.md             # 任務清單
├── PROGRESS.md         # 進度記錄
├── healthcheck.sh      # 健康檢查 + auto-restart（由 OpenClaw cron 每 10 分鐘執行）
├── start.sh            # 啟動腳本（Linux/macOS/WSL2：server + Cloudflare Tunnel）
├── start.bat           # 啟動腳本（Windows 原生：自動裝依賴、開瀏覽器）
├── stop.bat            # 停止腳本（Windows 原生）
├── .env                # 認證憑證（不 commit）
├── .env.example        # 配置範本（含 Windows 路徑說明）
├── package.json
├── server.js           # Express server 入口
├── public/
│   ├── index.html      # SPA 主頁（分類/下載/管理/日誌/架構/安裝/指南/設定 8 個 tab）
│   ├── workflow.jpg    # Workflow infographic（架構 tab）
│   └── login.html      # 登入頁（含忘記密碼流程）
├── lib/
│   ├── auth.js         # 認證模組（session, verification code, email）
│   ├── downloader.js   # yt-dlp 封裝（格式偵測、下載、進度）
│   ├── logger.js       # 活動日誌引擎（JSON 存儲，max 500 條）
│   ├── categories.js   # 分類 CRUD
│   ├── setup.js        # 跨平台 Setup 模組（Cloudflare + Google Drive 設定/驗證）
│   ├── settings.js     # ⭐ 持久化應用設定（Telegram Group/Topic 等）
│   └── storage.js      # JSON 持久化
└── data/
    ├── categories.json    # 分類數據
    ├── downloads.json     # 下載記錄
    ├── activity-log.json  # 活動日誌
    ├── settings.json      # ⭐ 持久化設定（由 lib/settings.js 管理）
    ├── cookies.txt        # YouTube cookies（可選）
    ├── server.log         # Server 日誌
    ├── tunnel.log         # Tunnel 日誌
    ├── server.pid         # Server PID
    ├── tunnel.pid         # Tunnel PID
    └── healthcheck.log    # Auto-restart 歷史記錄
```

## 前端設計模式

### CSS Variable Font Scaling（字體大小切換）
```css
:root { --font-scale: 1; }
html.font-medium { --font-scale: 1; }
html.font-large  { --font-scale: 1.2; }
html.font-xlarge { --font-scale: 1.4; }
body { font-size: calc(16px * var(--font-scale)); }
```
- 設定頁三個按鈕切換（中/大/特大）
- 用 `localStorage.setItem('yt-font-size', size)` 持久化
- 頁面載入時 `(function(){ ... })()` IIFE 立即讀取並套用 class
- 所有 font-size 用 `rem` 自動跟隨 root 縮放

### 暗色主題文字亮度
- `--text-primary: #f1f5f9`（最亮，標題/內容）
- `--text-secondary: #cbd5e1`（次亮，描述/meta）
- `--text-dim: #94a3b8`（最暗但仍可讀，placeholder/badge）
- ⚠️ 暗色背景下 `#475569` 太暗，讀唔到，最低用 `#94a3b8`

### Activity Log 系統
- `lib/logger.js`：JSON 檔存儲，max 500 條，FIFO
- 分類：download / upload / probe / auth / category / system
- 等級：info / success / warn / error
- 前端：stat chips + filter dropdowns + expandable detail cards
- 每條 log 有 level dot（顏色）、category badge、timestamp、可展開 details

## API 端點設計
```
# Auth
POST   /api/auth/login              # 登入（返回 session cookie）
POST   /api/auth/logout             # 登出
GET    /api/auth/check              # 檢查認證狀態
GET    /api/auth/info               # 取得當前用戶名
POST   /api/auth/update-credentials # 修改用戶名/密碼
POST   /api/auth/forgot-password    # 發送驗證碼到 email
POST   /api/auth/verify-code        # 驗證碼驗證 → 返回密碼

# Categories
GET    /api/categories              # 列出所有分類
POST   /api/categories              # 新增分類
PUT    /api/categories/reorder      # 拖曳排序（body: {ids: [...]})
PUT    /api/categories/:id          # 修改分類
DELETE /api/categories/:id          # 刪除分類

# Downloads
POST   /api/download/probe      # 探測 URL（返回標題、可用畫質、估算大小、uploadDate）
POST   /api/download/start      # 開始下載
GET    /api/download/status/:id # 查詢下載進度
GET    /api/downloads           # 列出所有下載記錄
DELETE /api/downloads/:id       # 刪除記錄

# Cookies
GET    /api/cookies/status      # Cookie 狀態
POST   /api/cookies/upload      # 上傳 cookies.txt
DELETE /api/cookies              # 清除 cookies

# Logs
GET    /api/logs                # 列出日誌（?category=&level=&limit=&before=）
GET    /api/logs/stats          # 日誌統計（total, today, byLevel, byCategory）
DELETE /api/logs                # 清除所有日誌

# Setup (Cloudflare + Google Drive — Phase 9)
GET    /api/setup/cloudflare/status   # CF 狀態（installed, running, pid, recentLog）
POST   /api/setup/cloudflare/start    # 啟動 Tunnel（body: {mode, port, token}）
POST   /api/setup/cloudflare/stop     # 停止 Tunnel
GET    /api/setup/gdrive/status       # GDrive 狀態（installed, authenticated, binPath）
POST   /api/setup/gdrive/auth         # 啟動 gog auth login（開瀏覽器 OAuth）
GET    /api/setup/gdrive/auth-poll    # 輪詢授權進度（output, running, done, success）

# Settings (Phase 10)
GET    /api/settings/telegram         # 讀取 Telegram 設定 {enabled, groupId, topicId}
POST   /api/settings/telegram         # 儲存 Telegram 設定
POST   /api/settings/telegram/test    # 發送測試訊息（直接用 body 值，不需先 save）
```

## 關鍵實現細節

### Cloudflare Tunnel 設定
- Tunnel name: `yt-downloader`
- Tunnel ID: `ae598c32-1d00-42be-8c34-ea4139ec53d8`
- 域名: `yt.ac02nwt.work` → `http://localhost:3847`
- Config: `/data/.cloudflared/config.yml`
- Credentials: `/data/.cloudflared/ae598c32-*.json`
- 啟動: `bash start.sh`（同時啟動 server + tunnel）

### 認證系統
- Cookie-based session（`yt_session`，HttpOnly + Secure + SameSite=strict）
- Session TTL: 24 小時
- 密碼存 `.env` 環境變數（`YT_AUTH_USER` / `YT_AUTH_PASS`）
- 密碼比較用 `crypto.timingSafeEqual`（先 SHA256 hash 統一長度）
- Auth middleware 攔截所有路由，只放行 `/login.html` 和 `/api/auth/*`

### 忘記密碼流程
1. 用戶輸入 email（即 username）
2. Server 生成 6 位隨機碼，透過 `gog gmail send` 發到 email
3. 用戶輸入驗證碼（10 分鐘過期，最多 5 次嘗試）
4. 驗證成功 → 返回密碼明文
5. 安全措施：錯誤 email 也返回 `{ok:true}`（不洩露帳號是否存在）

### yt-dlp 進度追蹤
- 用 `--progress` + `--newline` 解析 stdout 進度行
- 正則: `/\[download\]\s+([\d.]+)%\s+of\s+~?([\d.]+\w+)/`
- 進度存入 downloads.json，前端 polling（2 秒）取得

### yt-dlp 輸出文件路徑追蹤（⚠️ 陷阱記錄）
**問題**：yt-dlp 預設把下載文件的 mtime 設成**影片上傳日期**（非下載時間）。
若用 `mtimeMs` 降序排序來「找最新文件」，會拿到 mtime 最近的**舊文件**，而非剛下載的文件。

**正確做法**：用 `--print "after_move:filepath"` 直接拿 yt-dlp 告知的輸出路徑：
```javascript
// 加 flag
args.push('--print', 'after_move:filepath');

// stdout handler 捕捉（absolute path，無 [...] bracket）
if (trimmed.startsWith('/') && !trimmed.startsWith('[')) {
  capturedFilePath = trimmed;
}

// close handler
if (capturedFilePath && fs.existsSync(capturedFilePath)) {
  downloadedFile = capturedFilePath;                     // 優先用
} else {
  // fallback：ctimeMs（inode change time，比 mtime 可靠）
  files.sort((a, b) => b.stat.ctimeMs - a.stat.ctimeMs);
  downloadedFile = files[0]?.path ?? null;
}
```

### Google Drive 整合
- 用 `gog drive mkdir` 自動建根資料夾 + 分類子目錄
- 用 `gog drive upload --parent <folderId>` 上傳
- Folder ID 有 cache，唔會重複查詢
- 大檔案上傳 timeout 設 10 分鐘
- ⚠️ `gog -j` JSON response 有 wrapper：`upload` → `{file:{...}}`，`mkdir` → `{folder:{...}}`，`ls` → `{files:[...]}`
- 必須用 `parsed.file || parsed` / `result.folder || result` unwrap

### 格式支援
- MP4: `--remux-video mp4`
- MKV: `--remux-video mkv`
- MOV: `--remux-video mov`

### Tabs（目前 8 個）
1. **分類**（categories）— 分類 CRUD + 拖曳排序
2. **下載**（download）— URL probe + 格式/畫質選擇 + 開始下載
3. **管理**（manager）— 下載進度追蹤 + Drive 連結
4. **日誌**（logs）— Activity log，filter + pagination
5. **架構**（workflow）— Workflow infographic 靜態圖片（`/workflow.jpg`，給開發者看）
6. **安裝**（install）— 3 平台安裝指南（OpenClaw / Linux / Windows），含 sub-tabs + `switchInstallTab()`
7. **指南**（guide）— Usage guide，anchor nav + tab jump；頂部有 **inline SVG 用家流程圖**（🗺️ 下載流程一覽）
8. **設定**（settings）⚙️ — 帳號與安全 / 顯示偏好 / YouTube Cookies / Telegram 通知 / Google Drive / Cloudflare Tunnel

### Telegram 通知
- Group/Topic 設定**已移至 Web UI 設定頁**（`// TELEGRAM 通知` panel），持久化於 `data/settings.json`
- 預設值：Group `-1003817368779`，Topic `191`
- `lib/settings.js` → `getTelegramSettings()` 動態讀取（取代舊版 hardcode const）
- 呢個 group/topic 唔係 Claude 對話，係獨立通知 topic

### 重要 CSS 模式

#### font-size global scaling（必看）
```css
/* ✅ 必須設在 html，唔係 body */
html { font-size: calc(16px * var(--font-scale)); }
html.font-medium { --font-scale: 1; }
html.font-large  { --font-scale: 1.2; }
html.font-xlarge { --font-scale: 1.4; }
body { font-size: 1rem; } /* 繼承 html */
```
原因：`rem` 係相對 `html` root font-size，設在 `body` 無效。

#### goToTab helper（指南頁 tab 跳轉）
```javascript
function goToTab(name) {
  const btn = document.querySelector('.tab-btn[data-tab="' + name + '"]');
  if (btn) btn.click();
}
```

#### fetchLogs 防 HTML error
```javascript
const contentType = res.headers.get('content-type') || '';
if (!contentType.includes('application/json')) {
  throw new Error('伺服器返回非 JSON 回應（HTTP ' + res.status + '）');
}
```

#### 指南頁 Inline SVG 用家流程圖
```html
<!-- 放在指南 tab 的 panel-header 之後，guide-quickstart 之前 -->
<div class="guide-section" style="padding:16px 0;">
  <div class="guide-section-title">🗺️ 下載流程一覽</div>
  <div style="overflow-x:auto;margin-top:12px;">
    <svg viewBox="0 0 900 220" width="100%" style="min-width:700px;" ...>
      <!-- 5 步水平流程：貼URL → 分析 → 選設定 → 下載 → 完成 -->
      <!-- 步驟 1-4：cyan 邊框(#00f0ff)；步驟 5：綠色邊框(#4ade80) -->
      <!-- 完成節點下方兩個虛線分支：GDrive + Telegram -->
    </svg>
  </div>
</div>
```
**設計原則**：暗色主題、圓角矩形 + emoji icon、實線/虛線箭頭區分必選/可選步驟。

### 檔名日期前綴（Date Prefix）
- Probe 返回 `uploadDate`（yt-dlp 的 `upload_date`，YYYYMMDD 格式）
- 前端 probe result 頁面有 toggle switch（預設開啟）
- 開啟時 filename = `YYYYMMDD-title.ext`，關閉時 = `title.ext`
- 後端 `startDownload()` 接受 `datePrefix` 參數，嵌入 yt-dlp output template
- 如果影片冇 `upload_date`（rare），toggle 自動隱藏

## Phase 9: Standalone Setup（`lib/setup.js`）

### 模組設計
`lib/setup.js` 負責 Cloudflare Tunnel 和 Google Drive 的設定 + 狀態偵測，**獨立於 downloader.js**。

#### 跨平台 findBinary(name)
```javascript
const IS_WINDOWS = process.platform === 'win32';
const EXE = IS_WINDOWS ? '.exe' : '';
// Windows: winget links, LOCALAPPDATA, scoop shims, chocolatey, where.exe
// Unix: brew paths (/opt/homebrew, /home/linuxbrew), /usr/local/bin, which
```
⚠️ Windows fallback 用 `where.exe`；Unix 用 `which`。

#### Cloudflare Tunnel 模式
- **Quick Tunnel**: `cloudflared tunnel --url http://localhost:PORT` — 免帳號，URL 每次不同
- **Token Tunnel**: `cloudflared tunnel --no-autoupdate run --token <TOKEN>` — 固定域名，需 Zero Trust Dashboard

#### Google Drive auth flow
```
POST /api/setup/gdrive/auth → spawn gog auth login
GET /api/setup/gdrive/auth-poll → { output, running, done, success }
// 前端每 1.5s poll，done=true 後停止 setInterval
```
⚠️ `gog auth login` 只在 macOS/Linux 可用（Swift binary），Windows 需 WSL2。

### Windows Standalone 支援

#### 兩條路
| 方案 | Google Drive | 啟動方式 | 複雜度 |
|------|-------------|---------|--------|
| WSL2（推薦） | ✅ 完整 | `bash start.sh` in WSL | 中 |
| Windows 原生 | ❌ 不支援 | `start.bat` | 低 |

#### Windows 原生工具安裝（winget）
```powershell
winget install OpenJS.NodeJS.LTS
winget install yt-dlp.yt-dlp
winget install Gyan.FFmpeg
winget install Cloudflare.cloudflared
```

#### .env 工具路徑覆蓋（原生 Windows 用）
```env
YT_DLP_PATH=C:\Users\USERNAME\AppData\Local\Microsoft\WinGet\Links\yt-dlp.exe
FFMPEG_PATH=C:\ffmpeg\bin\ffmpeg.exe
```

#### start.bat / stop.bat
- `start.bat`：自動 `npm install`、殺舊 PID、`node server.js`、`start http://localhost:3847`
- `stop.bat`：讀 `data\server.pid` → `taskkill /PID`

### Settings Tab UI Patterns

#### Status Badge 組件
```css
.status-badge { display:inline-flex; align-items:center; gap:6px; border-radius:20px; }
.status-badge.ok   { color:#4ade80; border:1px solid rgba(74,222,128,0.3); }
.status-badge.warn { color:#fbbf24; border:1px solid rgba(251,191,36,0.3); }
.status-badge.err  { color:#f87171; border:1px solid rgba(248,113,113,0.3); }
.status-dot.green { background:#4ade80; box-shadow:0 0 6px #4ade80; } /* glow for running */
```

#### Auto-refresh on tab open
```javascript
// In tab click handler:
if (btn.dataset.tab === 'settings') { cfRefreshStatus(); gdRefreshStatus(); }
```

#### gog auth 輪詢模式
```javascript
// 點 auth → fetch /api/setup/gdrive/auth → setInterval(poll, 1500)
// poll: /api/setup/gdrive/auth-poll → { output, done }
// done=true → clearInterval → showToast success/fail
// setTimeout 180s 自動 abort（防永久 loop）
```

## 啟動指令
```bash
# Linux / macOS / WSL2
bash /data/.openclaw/workspace_project/projects/youtube-downloader/start.sh

# 手動（任何平台）
cd /data/.openclaw/workspace_project/projects/youtube-downloader
node server.js  # localhost:3847

# Windows 原生（雙擊）
start.bat
```

## 公開網址
- https://yt.ac02nwt.work

## GitHub Repo（Standalone 分發）
- https://github.com/tele02nwt/youtube-downloader
- 用 `git subtree push --prefix=youtube-downloader yt-downloader master` 從 workspace monorepo 推送
- Remote: `yt-downloader`

## 📣 Claude Code Notification Routing

### Routing Table
| Scenario | Telegram Group | Topic |
|----------|---------------|-------|
| Agent Teams / Hook default (**NEVER change!**) | `-1003817368779` | `85` |
| YT Downloader cron + download complete notifications | `-1003817368779` | `191` |
| YT Downloader dev notifications (no Agent Teams) | `-1003767190070` | `1701` |

### Per-Project Routing via task-meta.json
Before spawning Claude Code for YT Downloader dev work, **ALWAYS** write `task-meta.json`:
```bash
cat > /data/claude-code-results/task-meta.json << EOF
{"task_name":"YouTube Downloader Development","telegram_group":"-1003767190070","topic_id":"1701"}
EOF
```

The `notify-agi.sh` hook reads `task-meta.json` to override its default routing. **Never modify the hook default itself** — it is fixed at `-1003817368779:85` for Agent Teams.

### Key Rules
- Hook default (`-1003817368779:85`) is **sacred** — it serves Agent Teams and must never be changed
- Use `task-meta.json` for per-project routing overrides
- If `task-meta.json` is missing, hook falls back to default (Agent Teams topic)

## ⚠️ 注意事項 / 踩坑記錄

### 環境
- yt-dlp 路徑: `/home/linuxbrew/.linuxbrew/bin/yt-dlp`
- ffmpeg: `brew install ffmpeg`
- cloudflared: `/home/linuxbrew/.linuxbrew/bin/cloudflared`
- gog CLI: `/home/linuxbrew/.linuxbrew/bin/gog`

### cloudflared 權限問題
- Docker 容器內 `$HOME` 可能是 `/data`
- 需要手動 `mkdir -p /data/.cloudflared && chown $(whoami) /data/.cloudflared`
- `cloudflared tunnel login` 會寫 cert 到 `/data/.cloudflared/cert.pem`

### timingSafeEqual 長度不一致
- `crypto.timingSafeEqual` 要求兩個 Buffer 長度一致
- 如果 username 是 email 格式，跟預設 'admin' 長度不同會 crash
- **解決**: 先 SHA256 hash 再比較（hash 後長度一定是 32 bytes）

### Browser Autocomplete 污染
- Login 後 browser 會記住 username/password
- 其他頁面的 `<input>` 會被 autocomplete 填入 username
- **解決**: 加 `autocomplete="off" data-form-type="other"` 到所有非 auth input

### .env 不要 commit
- `.env` 存有密碼，確保 `.gitignore` 有包含
- 修改密碼透過 settings API 自動寫入 `.env`

## Checklist（開發時必看）
1. ✅ 每個 API endpoint 都要有 error handling
2. ✅ 下載前必須 probe 成功才能開始
3. ✅ 分類刪除時要檢查是否有進行中的下載
4. ✅ 前端 tab 切換時保持狀態（不清空輸入）
5. ✅ CSS 用 CSS variables 統一 cyber 色調
6. ✅ 所有大小用 human-readable 格式（MB/GB）
7. ✅ Auth middleware 要放在 static files middleware 之前
8. ✅ 所有非 auth input 加 `autocomplete="off"`
9. ✅ 密碼比較用 hash + timingSafeEqual（防 timing attack + 長度問題）
10. ✅ Forgot password 對不存在的 email 也返回 ok（防枚舉）
11. ✅ Default category（id='default'）前端用 `c.id === 'default'` 判斷，不要用 `c.isDefault`
12. ✅ Express 固定路由（如 `/reorder`）必須在參數路由（`/:id`）之前定義
13. ✅ 分類拖曳排序用 HTML5 原生 drag-and-drop，不需第三方庫
14. ✅ `gog` CLI `-j` 輸出有 wrapper（file/folder/files），必須 unwrap 再用
15. ✅ 分類下拉放在 url-section（probe 前可見），唔好放 probe-result 內
16. ✅ 暗色背景文字最低用 `#94a3b8`，`#475569` 太暗根本睇唔到
17. ✅ 字體大小用 CSS variable `--font-scale` + `calc()`，方便全局切換
18. ✅ 用戶偏好（字體大小等）存 `localStorage`，頁面載入 IIFE 立即套用（避免 FOUC）
19. ✅ Activity log 記錄所有關鍵操作，方便 debug 同追蹤
20. ✅ Date prefix toggle 預設開啟，用 `upload_date` 做 YYYYMMDD prefix
21. ✅ Toggle switch UI 用 CSS-only（input:checked + sibling selector），唔需要 JS toggle state
22. ✅ 字體大小 scaling 必須設在 `html`（root），唔係 `body`，因為 `rem` 係相對 `html`
23. ✅ Dropdown rebuild 前先 `prevValue = sel.value`，rebuild 後 restore（防 selection reset）
24. ✅ Fetch API 必須先 check `content-type: application/json` 再 `res.json()`，否則 HTML error page 會爆 SyntaxError
25. ✅ HTML duplicate `style` attribute：browser 只用第一個，第二個被忽略 — 合併成一個 style
26. ✅ Log timestamp 用獨立固定寬欄（`flex-shrink:0; width:108px`），唔放在 message 下方
27. ✅ Tab 新增只需：tab button + `id="tab-<name>"` content div（tab switching 係 generic）
28. ✅ `goToTab(name)` helper：`document.querySelector('.tab-btn[data-tab="name"]').click()`
29. ✅ Browser title 應只用 app 名，唔加 tagline（tab 空間有限）
30. ✅ `lib/setup.js` 的 `findBinary()` 用 `process.platform === 'win32'` 分 Windows/Unix 路徑
31. ✅ Windows 用 `where.exe`，Unix 用 `which` 做 PATH fallback 搜尋
32. ✅ Cloudflare Quick Tunnel 免帳號（`--url http://localhost:PORT`），適合本機測試
33. ✅ Token Tunnel 需 CF Zero Trust Dashboard，Token 以 `eyJ` 開頭
34. ✅ gog CLI（gogcli）係 Swift binary，macOS/Linux only，Windows 必須用 WSL2
35. ✅ Status badge UI：`.status-badge` + `.status-dot`（ok=green glow / warn=yellow / err=red / off=grey）
36. ✅ Settings tab 開啟時自動 refresh 狀態（tab click handler 入 `cfRefreshStatus()`/`gdRefreshStatus()`）
37. ✅ gog auth 用 spawn（非 execSync），前端 setInterval poll 輸出；180s 自動 timeout 防 loop
38. ✅ Windows .bat 啟動腳本：先殺舊 PID（data\server.pid），再 node server.js，再 start browser
39. ✅ `.env.example` 是 standalone 分發必備：含 Windows 工具路徑示例 + 每個 key 的說明
40. ✅ Guide tab 加 Windows 安裝章節：WSL2（推薦）+ 原生 Windows（限制說明）兩條路並列
41. ✅ `lib/settings.js` 管理 `data/settings.json`，readJSON 只接 filename（相對 data/），勿傳 absolute path
42. ✅ Telegram Group/Topic 從 hardcode 移至 `settings.json`，`getTelegramSettings()` 動態讀取
43. ✅ 設定面板 Panel 重排用 DOM IIFE：`container.appendChild(tg/gd/cf)` 依序 append 達到目標順序
44. ✅ Telegram 設定面板：toggle + Group ID + Topic ID + 儲存 + 測試訊息（test 直接用 input 值，不需先 save）
45. ✅ 分發打包排除 node_modules / .env / data / .git / openspec / .claude，僅 252KB
46. ✅ yt-dlp `--print "after_move:filepath"` 捕捉最終輸出路徑，比掃目錄可靠
47. ✅ 目錄掃描 fallback 用 `ctimeMs`（inode change time），唔用 `mtimeMs`（yt-dlp 會把 mtime 設成影片上傳日期）
48. ✅ 指南頁頂部有 inline SVG 用家流程圖（🗺️ 下載流程一覽）—— 給普通用家，唔係技術圖
49. ✅ 架構頁（workflow.jpg）係給開發者的技術流程圖；指南頁 SVG 係給用家的操作流程 — 兩者並存，定位不同
50. ✅ Inline SVG 設計模式：`viewBox + width="100%" + min-width + overflow-x:auto wrapper`，確保 responsive + 可縮放
51. ✅ 用 Claude Code 委派編碼任務時：exec tool 要用 `pty:true + background:true`，**唔好**在 command 末尾加 `&`（會令輸出丟失，只見 PID echo）
52. ✅ OpenClaw Cron `--session isolated` + `lightContext:true` 會繼承主 session Telegram channel → 用 `--session-key` 隔離
53. ✅ MiniMax-M2.1 不嚴格遵守「無 stdout 時輸出空」→ prompt 需明確 Rules 清單 + "your output must be empty (zero characters)"
54. ✅ `git subtree push --prefix=subdir remote branch` 可將 monorepo 子目錄發佈為獨立 repo
55. ✅ Linux server Node.js 安裝用 NodeSource（`curl setup script`）而非 Homebrew — 更可靠，適合 Ubuntu/Debian server
56. ✅ gog CLI Linux 安裝用 GitHub release binary（非 Homebrew）：`gogcli_VERSION_linux_{amd64|arm64}.tar.gz`，ARCH 偵測：`ARCH=$(uname -m); if [ "$ARCH" = "x86_64" ]; then ARCH_TAG="amd64"; else ARCH_TAG="arm64"; fi`
57. ✅ gog auth flow（headless server）：Web UI 呼叫 `spawn gog auth login`，前端 poll 輸出顯示 OAuth URL，用任何瀏覽器（包括手機）開 URL 授權，不需要 server 有 GUI
58. ✅ Cloudflare Token Tunnel 設定流程：one.dash.cloudflare.com → Networks → Tunnels → Create → Cloudflared → 取 `eyJ...` Token → Web UI 設定頁貼上 → Configure Public Hostname（domain + HTTP localhost:3847）
59. ✅ VPS 用家必須開放防火牆 TCP port 3847（或改用 Cloudflare Tunnel 繞過，唔需要開端口）
60. ✅ Windows winget Gyan.FFmpeg 安裝後路徑係 `%LOCALAPPDATA%\Microsoft\WinGet\Links\ffmpeg.exe`（唔係 Chocolatey 路徑），用 `where.exe ffmpeg` 查實際路徑
61. ✅ WSL2 Ubuntu 重啟後常見問題：視窗不自動彈出 → 按 Windows 鍵搜尋「Ubuntu」打開；安裝指南必須包含此後備指引
62. ✅ claude --print 比 claude_code_run.py wrapper 更可靠，wrapper 有時誤判 prompt 含特殊字符而轉成 interactive mode；直接用 `claude --print --permission-mode bypassPermissions --allowedTools "Bash,Read,Edit,Write"` 最穩定

## ⚠️ GitHub 推送安全規則（必記！2026-03-12）

### 每次推送前必須執行
```bash
bash /data/.openclaw/workspace_project/skills/github-push/scripts/security-scan.sh
```

### Pre-commit hook（已安裝）
- `.git/hooks/pre-commit` — 每次 commit 自動掃描
- 備份：`.githooks/pre-commit`（重新 clone 後執行 `bash .githooks/install.sh` 恢復）

### 禁止 commit 的檔案
| 檔案 | 原因 |
|------|------|
| `.env` | 含密碼 |
| `node_modules/` | npm 依賴（用 `npm install` 還原） |
| `data/activity-log.json` | 含 email 地址 |
| `data/downloads.json` | 個人下載歷史 |
| `data/settings.json` | Telegram Group ID |
| `data/cookies.txt` | YouTube session |
| `.claude/` | 內部 openspec tooling |

### 已曝露密碼的處理
1. **立即輪換 credential**（最重要！）
2. `git filter-repo --path .env --invert-paths --force`
3. `git push --force`

## Phase 17: Security Hardening + Major Feature Sprint（2026-03-15）

### 新增模組
- `lib/notifier.js` — Multi-channel notification engine (Telegram + Discord + Generic webhook)
- `lib/users.js` — Multi-user management (admin/user roles, per-user data isolation)

### 新增 API 端點（Phase 17）
```
# Downloads (enhanced)
GET    /api/downloads              # now supports ?q=, ?status=, ?from=, ?to=, ?category=, ?audioOnly=
GET    /api/downloads/stream       # SSE endpoint for real-time progress
GET    /api/downloads/export       # CSV export (?format=csv)
GET    /api/downloads/queue        # queue status {active, queued, maxConcurrent}
POST   /api/downloads/:id/retry    # retry a failed download
POST   /api/downloads/:id/cancel-schedule  # cancel a scheduled download

# Files (new)
GET    /api/files                  # list downloaded files with metadata
GET    /api/files/serve/:path      # serve file with Range support (video streaming)
DELETE /api/files/:path            # delete file from disk

# Settings (enhanced)
GET    /api/settings/notifications         # get notification channel configs (secrets masked)
POST   /api/settings/notifications         # save notification configs
POST   /api/settings/notifications/test    # test all enabled channels
GET    /api/settings/speed-limit           # get global speed limit
POST   /api/settings/speed-limit           # save speed limit
GET    /api/setup/ytdlp/version            # get yt-dlp version
POST   /api/setup/ytdlp/update             # trigger yt-dlp update (async)
GET    /api/setup/ytdlp/update-status      # poll update progress

# Users (new, admin only)
GET    /api/users                  # list users
POST   /api/users                  # create user
PUT    /api/users/:id              # update user (password/role)
DELETE /api/users/:id              # delete user

# Probe (enhanced)
POST   /api/probe/playlist         # probe playlist URL, returns up to 50 entries
```

### 架構變更
- **downloader.js**: All `gogExec()` (sync) → `gogExecAsync()` (Promise), `execFileSync` → `execFile`
- **downloader.js**: `_activeDownloads` Map + 5s periodic flush replaces per-tick JSON writes
- **downloader.js**: `_acquireSlot()`/`_releaseSlot()` concurrency queue (max 3)
- **downloader.js**: EventEmitter emits `update` events → server.js broadcasts via SSE
- **server.js**: `_sseClients` Map (max 10), `broadcastDownloads()` on emitter update
- **server.js**: `requireAdmin` middleware for user management routes
- **server.js**: Global `unhandledRejection` + `uncaughtException` handlers
- **server.js**: Graceful SIGTERM/SIGINT handler kills child processes + flushes state
- **storage.js**: JSON.parse wrapped in try/catch with defaultValue fallback
- **auth.js**: `verifyCode()` no longer returns plaintext password (returns `{success:true}`)
- **auth.js**: Command injection fixed — `execFileSync` with array args
- **auth.js**: `_writeEnv()` preserves existing .env vars
- **auth.js**: `login()` checks `users.json` first, falls back to env-var auth
- **setup.js**: fd leak fixed — `fs.closeSync(logFd)` after spawn
- **healthcheck.sh**: HTTP 200 check (was: only `000` connection-refused check)

### Checklist 新增項目（Phase 17）
63. ✅ 修復 command injection 必用 `execFile`/`execFileSync` with array args，唔用 string interpolation in `execSync`
64. ✅ `verifyCode()` 唔好返回明文密碼，改用密碼重置 flow 或 `{success:true}`
65. ✅ CORS 必須限制 origin（`ALLOWED_ORIGIN` env var 或 hardcode production URL），唔用 `cors()` 無限制
66. ✅ `_writeEnv()` 寫 .env 前先讀現有 lines，只更新/新增目標 keys，其他 lines 保留
67. ✅ Global `unhandledRejection` + `uncaughtException` handlers 必須喺 server.js 最頂加（唔 exit，只 log）
68. ✅ Graceful shutdown：SIGTERM/SIGINT → kill all child processes → flushToDisk() → close server → exit(0) after 5s
69. ✅ healthcheck.sh 用 `curl -w "%{http_code}"` 並 check `!= "200"`，唔係只 check 連接
70. ✅ GDrive upload 必須 async（`execFile` Promise-wrapped），唔用 `execFileSync`，否則 server 凍結
71. ✅ In-memory download state pattern：Map + 5s setInterval flush + 即時 flush on terminal state
72. ✅ SSE broadcast pattern：downloader EventEmitter → server listener → `_sseClients.forEach(res.write)` — cap at 10 clients
73. ✅ SSE client 必須設 keepalive（`setInterval` 30s `": keepalive\n\n"`）否則 Cloudflare/nginx 會 timeout 斷線
74. ✅ Audio-only download：`-x --audio-format ${format} --audio-quality 0`，跳過 video merge，唔需要 `-f` format selector
75. ✅ Playlist probe：`yt-dlp --flat-playlist -J`（注意大寫 J），返回 `entries[]` with id/title/duration/url
76. ✅ CSV export 加 UTF-8 BOM (`\uFEFF`) 讓 Excel 正確顯示中文
77. ✅ File serve with Range：check `req.headers.range`，有 range → 206 Partial Content，無 → `res.sendFile()`
78. ✅ File path validation 雙重保護：字符白名單 `[a-zA-Z0-9._\-/]` + `path.resolve().startsWith(allowedDir)`
79. ✅ Download scheduler：`_scheduledDownloads` Map + `setInterval(30s)` tick，server restart 時從 disk reload `status==="scheduled"` records
80. ✅ notifier.js 必須 fire-and-forget（唔 await，唔 throw），notification 失敗唔應 crash main flow
81. ✅ Discord webhook embed format：`{ embeds: [{ title, description, color: 3066993, timestamp }] }`
82. ✅ Generic webhook HMAC-SHA256 簽名：`crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex')`，放 `X-Signature` header
83. ✅ Multi-user migration：server startup 時 call `migrateFromEnv()`，自動將 env-var credentials 升級為 admin user（idempotent）
84. ✅ `requireAdmin` middleware：`if (!req.session?.role === 'admin') return res.status(403)`
85. ✅ Claude Code `--print` 輸出有時過早結束（只返回 summary）→ 加 `--output-format text` + `tee file` + `cat file` 確保完整輸出
