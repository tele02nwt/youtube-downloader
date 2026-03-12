# 🎬 YouTube Downloader

> A self-hosted YouTube downloader web app with a Cyber/Futuristic UI

一個自架 YouTube 影片下載器 Web App，提供 Cyber 風格介面，支援影片下載、分類管理、Google Drive 自動上傳、Telegram 通知。

> 📸 Screenshot coming soon

---

## ✨ Features / 功能

- 📥 **影片下載** — 支援 YouTube 及其他 yt-dlp 支援的平台，自動選擇最佳畫質
- 📅 **日期前綴** — 檔名自動加上影片上傳日期（如 `20260302-title.mp4`）
- ☁️ **Google Drive** — 下載完成自動上傳，按分類整理（可選）
- 📲 **Telegram 通知** — 下載完成即時推送（可選，需 OpenClaw）
- 📁 **分類管理** — 支援拖曳排序
- 📋 **Activity Log** — 完整記錄下載、上傳、登入等操作
- 🔐 **登入保護** — 帳號密碼認證 + 忘記密碼（Email 驗證碼）
- 🌐 **Cloudflare Tunnel** — 一鍵公開存取（可選）
- 🍪 **YouTube Cookies** — 繞過年齡限制 / 會員內容
- ⚙️ **全 Web UI 設定** — 無需手動改 config

---

## 🚀 Quick Install / 快速安裝

### 🤖 OpenClaw（AI 助手）

告訴 OpenClaw：

> 請幫我從 https://github.com/tele02nwt/youtube-downloader 安裝 YouTube Downloader

OpenClaw 會自動完成 clone、安裝依賴、設定環境變數、啟動 server。

### 🐧 Linux / macOS

```bash
# 安裝 Node.js (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安裝系統工具
sudo apt-get install -y ffmpeg
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

# Clone & 啟動
git clone https://github.com/tele02nwt/youtube-downloader.git
cd youtube-downloader
npm install
cp .env.example .env
nano .env  # 填入 YT_AUTH_USER 和 YT_AUTH_PASS
node server.js
```

瀏覽器前往 → **http://localhost:3847**

### 🪟 Windows

**推薦 WSL2**（完整功能，含 Google Drive）：
```powershell
wsl --install  # 安裝 Ubuntu，然後按 Linux 步驟操作
```

**原生 Windows**（無 Google Drive 上傳）：
1. 從 [nodejs.org](https://nodejs.org/) 安裝 Node.js LTS
2. 用 winget 安裝工具：`winget install yt-dlp.yt-dlp` + `winget install Gyan.FFmpeg`
3. `git clone https://github.com/tele02nwt/youtube-downloader.git`
4. 複製 `.env.example` 為 `.env`，用 notepad 編輯
5. 雙擊 `start.bat` 啟動

---

## 📋 Requirements / 系統需求

| 工具 Tool | 版本 Version | 說明 Notes |
|-----------|-------------|-----------|
| **Node.js** | v18+ | 執行伺服器 / Run server |
| **yt-dlp** | Latest | 核心下載工具 / Core downloader |
| **ffmpeg** | Any | 影片合成 / Video merging (required for HD) |
| **gog CLI** | Latest | Google Drive 上傳 / Upload (optional, macOS/Linux only) |
| **cloudflared** | Latest | Cloudflare Tunnel / External access (optional) |

---

## ⚙️ Configuration / 設定

複製 `.env.example` 為 `.env` 並填入：

| 變數 Variable | 必填 Required | 說明 Description |
|--------------|:---:|----------------|
| `YT_AUTH_USER` | ✅ | 登入帳號 / Login username |
| `YT_AUTH_PASS` | ✅ | 登入密碼 / Login password |
| `YT_DLP_PATH` | | yt-dlp 路徑覆蓋 / Custom yt-dlp path |
| `FFMPEG_PATH` | | ffmpeg 路徑覆蓋 / Custom ffmpeg path |
| `YT_DOWNLOAD_DIR` | | 下載目錄 / Download directory (default: `/data/youtube-downloads`) |

---

## 🎯 Usage / 使用

啟動後瀏覽器前往 **http://localhost:3847**，用 `.env` 中的帳密登入。

1. **📥 下載** — 貼上 YouTube URL → 分析 → 選畫質/格式 → 下載
2. **📁 分類** — 新增/編輯/刪除分類，支援拖曳排序
3. **📊 管理** — 即時查看下載進度、上傳狀態、Drive 連結
4. **📋 日誌** — 完整操作記錄，支援篩選

---

## 🌐 Cloudflare Tunnel（可選 / Optional）

透過 Cloudflare Tunnel 從外部網路安全存取你的下載器：

- **Quick Tunnel**（免帳號）：在 ⚙️ 設定頁選 Quick Tunnel → 啟動
- **固定域名**：需 [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) 帳號，取得 Token 後在設定頁填入

或使用 `bash start.sh` 同時啟動 server + tunnel。

---

## ☁️ Google Drive（可選 / Optional）

下載完成後自動上傳到 Google Drive，按分類整理。

1. 安裝 gog CLI：`brew install steipete/tap/gogcli`
2. 在 ⚙️ 設定頁點「連結 Google Drive」完成 OAuth 授權
3. 之後下載的檔案會自動上傳

> ⚠️ gog CLI 僅支援 macOS / Linux，Windows 需使用 WSL2。

---

## 📲 Telegram Notifications（可選 / Optional）

下載完成即時推送通知到 Telegram 群組。

1. 在 ⚙️ 設定頁填入 Group ID 和 Topic ID
2. 開啟開關，點「測試」確認

> ⚠️ 需本機已安裝並設定 [OpenClaw](https://openclaw.ai)。

---

## 🛠 Development / 開發

### 目錄結構 / Project Structure

```
youtube-downloader/
├── server.js          # Express 主伺服器
├── package.json
├── .env.example       # 環境變數範本
├── start.sh           # 啟動腳本（Linux/macOS/WSL2）
├── start.bat          # 啟動腳本（Windows）
├── healthcheck.sh     # 健康檢查 + auto-restart
├── lib/
│   ├── auth.js        # Session 登入驗證
│   ├── downloader.js  # yt-dlp 封裝（下載/進度/Drive 上傳）
│   ├── categories.js  # 分類 CRUD + 排序
│   ├── logger.js      # Activity Log
│   ├── settings.js    # 持久化設定
│   ├── setup.js       # Cloudflare / Google Drive 設定
│   └── storage.js     # JSON 讀寫
├── public/
│   ├── index.html     # SPA 主介面（8 Tabs）
│   └── login.html     # 登入頁面
└── data/              # 執行期資料（自動建立）
```

### 啟動開發 / Start Development

```bash
node server.js  # http://localhost:3847
```

---

## 📄 License

MIT

---

Built with ❤️ by Wilson NG
