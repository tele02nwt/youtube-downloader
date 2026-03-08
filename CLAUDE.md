# YouTube Downloader Web App

## 項目概述
一個本地 YouTube 下載器 Web App，提供 Cyber/Futuristic 風格 UI，支援影片下載、分類管理、進度追蹤、Google Drive 自動上傳。透過 Cloudflare Tunnel 對外提供 HTTPS 訪問，帶有完整的登入認證系統。

## 技術棧
- **後端**: Node.js (Express) — REST API server
- **前端**: 單頁應用 (SPA)，純 HTML/CSS/JS，Cyber/Futuristic 風格
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
├── TODO.md             # 任務清單
├── PROGRESS.md         # 進度記錄
├── start.sh            # 啟動腳本（server + Cloudflare Tunnel）
├── .env                # 認證憑證（不 commit）
├── package.json
├── server.js           # Express server 入口
├── public/
│   ├── index.html      # SPA 主頁（分類/下載/管理/設定 4 個 tab）
│   └── login.html      # 登入頁（含忘記密碼流程）
├── lib/
│   ├── auth.js         # 認證模組（session, verification code, email）
│   ├── downloader.js   # yt-dlp 封裝（格式偵測、下載、進度）
│   ├── categories.js   # 分類 CRUD
│   └── storage.js      # JSON 持久化
└── data/
    ├── categories.json # 分類數據
    ├── downloads.json  # 下載記錄
    ├── cookies.txt     # YouTube cookies（可選）
    ├── server.log      # Server 日誌
    ├── tunnel.log      # Tunnel 日誌
    ├── server.pid      # Server PID
    └── tunnel.pid      # Tunnel PID
```

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
GET    /api/categories          # 列出所有分類
POST   /api/categories          # 新增分類
PUT    /api/categories/:id      # 修改分類
DELETE /api/categories/:id      # 刪除分類

# Downloads
POST   /api/download/probe      # 探測 URL（返回標題、可用畫質、估算大小）
POST   /api/download/start      # 開始下載
GET    /api/download/status/:id # 查詢下載進度
GET    /api/downloads           # 列出所有下載記錄
DELETE /api/downloads/:id       # 刪除記錄

# Cookies
GET    /api/cookies/status      # Cookie 狀態
POST   /api/cookies/upload      # 上傳 cookies.txt
DELETE /api/cookies              # 清除 cookies
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

### Google Drive 整合
- 用 `gog drive mkdir` 自動建根資料夾 + 分類子目錄
- 用 `gog drive upload --parent <folderId>` 上傳
- Folder ID 有 cache，唔會重複查詢
- 大檔案上傳 timeout 設 10 分鐘

### 格式支援
- MP4: `--remux-video mp4`
- MKV: `--remux-video mkv`
- MOV: `--remux-video mov`

## 啟動指令
```bash
# 啟動 server + Cloudflare Tunnel
bash /data/.openclaw/workspace_project/youtube-downloader/start.sh

# 或手動啟動
cd /data/.openclaw/workspace_project/youtube-downloader
node server.js  # localhost:3847
cloudflared tunnel --config /data/.cloudflared/config.yml run yt-downloader
```

## 公開網址
- https://yt.ac02nwt.work

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
