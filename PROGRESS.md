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
