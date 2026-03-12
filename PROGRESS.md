# PROGRESS.md - YouTube Downloader Web App

## 開發日誌

### 2026-03-08 — 項目啟動 + 全部核心功能 + 安全部署

**Phase 0: 規劃** ✅
- [x] 建立 CLAUDE.md（項目架構、API 設計、技術決策）
- [x] 建立 TODO.md（任務拆分）
- [x] 安裝 yt-dlp + ffmpeg（via Homebrew）
- [x] 初始化 OpenSpec

**Phase 1: 基礎建設** ✅ (Claude Code Agent #1)
- [x] Task 1.1: Express server 骨架 (port 3847)
- [x] Task 1.2: Categories CRUD API (JSON storage)
- [x] Task 1.3: yt-dlp Probe 封裝（8 標準解析度 + 檔案大小估算）

**Phase 2: 下載核心** ✅ (Claude Code Agent #1)
- [x] Task 2.1: 下載引擎 + 進度追蹤（--progress --newline 解析）
- [x] Task 2.2: 下載狀態 API + 輸出路徑

**Phase 3: 前端 UI** ✅ (Claude Code Agent #2)
- [x] Task 3.1: Cyber/Futuristic HTML + CSS
  - Orbitron / Rajdhani / Share Tech Mono 字體
  - 霓虹色 accent（cyan/purple/pink）
  - Grid overlay + scanline + glitch 動畫
  - Custom scrollbar + backdrop blur modals
- [x] Task 3.2: 分類頁面（卡片列表、inline edit、確認 modal）
- [x] Task 3.3: 下載頁面（URL 分析、格式/畫質選擇、分類下拉）
- [x] Task 3.4: 管理頁面（進度條、status badges、auto-refresh）

**Phase 4: 整合 + 通知** ✅
- [x] Task 4.1: 下載完成 Telegram 通知（成功/失敗都通知）
- [x] Task 4.2: Google Drive 整合（via gog CLI）
  - 自動建立 "Youtube Downloader" 根資料夾
  - 按分類建子目錄
  - 下載完成自動上傳 Drive
  - 已完成清單顯示 Drive 連結

**Phase 5: 安全 + 部署** ✅ (主 session — WALL-E)
- [x] Task 5.1: Cloudflare Tunnel 部署
  - `cloudflared tunnel create yt-downloader`
  - DNS: `yt.ac02nwt.work` → localhost:3847 (QUIC)
  - `start.sh` PID 管理腳本
- [x] Task 5.2: 登入認證系統
  - `lib/auth.js` — session store + timingSafeEqual (SHA256 hash)
  - `login.html` — Cyber 風格（浮動粒子、glow、密碼顯隱切換）
  - Auth middleware（攔截所有路由）
  - Cookie: HttpOnly + Secure + SameSite=strict, 24h TTL
- [x] Task 5.3: 帳號管理（設定頁）
  - 修改 username/password（需驗證當前密碼）
  - 自動寫入 `.env` + 清除 session
  - 登出按鈕
- [x] Task 5.4: 忘記密碼
  - Email verification code（6 位，10 分鐘過期，5 次嘗試上限）
  - 透過 `gog gmail send` 發送
  - 驗證成功顯示密碼 + 複製按鈕
- [x] Task 5.5: Autocomplete 修復
  - 分類 input 加 `autocomplete="off" data-form-type="other"`

## 技術 Stack
- Backend: Express.js + yt-dlp + ffmpeg + dotenv + cookie-parser
- Frontend: SPA (HTML/CSS/JS inline) + login.html
- Auth: Cookie-based session (lib/auth.js)
- Storage: JSON files (categories.json, downloads.json)
- Network: Cloudflare Tunnel (yt.ac02nwt.work → localhost:3847)
- Email: gog CLI (gmail send)
- Port: 3847

## 已驗證
- Probe: Rick Astley 影片成功返回 8 個解析度 + 檔案大小
- Download: 144p 測試下載成功（~4 秒）
- Categories: CRUD 全部 endpoint 通過
- Auth: 登入/登出/session 過期/401 保護全通過
- Cloudflare Tunnel: HTTPS 訪問正常（HTTP/2 200）
- Forgot password: 驗證碼成功發送到 email + 驗證 + 返回密碼
- Account update: 修改密碼後自動清 session + 寫入 .env

### 2026-03-08 — Bug Fix + 分類增強（WALL-E 主 session）

**Bug Fix: 未分類刪除/編輯無效**
- [x] Root cause: `c.isDefault`（undefined）→ 改為 `c.id === 'default'`
- [x] 前端隱藏 default 分類的編輯/刪除按鈕
- [x] 前端 guard + 中文 error toast（雙重保護）

**新功能: 分類拖曳排序**
- [x] 後端 `PUT /api/categories/reorder` + `lib/categories.js reorder(ids)`
- [x] 前端 HTML5 原生 drag-and-drop（drag handle ⠿）
- [x] 即時 re-render + API 持久化
- [x] Cyber 風格視覺反饋（dragging 半透明 + drag-over cyan glow）

**Bug Fix: Google Drive 上傳「失敗」（實際成功但 response 解析錯）**
- [x] Root cause: `gog drive upload -j` 返回 `{file:{...}}`，code 直接讀 `parsed.id` → undefined
- [x] 同理 `gog drive mkdir -j` 返回 `{folder:{...}}`
- [x] 修正：加 `.file || parsed` / `.folder || result` unwrap

**改善: 分類下拉移到 URL 輸入列**
- [x] `<select id="dl-category">` 從 `probe-result` 移到 `url-section`
- [x] 頁面載入即 populate（唔使等 tab 切換）
- [x] 「未分類」輸出路徑唔顯示子目錄名

## 踩坑記錄
1. **cloudflared 權限**: Docker 內 `$HOME=/data`，需手動建 `/data/.cloudflared/` 並 chown
2. **timingSafeEqual 長度**: email vs 'admin' 長度不同 → 先 SHA256 hash 再比較
3. **Autocomplete 污染**: Login 後 browser 填 username 到分類 input → `autocomplete="off" data-form-type="other"`
4. **前後端 field name 不一致**: `c.isDefault` vs `c.id === 'default'` — 用已有的 unique id 判斷更可靠
5. **Express 路由優先級**: 固定路由（`/reorder`）必須定義在參數路由（`/:id`）之前
6. **gog CLI JSON wrapper**: `upload` → `{file:{...}}`、`mkdir` → `{folder:{...}}`，直接讀 `parsed.id` 會得到 `undefined`
7. **UI scope 錯誤**: 分類下拉放 `probe-result` 內 → probe 前不可見，應放 `url-section`
8. **暗色主題文字亮度**: `#475569` 在 `#0a0a0f` 背景下幾乎不可見，dim text 最低用 `#94a3b8`
9. **CSS Variable Font Scaling**: `calc(base * var(--font-scale))` + `rem` 自動跟隨，比 media query 更靈活
10. **Activity Log FIFO**: JSON file max 500 條 + cursor-based pagination（`before` timestamp）比 offset 穩定

---

## Phase 6: 活動日誌 + UI 增強

### 2026-03-08 — Activity Log 系統 ✅

**`lib/logger.js`**：
- JSON 存儲（`data/activity-log.json`），FIFO max 500 條
- 6 分類（download/upload/probe/auth/category/system）× 4 等級（info/success/warn/error）
- API: `GET /api/logs`（filter + pagination）、`GET /api/logs/stats`、`DELETE /api/logs`

**downloader.js logging**：probe 成功/失敗、下載開始/完成/失敗、Google Drive 上傳開始/成功/失敗

**前端 LOG Tab**：Stats chips + filter dropdowns + expandable detail cards + pagination

### 2026-03-08 — 文字亮度 + 字體大小設定 ✅

**文字亮度提升**：
- `--text-primary`: `#e2e8f0` → `#f1f5f9`
- `--text-secondary`: `#94a3b8` → `#cbd5e1`
- `--text-dim`: `#475569` → `#94a3b8`

**字體大小設定**（設定頁 → 顯示設定）：
- CSS variable `--font-scale` + `calc(16px * var(--font-scale))`
- 三個 preset：中（1x）、大（1.2x）、特大（1.4x）
- `localStorage` 持久化 + IIFE 即時套用

---

## Phase 7: 下載增強

### 2026-03-08 — 檔名日期前綴（Date Prefix）✅

**功能**：下載時可選擇在檔名前加 YouTube 影片上傳日期（YYYYMMDD-）

**後端改動**：
1. `lib/downloader.js` — `parseVideoInfo()` 新增返回 `uploadDate`（yt-dlp 的 `info.upload_date`）
2. `lib/downloader.js` — `startDownload()` 接受 `datePrefix` 參數，有值時 output template 改為 `YYYYMMDD-%(title)s.%(ext)s`
3. `server.js` — 傳遞 `datePrefix` 到 downloader

**前端改動**：
1. CSS-only toggle switch 組件（`.toggle-switch` + `.toggle-slider`）
2. Probe result 頁面加 `.date-prefix-row`（toggle + 日期預覽）
3. `probeUrl()` 有 `uploadDate` 時顯示 toggle，冇就隱藏
4. `startDownload()` 讀 toggle 狀態，checked + 有 uploadDate → 傳 `datePrefix`

**CSS Toggle Switch 設計模式**：
```css
.toggle-switch input { opacity:0; width:0; height:0; }
.toggle-switch input:checked + .toggle-slider {
  background: var(--cyan-dim);
  border-color: var(--cyan);
}
.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(18px);
  background: var(--cyan);
}
```

**yt-dlp upload_date**：YYYYMMDD 字串，大部分 YouTube 影片都有

---

## Phase 8: UI 修正 + 體驗優化

### 2026-03-08 — 分類下拉佈局 + font scaling + probe 修正 ✅

**分類下拉佈局修正**：
- HTML 對調順序：select 移到 URL input 左邊
- `select { width:130px; flex-shrink:0 }` 固定窄寬；`input { flex:1 }` 保持拉伸

**字體大小全域 scaling 修正**：
- 根本原因：`rem` 單位相對 `html` root，但 `font-size` 設在 `body` → `rem` 元素不受影響
- 修正：`html { font-size: calc(16px * var(--font-scale)); }` + `body { font-size: 1rem; }`
- 效果：設定字體大小後，全部 tab（分類/下載/管理/日誌）同步放大

**Probe 後保留分類選擇**：
- 問題：`probeUrl()` 呼叫 `loadCategorySelect()` rebuild dropdown → selection reset
- 修正：`const prevValue = sel.value` → rebuild → `sel.value = prevValue`（若選項仍存在）

**格式按鈕 UX 說明**：
- MP4/MKV/MOV = container only（`--remux-video` 不重新編碼），大小不變
- 加說明文字：`// 封裝格式只改變容器，不重新編碼，預計大小不受影響`
- 畫質 header 加「（串流大小估算）」

### 2026-03-08 — Telegram / Log 修正 ✅

**Telegram 通知群組更新**：
- `TG_GROUP = '-1003817368779'`，`TG_TOPIC = '191'`

**日誌「載入更多」HTML error 修正**：
- 根本原因一：`log-load-more-wrap` 有重複 `style` attribute，第二個 `display:none` 被忽略
- 根本原因二：`fetchLogs` 直接 `res.json()` 無先 check content-type
- 修正：加 content-type 驗證、`credentials:'include'`、`res.status === 401` redirect、array check

**日誌 Timestamp 移到獨立欄位**：
- 從 `.log-meta`（`.log-body` 內，訊息下方）移到同層獨立 `.log-time` div
- `width:108px; text-align:right; flex-shrink:0`
- 佈局：`[dot] [message ——] [MM/DD HH:MM:SS] [badge]`

### 2026-03-08 — 新 Tab + 頁面文案 ✅

**架構 Tab**：
- 新增靜態圖片 Tab 顯示 workflow infographic（`/workflow.jpg`）
- Tab switching 係 generic（`'tab-' + btn.dataset.tab`），新 tab 自動支援

**指南 Tab**：
- `goToTab(name)` helper：`document.querySelector('.tab-btn[data-tab="name"]').click()`
- Anchor nav + `scroll-margin-top:80px`（防 sticky header 遮蓋）
- `.guide-section`, `.guide-steps li`, `.guide-tip`, `.guide-warn`, `.guide-badge` CSS 組件
- 8 個 section + FAQ，每個 section 有「前往 Tab」按鈕

**Browser Title + Subtitle**：
- `<title>YT DOWNLOADER</title>`（index.html + login.html）
- 副標題：`// Powered by Wilson NG`

---

## Phase 9: Standalone Setup + Windows 支援

### 2026-03-08 — Cloudflare + Google Drive 設定面板 ✅

**目標**：讓 app 可以在本機電腦（非 VPS）獨立運行，提供 Web UI 設定 Cloudflare Tunnel 和 Google Drive。

**新增 `lib/setup.js`**：
- `findBinary(name)` — 跨平台 binary 偵測（IS_WINDOWS 分支；Windows 搜尋 winget links/scoop/chocolatey，Unix 搜尋 brew/usr/bin）
- `getCloudflaredStatus()` — 偵測 cloudflared 安裝、讀 `data/tunnel.pid` 用 `process.kill(pid, 0)` 確認存活、返回最近 8 行日誌
- `startTunnel(mode, options)` — Quick（`--url localhost:PORT`）或 Token（`run --token`）模式；detached spawn + PID file
- `stopTunnel()` — SIGTERM + cleanup
- `getGdriveStatus()` — `gog drive ls --max 1 -j` 測試認證；timeout 12s
- `startGdriveAuth() / getAuthPoll()` — spawn `gog auth login`，stdout/stderr 存 `_authOutput`，前端 setInterval poll

**server.js 新增 6 個 `/api/setup/*` 路由**

**Settings Tab 兩個新 Panel**：
- `// CLOUDFLARE TUNNEL`：status badge + Quick/Token 模式 radio + token input（password 類型）+ port + Tunnel 日誌 + 安裝指引（Windows winget 優先）
- `// GOOGLE DRIVE`：status badge + 一鍵授權 + auth output log（gd-auth-log）+ 安裝指引（Windows WSL2 警告框）

**CSS 新組件**：
- `.status-badge.ok/.warn/.err/.off` — pill 形狀，各色邊框 + 背景
- `.status-dot.green/.yellow/.red/.grey` — 8px 圓點，green 有 glow
- `.setup-section` — divider 分隔區塊
- `.setup-log` — monospace 日誌框，max-height 130px + overflow scroll
- `.cf-mode-card` — clickable radio label card，hover cyan glow

**踩坑：gog CLI Windows 限制**
- `steipete/gogcli` 係 Swift binary，macOS/Linux only，Windows 原生環境完全無法運行
- Windows 只能用 WSL2 取得完整功能（包括 Google Drive 上傳）

---

### 2026-03-08 — Windows Standalone 支援 ✅

**設定頁 + 指南頁 Windows 內容**：
- Cloudflare install 框：Windows `winget install Cloudflare.cloudflared` 優先顯示
- Google Drive install 框：黃色警告框說明 gog 不支援 Windows，推薦 WSL2

**指南頁新章節：`🪟 Windows 安裝指南`**：
- 方式 A（WSL2，強烈推薦）：`wsl --install` → Ubuntu → Homebrew → brew install 一行搞掂所有依賴 → `bash start.sh`
- 方式 B（原生 Windows）：winget 安裝 4 工具 + .env 工具路徑配置 + `start.bat` 啟動

**Cloudflare 章節更新**：加 Windows winget install 為第一步驟

**Google Drive 章節更新**：加黃色 Windows 警告框 + 明確說明 macOS/Linux/WSL2 才可用

**新增文件**：
- `.env.example` — 配置範本，含 YT_DLP_PATH / FFMPEG_PATH Windows 示例
- `start.bat` — Windows 啟動：自動 npm install → node server.js → start browser；讀寫 data\server.pid
- `stop.bat` — Windows 停止：taskkill by PID

**`lib/setup.js` findBinary() Windows 路徑清單**：
- winget links: `%LOCALAPPDATA%\Microsoft\WinGet\Links\`
- scoop shims: `%USERPROFILE%\scoop\shims\`
- chocolatey: `C:\ProgramData\chocolatey\bin\`
- cloudflared 安裝目錄: `C:\Program Files\Cloudflare cloudflared\`
- fallback: `where.exe` 搜尋 PATH

## 技術 Stack 更新
- Phase 9 新增: `lib/setup.js`（跨平台 setup module）
- Windows 啟動: `start.bat` / `stop.bat`
- 配置: `.env.example`（含 Windows 工具路徑說明）

---

## Phase 10: Telegram 設定 UI + 分發打包

### 2026-03-08 — Telegram 通知搬到 Web UI 設定頁 ✅

**背景**：Telegram 的 Group ID 和 Topic ID 原本 hardcode 在 `lib/downloader.js`，每次修改需要重啟 server。現改為透過 Web UI 設定並持久化。

**新增 `lib/settings.js`**：
- 管理 `data/settings.json`
- DEFAULTS 包含 Telegram 預設值（`-1003817368779` / `191`）
- `loadSettings()` 做 deep merge（確保新欄位有 fallback）
- **⚠️ 陷阱**：`readJSON()` 只接 filename（相對 `data/`），勿傳 absolute path

**`downloader.js` 改動**：
- 移除 `const TG_GROUP / TG_TOPIC`
- 改為 `const tg = appSettings.getTelegramSettings()`
- `if (!tg.enabled || !tg.groupId) return;`（尊重用戶設定）

**新 API endpoints**：
```
GET  /api/settings/telegram        # 讀取設定
POST /api/settings/telegram        # 儲存設定
POST /api/settings/telegram/test   # 即時測試（直接用 body 值）
```

**設定頁新面板**：CSS-only toggle + Group/Topic inputs + 儲存/測試按鈕 + Info box

### 2026-03-08 — 設定頁面板重新排列 ✅

**舊問題**：
- 「設定」面板混合了 Cookies + 帳號（兩件完全不同的事）
- Cloudflare Tunnel 在 Google Drive 前（功能複雜度較高應放後）
- Telegram 面板排在最後（但邏輯上比 Drive/CF 更常用）

**新排列**（個人 → 下載 → 通知 → 儲存 → 網絡）：
`帳號與安全 → 顯示偏好 → YouTube Cookies → Telegram 通知 → Google Drive → Cloudflare Tunnel`

**實現方式**：各 panel 加 `id`，用 DOM IIFE 重排（唔改 HTML 邏輯順序）：
```javascript
(function() {
  var c = document.getElementById('tab-settings');
  c.appendChild(document.getElementById('panel-telegram'));  // TG 先
  c.appendChild(document.getElementById('panel-gdrive'));    // GD 其次
  c.appendChild(document.getElementById('panel-cloudflare')); // CF 最後
})();
```

**邏輯**：`appendChild` 先移除後 append。初始 [CF, GD, TG] → append TG → [CF, GD, TG] → append GD → [CF, TG, GD] → append CF → [TG, GD, CF] ✅

### 2026-03-08 — 分發打包 ✅

- `README.md` 新增，包含完整安裝說明、系統需求、各功能說明
- `.env.example` 更新：Telegram 設定說明改為「已移至 Web UI」
- `youtube-downloader.tar.gz` 生成（252KB）：
  - 排除：`node_modules/`、`.env`、`data/`、`.git/`、`openspec/`、`.claude/`
  - 含：全部 source code + README + .env.example + start.sh / start.bat

### 踩坑（Phase 10）

1. **storage.js readJSON filename**：只接相對名稱（如 `'settings.json'`），傳 absolute path 會組合成錯誤路徑
2. **502 Bad Gateway**：測試時啟動了多個 server process，exec SIGTERM 把正式 server 也殺掉；重跑 `bash start.sh` 即可
3. **DOM IIFE 重排直覺錯誤**：要實現 TG→GD→CF，需要按此序 append（而非按「目標順序」反向 append）

---

## Phase 11: Bug Fixes（2026-03-08）

### Bug: Date Prefix 不生效（yt-dlp mtime 陷阱）✅

**現象**：UI 顯示 prefix toggle 已開啟（如 `20260302-filename.mp4`），但 Google Drive 收到的文件冇 prefix。

**Debug 方法**：
1. 加臨時 `console.log` 確認 server 收到 `datePrefix: "20260302"` ✅
2. 確認 `outputTemplate` 含 prefix ✅
3. 但 `Uploaded to Google Drive: 当华尔街...mp4`（冇 prefix）→ 問題在「找文件」那步

**Root Cause**：
- yt-dlp 預設設文件 **mtime = 影片上傳日期**（本例 = 2026-03-02）
- 舊代碼：`files.sort((a,b) => b.stat.mtimeMs - a.stat.mtimeMs)[0]`
- 結果：新下載 `20260302-title.mp4`（mtime = 2026-03-02 = 過去）比舊文件 `title.mp4`（mtime = 今日）更舊 → 排序後排在後面 → 上傳了錯誤文件

**Fix**：
```javascript
// 1. yt-dlp args 加 --print after_move:filepath
args.push('--print', 'after_move:filepath');

// 2. stdout: 捕捉 yt-dlp 輸出的 absolute path
if (trimmed.startsWith('/') && !trimmed.startsWith('[')) {
  capturedFilePath = trimmed;
}

// 3. close: 優先用 capturedFilePath，fallback 用 ctimeMs
if (capturedFilePath && fs.existsSync(capturedFilePath)) {
  downloadedFile = capturedFilePath;
} else {
  files.sort((a, b) => b.stat.ctimeMs - a.stat.ctimeMs);
  downloadedFile = files[0]?.path ?? null;
}
```

**關鍵教訓**：
- yt-dlp（及許多 downloader）會修改文件 mtime → **永遠唔好用 mtime 判斷「最新下載文件」**
- `--print "after_move:filepath"` 係 yt-dlp 標準做法，可靠且跨平台
- `ctimeMs`（inode change time）比 `mtimeMs` 更難被外部修改，是 fallback 首選

### 待辦
- [ ] 測試確認 prefix 正常後，移除 `[DEBUG]` console.log（server.js + downloader.js）

---

## Phase 12: SVG 用家流程圖（2026-03-10）

### 2026-03-10 — 指南頁 Inline SVG 下載流程圖 ✅

**背景**：
- 架構頁（`workflow.jpg`）係 2026-03-08 加入，目標讀者係開發者，展示整個系統技術架構
- 今日新增：給**普通用家**看的操作流程 SVG，插入指南頁最頂（Quick Nav 後、Quick Start 前）

**位置**：`public/index.html` → `#tab-guide` → `#guide-quickstart` 之前

**內容（5 步水平流程）**：
1. 📋 貼上 URL — 複製 YouTube 連結，貼入輸入框
2. 🔍 分析影片 — 點擊「分析」，獲取片名和畫質選項
3. ⚙️ 選擇設定 — 選畫質、格式、分類
4. ⬇️ 開始下載 — 點擊下載，自動完成
5. ✅ 完成 — 本地儲存（+ 下方兩個虛線分支：📂 GDrive 自動上傳 + 📲 Telegram 自動通知）

**設計細節**：
- `viewBox="0 0 900 220"`，`width="100%"`，`min-width:700px`，`overflow-x:auto` 包裝
- 暗色主題：步驟 1-4 cyan 邊框（`#00f0ff`），步驟 5 綠色邊框（`#4ade80`）
- GDrive + Telegram 子節點：虛線框（`stroke-dasharray`）+ 淡色文字（可選步驟）
- 實線箭頭（→）連接必要步驟，虛線連接可選分支

**經驗教訓（Claude Code 委派技巧）**：
- ❌ 錯誤做法：`exec command:"claude ... 2>&1 &"` — shell 即時退出，只見 PID echo，output 全丟
- ✅ 正確做法：`exec pty:true background:true command:"claude ..."` — exec tool 管理 session，可 `process log` 追蹤
- `--dangerously-skip-permissions` 旗標等同 `--full-auto`，適合自動化任務（無需手動 approve）

---

### 2026-03-12 — Process 監控 + Auto-restart + Git 清理

**Phase 13: Healthcheck Cron** ✅

**問題**：Container restart 後 server 同 tunnel 都掛咗，`yt.ac02nwt.work` 顯示 Cloudflare 1033 Error，需要手動執行 `start.sh` 重啟。

**解決方案：`healthcheck.sh` + OpenClaw Cron**
- [x] `youtube-downloader/healthcheck.sh` — 三重檢查（server PID + HTTP 200 + tunnel PID），任一掛咗自動跑 `start.sh`
- [x] OK 路徑靜音（只寫 log），重啟路徑推 Telegram 通知
- [x] OpenClaw cron 每 10 分鐘執行（ID: `5fb3af45-3460-4c46-967c-90267e4a872a`）
- [x] Model: `minimax-portal/MiniMax-M2.1`（輕量，`--light-context --session isolated`）
- [x] Telegram 通知目標：group `-1003817368779`, topic `191`

**OpenClaw Cron Telegram Forum Topic routing 格式（學到嘅新知識）**：
- 格式：`--to "chatId:topic:topicId"` + `--channel telegram --announce`
- 例子：`--to "-1003817368779:topic:191"`
- 內部用 `buildTelegramGroupPeerId(chatId, threadId)` = `"chatId:topic:threadId"`
- cron announce 靜音：model 無 stdout output → deliver nothing

**Phase 13: Git 清理** ✅
- 發現 `data/cookies.txt`（含 YouTube session cookies）已被 git track 並提交到 history
- [x] 加 `.gitignore`（排除 cookies.txt, *.pid, *.log）
- [x] `git rm --cached` 移走 HEAD 追蹤
- [x] `git filter-repo` 清除 history 中所有 cookies.txt 記錄（Option 2）
- [x] Force-push clean history

---

### 2026-03-12 — Phase 14: Guide Split + GitHub Repo + Install Rewrite + Cron Routing Fix

**Guide Split: Install Tab + Usage Tab** ✅
- [x] Split single "指南" tab into two: "安裝"（install）+ "指南"（usage guide）
- [x] Created `tab-install` with 3 platform sub-tabs: OpenClaw / Linux / Windows (Standalone)
- [x] Added `switchInstallTab()` JS function for sub-tab switching
- [x] Moved Cloudflare, Google Drive, Telegram sections from usage guide to install guide

**GitHub Standalone Repo** ✅
- [x] Created public GitHub repo: https://github.com/tele02nwt/youtube-downloader
- [x] Used `git subtree push --prefix=youtube-downloader yt-downloader master` to publish subdirectory
- [x] Added git remote: `git remote add yt-downloader https://TOKEN@github.com/tele02nwt/youtube-downloader.git`

**Install Guide Rewrite (All 3 Platforms)** ✅
- [x] **OpenClaw tab**: Teaches users to tell OpenClaw to clone from GitHub; 6 detailed steps including CF/GDrive/Telegram setup; each optional feature has 6-7 sub-steps with exact UI navigation; troubleshooting section with 4 common issues
- [x] **Linux tab**: Uses NodeSource for Node.js (NOT Homebrew — more reliable on servers); apt for ffmpeg/yt-dlp/cloudflared
- [x] **Windows WSL2**: 9 detailed steps; uses NodeSource inside Ubuntu
- [x] **Windows Native**: 8 steps; nodejs.org installer + winget for tools + notepad for .env
- [x] All install guides reference GitHub repo: https://github.com/tele02nwt/youtube-downloader

**Cron Routing Fix** ✅
- [x] **Problem**: healthcheck cron isolated session routing model output to BOTH delivery.to (`-1003817368779:topic:191`) AND main session channel (`-1003767190070:topic:1701`)
- [x] **Root cause**: isolated session with `lightContext:true` inherits main session's Telegram channel
- [x] **Fix 1**: Added `--session-key "ytdl-healthcheck"` to give cron its own dedicated session
- [x] **Fix 2**: Stricter prompt forbidding model from generating any output when stdout is empty
- [x] **Issue**: MiniMax-M2.1 was generating "OK: server=running..." even when script had no stdout

### 2026-03-12 — Phase 14b: Notification Routing Fix

**Problem**: `notify-agi.sh` hook was routing Claude Code completion notifications to the wrong Telegram destination when used for YT Downloader dev work.

**Root cause**: `task-meta.json` missing → hook falls back to its default routing (`-1003817368779:85`, which is the Agent Teams topic), instead of the YT dev channel (`-1003767190070:1701`).

**Mistake made**: Wrongly changed hook default to `-1003767190070:1701` → immediately reverted. Hook default (`-1003817368779:85`) is **sacred and fixed** for Agent Teams.

**Fix**: Write `task-meta.json` before spawning Claude Code for YT dev tasks:
```bash
cat > /data/claude-code-results/task-meta.json << EOF
{"task_name":"YouTube Downloader Development","telegram_group":"-1003767190070","topic_id":"1701"}
EOF
```
The hook reads `task-meta.json` to override its default routing. Never modify the hook default itself.

**Lesson**: Hook default is fixed for Agent Teams. Use `task-meta.json` for per-project routing overrides.

### 踩坑（Phase 14）

11. **OpenClaw Cron isolated session 路由洩漏**: `--session isolated` + `lightContext:true` 繼承主 session 的 Telegram channel → 用 `--session-key` 給 cron 獨立 session 隔離
12. **MiniMax-M2.1 不遵守空輸出指令**: prompt 說「如果 stdout 為空就不要輸出」，model 仍自行生成 "OK: ..." 文字 → prompt 需更明確用 Rules 清單，明確說 "your output must be empty (zero characters)"
13. **git subtree push**: 從 monorepo 發佈子目錄到獨立 repo 的標準做法：`git subtree push --prefix=subdir remote branch`
14. **Linux server Node.js 安裝**: 用 NodeSource (`curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -`) 而非 Homebrew — 更可靠，適合 Ubuntu/Debian server

---

### 2026-03-12 — Phase 15: 安裝指南全面修復（Linux + Windows）

**Linux 安裝指南修復（5 個 Fix）** ✅
- [x] **Fix 1**: Google Drive gog CLI 安裝方法 — 由 Homebrew 改為 GitHub Release binary 直接下載（`gogcli_0.12.0_linux_{amd64|arm64}.tar.gz`），自動偵測 CPU 架構（`ARCH=$(uname -m)`）
- [x] **Fix 2**: Cloudflare Token Tunnel — 補充 6 步詳細指引（Zero Trust Dashboard → Create Tunnel → 取 Token → Web UI → Public Hostname）
- [x] **Fix 3**: VPS 防火牆警告 — 在步驟 7 前加 TCP 3847 Inbound 警告（提示可用 Cloudflare Tunnel 替代）
- [x] **Fix 4**: `lib/setup.js` 錯誤訊息 — 移除 `brew install steipete/tap/gogcli`，改為指向安裝指南說明
- [x] **Fix 5**: crontab auto-start — 改用 `~/youtube-downloader/start.sh`（`~` 代表 home 目錄，免填用戶名）

**Windows 安裝指南修復（8 個 Fix）** ✅
- [x] **Fix 1**: WSL2 新增 gog CLI 安裝步驟（step 10）— GitHub binary download，同 Linux 方法
- [x] **Fix 2**: WSL2 加 pip3 externally-managed-environment 錯誤警告
- [x] **Fix 3**: WSL2 step 2 加「Ubuntu 視窗沒有自動彈出」後備指引（搜尋 Ubuntu 圖示打開）
- [x] **Fix 4**: WSL2 新增 Cloudflare Tunnel 完整步驟（Quick Tunnel + Token Tunnel）
- [x] **Fix 5**: Method B 前加 winget 未預裝警告（App Installer + Microsoft Store）
- [x] **Fix 6**: Method B 新增 Cloudflare Tunnel 完整步驟（同 WSL2）
- [x] **Fix 7**: ffmpeg PATH 範例由 Chocolatey 改為 winget Gyan.FFmpeg 正確路徑 + `where.exe` 查詢提示
- [x] **Fix 8**: 新增 WSL2 開機自動啟動章節（`crontab @reboot bash ~/youtube-downloader/start.sh`）

**三平台全面審查** ✅
- OpenClaw: 6 步流程 + 可選功能 + 疑難排解，結構清晰，無問題
- Linux: 8 步必要 + 3 個可選步驟（Cloudflare/GDrive/Telegram）+ 自動啟動，修復後完整
- Windows: WSL2 10 步（含 gog）+ Cloudflare；Method B 8 步（無 GDrive）+ Cloudflare；修復後完整

### 踩坑 / 學到的嘢（Phase 15）

15. **gog CLI Linux 安裝**: GitHub Release 有 pre-built binary（`gogcli_linux_amd64.tar.gz`），無需 Homebrew。ARCH 偵測：`ARCH=$(uname -m); if [ "$ARCH" = "x86_64" ]; then ARCH_TAG="amd64"; else ARCH_TAG="arm64"; fi`
16. **claude --print 比 claude_code_run.py 更可靠**: wrapper 有時誤判 interactive mode（prompt 含特殊字符）→ 直接用 `/data/.npm-global/bin/claude --print --permission-mode bypassPermissions` 更穩定
17. **Windows ffmpeg winget 路徑**: winget Gyan.FFmpeg 安裝後路徑係 `%LOCALAPPDATA%\Microsoft\WinGet\Links\ffmpeg.exe`（唔係 Chocolatey 的 `C:\ProgramData\chocolatey\bin\ffmpeg.exe`）；用 `where.exe ffmpeg` 查實際路徑
18. **WSL2 Ubuntu 不自動彈出**: 常見問題，需後備指引（Windows 鍵搜尋「Ubuntu」打開），新用家幾乎必定遇到
