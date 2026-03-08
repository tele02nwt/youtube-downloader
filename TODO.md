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

---

## 未來可能新增
- [ ] Playlist 批量下載
- [ ] 純音頻模式（MP3/AAC）
- [ ] 排程下載
- [ ] 下載歷史搜尋/篩選
- [ ] 手機響應式優化
- [ ] Cloudflare Access（SSO 保護）
- [ ] 多用戶支援
