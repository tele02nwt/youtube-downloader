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

## 踩坑記錄
1. **cloudflared 權限**: Docker 內 `$HOME=/data`，需手動建 `/data/.cloudflared/` 並 chown
2. **timingSafeEqual 長度**: email vs 'admin' 長度不同 → 先 SHA256 hash 再比較
3. **Autocomplete 污染**: Login 後 browser 填 username 到分類 input → `autocomplete="off" data-form-type="other"`
4. **前後端 field name 不一致**: `c.isDefault` vs `c.id === 'default'` — 用已有的 unique id 判斷更可靠
5. **Express 路由優先級**: 固定路由（`/reorder`）必須定義在參數路由（`/:id`）之前
