# 🎬 YouTube Downloader

> A self-hosted YouTube downloader web app with a Cyber/Futuristic UI

一個自架 YouTube 影片下載器 Web App，提供 Cyber 風格介面，支援影片下載、分類管理、Google Drive 自動上傳、多頻道通知。

> 📸 Screenshot coming soon

---

## ✨ Features / 功能

### 核心功能
- 📥 **影片下載** — 支援 YouTube 及其他 yt-dlp 支援的平台，自動選擇最佳畫質
- 🎵 **純音頻下載** — MP3 / M4A / OPUS / WAV 格式選擇
- 📋 **播放清單支援** — 自動偵測 Playlist URL，批量選擇下載
- 📝 **字幕下載** — 嵌入字幕或獨立 .srt 文件，支援自動生成字幕
- 📅 **日期前綴** — 檔名自動加上影片上傳日期（如 `20260302-title.mp4`）
- ⏰ **排程下載** — 指定時間下載，支援倒計時顯示

### 管理功能
- ⏳ **下載佇列** — 最多 3 個並發下載，其餘自動排隊
- 🔄 **失敗重試** — 一鍵重試失敗的下載
- 📡 **即時進度** — SSE 串流推送（非 polling），即時更新
- 🚦 **速度限制** — 全局或每次下載獨立設定（1/2/5/10 MB/s）
- 📁 **分類管理** — 支援拖曳排序
- 🔍 **歷史搜尋** — 按標題/狀態/日期/分類篩選，支援 CSV 匯出

### 文件管理
- 📂 **文件瀏覽器** — 內建文件 Tab，按分類瀏覽下載文件
- ▶️ **內嵌播放器** — HTML5 播放器直接在瀏覽器播放影片/音頻（支援 seek）

### 整合功能
- ☁️ **Google Drive** — 下載完成自動上傳，按分類整理，非同步上傳（不阻塞 server）
- 🔔 **多頻道通知** — Telegram / Discord Webhook / Generic Webhook（含 HMAC-SHA256 簽名）
- 🌐 **Cloudflare Tunnel** — 一鍵公開存取
- 🍪 **YouTube Cookies** — 繞過年齡限制 / 會員內容
- 🔄 **Auto-Update yt-dlp** — Settings UI 一鍵更新

### 安全與用戶管理
- 🔐 **登入保護** — 帳號密碼認證 + 忘記密碼（Email 驗證碼）+ Session 持久化（重啟後無需重新登入）
- 👥 **多用戶支援** — Admin/User 角色，每個用戶獨立下載記錄
- ⚙️ **全 Web UI 設定** — 無需手動改 config

### 系統工具
- 📊 **健康診斷** — 實時檢查 yt-dlp / ffmpeg / GDrive / 磁碟空間 / Cookies
- 📈 **下載統計** — 總下載/成功率/容量/分類排行/最近活動圖表
- 📋 **下載模板** — 常用設定存為模板，一鍵重用
- 🌗 **暗/淺主題** — Header 一鍵切換，localStorage 記住偏好
- 🌐 **多語言** — 繁中/英文切換，localStorage 記住偏好
- 🧪 **自動化測試** — 密碼/route/前端模組測試覆蓋

---

## 🚀 Quick Install / 快速安裝

### 🤖 OpenClaw（AI 助手）

告訴 OpenClaw：

> 請幫我從 https://github.com/tele02nwt/youtube-downloader 安裝 YouTube Downloader

OpenClaw 會自動完成 clone、安裝依賴、設定環境變數、啟動 server。

### 🐧 Linux / macOS

```bash
# 安裝 Node.js (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安裝系統工具
sudo apt install -y ffmpeg python3-pip
pip3 install yt-dlp
# 如果出現 externally-managed-environment 錯誤：
# pip3 install --break-system-packages yt-dlp

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
| `ALLOWED_ORIGIN` | | CORS 允許來源（default: `https://yt.ac02nwt.work`） |

---

## 🎯 Usage / 使用

啟動後瀏覽器前往 **http://localhost:3847**，用 `.env` 中的帳密登入。

1. **📥 下載** — 貼上 YouTube URL → 分析 → 選畫質/格式 → 下載
   - 切換 Audio Only 模式下載 MP3/M4A
   - 貼入 Playlist URL 可批量選擇下載
   - 可設排程時間延遲下載
2. **📁 分類** — 新增/編輯/刪除分類，支援拖曳排序
3. **📊 管理** — 即時查看下載進度、佇列狀態、Drive 連結；失敗可一鍵重試
4. **📂 文件** — 瀏覽下載文件，直接在瀏覽器播放影片/音頻
5. **📋 日誌** — 完整操作記錄，支援篩選，可匯出 CSV
6. **⚙️ 設定** — 帳號管理、通知設定（Telegram/Discord/Webhook）、用戶管理

---

## 🌐 Cloudflare Tunnel（可選 / Optional）

透過 Cloudflare Tunnel 從外部網路安全存取你的下載器：

- **Quick Tunnel**（免帳號）：在 ⚙️ 設定頁選 Quick Tunnel → 啟動
- **固定域名**：需 [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) 帳號，取得 Token 後在設定頁填入

或使用 `bash start.sh` 同時啟動 server + tunnel。

---

## ☁️ Google Drive（可選 / Optional）

下載完成後**非同步**上傳到 Google Drive（不阻塞 server），按分類整理。最多 2 個並發上傳。

### 安裝 gog CLI

**macOS：**
```bash
brew install steipete/tap/gogcli
```

**Linux / WSL2（推薦：直接用 GitHub release binary）：**
```bash
ARCH=$(uname -m)
if [ "$ARCH" = "x86_64" ]; then ARCH_TAG="amd64"; else ARCH_TAG="arm64"; fi
VERSION="0.12.0"
curl -L "https://github.com/steipete/gogcli/releases/download/v${VERSION}/gogcli_${VERSION}_linux_${ARCH_TAG}.tar.gz" -o /tmp/gog.tar.gz
tar -xzf /tmp/gog.tar.gz -C /tmp && sudo mv /tmp/gog /usr/local/bin/gog
```

### 啟用 Google Drive 上傳
1. 在 ⚙️ 設定頁點「連結 Google Drive」完成 OAuth 授權
2. 之後下載的檔案會自動上傳

> ⚠️ gog CLI 只支援 macOS / Linux。Windows 想用 Drive 上傳請用 WSL2。

---

## 🔔 通知設定（可選 / Optional）

在 ⚙️ 設定頁「通知設定」面板，支援三種頻道：

| 頻道 | 設定 |
|------|------|
| **Telegram** | 需本機安裝 [OpenClaw](https://openclaw.ai)，填入 Group ID + Topic ID |
| **Discord** | 填入 Discord Webhook URL，點測試確認 |
| **Generic Webhook** | 填入任意 HTTPS URL，可選 HMAC-SHA256 簽名 |

每個頻道可獨立開關，並有測試按鈕。

---

## 👥 多用戶管理（可選 / Optional）

Admin 用戶可在 ⚙️ 設定頁「用戶管理」新增/刪除用戶。每個用戶有獨立的下載記錄。

現有 `.env` 帳號在首次啟動時自動升級為 Admin。

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
├── healthcheck.sh     # 健康檢查 + auto-restart（HTTP 200 check）
├── lib/
│   ├── auth.js        # Session 登入驗證 + 多用戶支援
│   ├── downloader.js  # yt-dlp 封裝（非同步，in-memory state，SSE）
│   ├── categories.js  # 分類 CRUD + 排序
│   ├── logger.js      # Activity Log
│   ├── notifier.js    # 多頻道通知引擎
│   ├── settings.js    # 持久化設定
│   ├── setup.js       # Cloudflare / Google Drive 設定
│   ├── storage.js     # JSON 讀寫（帶 try/catch）
│   └── users.js       # 用戶管理（admin/user roles）
├── public/
│   ├── index.html     # SPA 主介面（9 Tabs）
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
