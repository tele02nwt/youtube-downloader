# 🎬 YouTube Downloader

一個基於 **Express.js + yt-dlp** 的自架影片下載器 Web App，提供 Cyber 風格介面，支援：

- 📥 下載 YouTube（及其他平台）影片，自動選擇最佳畫質
- 📅 檔名自動加上影片上傳日期前綴（如 `20260302-title.mp4`）
- ☁️ 自動上傳到 Google Drive，按分類整理（可選）
- 📲 Telegram 下載完成通知（可選，需 OpenClaw）
- 📁 分類管理，支援拖曳排序
- 📋 Activity Log 完整記錄下載、上傳、登入等操作
- 🔐 帳號密碼登入保護 + 忘記密碼（Email 驗證碼）
- 🌐 Cloudflare Tunnel 公開存取（可選）
- 🍪 YouTube Cookies 支援（繞過年齡限制/會員內容）
- ⚙️ 全部設定可在 Web UI 內完成（無需手動改 config）

---

## 系統需求

| 工具 | 版本 | 說明 |
|------|------|------|
| **Node.js** | v18+ | 執行伺服器 |
| **yt-dlp** | 最新版 | 核心下載工具 |
| **ffmpeg** | 任意版本 | 影片合成（下載高畫質必須）|
| **gog CLI** | 最新版 | Google Drive 上傳（可選）|
| **cloudflared** | 最新版 | Cloudflare Tunnel（可選）|

---

## 安裝步驟

### Step 1 — 解壓縮

```bash
tar -xzf youtube-downloader.tar.gz
cd youtube-downloader
```

### Step 2 — 安裝 Node 依賴

```bash
npm install
```

### Step 3 — 安裝系統工具

#### macOS（Homebrew，推薦）
```bash
# 核心工具（必裝）
brew install yt-dlp ffmpeg

# Google Drive 上傳（可選）
brew install steipete/tap/gogcli

# Cloudflare Tunnel（可選）
brew install cloudflared
```

#### Linux / WSL2（Homebrew）
```bash
# 安裝 Homebrew（若未安裝）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 一行安裝所有工具
brew install yt-dlp ffmpeg

# 可選
brew install steipete/tap/gogcli cloudflared
```

#### Windows 原生（winget）
```powershell
winget install OpenJS.NodeJS.LTS
winget install yt-dlp.yt-dlp
winget install Gyan.FFmpeg
winget install Cloudflare.cloudflared
```

> ⚠️ **Windows 注意**：Google Drive 上傳（gog CLI）僅支援 macOS / Linux，Windows 需使用 WSL2 才能使用完整功能。

---

### Step 4 — 設定環境變數

```bash
cp .env.example .env
```

用任意編輯器（`nano .env` / `notepad .env`）填入以下**必填**項目：

```env
YT_AUTH_USER=your@email.com     # 登入帳號（任意字串皆可）
YT_AUTH_PASS=your_password      # 登入密碼（請設複雜密碼）
```

完整選項請參考 `.env.example`。

---

### Step 5 — 啟動伺服器

**Linux / macOS / WSL2：**
```bash
node server.js
```

**後台執行（含 Cloudflare Tunnel）：**
```bash
bash start.sh
```

**Windows 原生（雙擊或命令列）：**
```
start.bat
```

伺服器啟動後，瀏覽器前往 → **http://localhost:3847**

---

## 功能設定（Web UI）

啟動後前往 ⚙️ **設定** Tab，可設定以下項目：

### 🍪 YouTube Cookies
從 YouTube 匯出 cookies（推薦使用「[Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)」瀏覽器擴充），上傳到設定頁，即可下載需要登入的內容。

### ☁️ Google Drive
1. 安裝 gog CLI：`brew install steipete/tap/gogcli`
2. 在設定頁點「🔗 連結 Google Drive」，瀏覽器會自動開啟 OAuth 授權
3. 授權完成後，下載的檔案會自動上傳

### 📲 Telegram 通知
1. 取得 **Group ID**：將 [@userinfobot](https://t.me/userinfobot) 加入你的群組並發言，Bot 會回報 ID（以 `-100` 開頭）
2. 取得 **Topic ID**（可選）：右鍵論壇話題 → 複製連結，URL 末尾數字即 Topic ID
3. 在設定頁填入，開啟開關，點「📨 測試」確認
> ⚠️ Telegram 通知需要本機已安裝並設定 [OpenClaw](https://openclaw.ai)

### 🌐 Cloudflare Tunnel（從外部網路存取）

**方式一：Quick Tunnel（免帳號，URL 每次不同）**

在設定頁選「Quick Tunnel」→ 啟動 → 複製顯示的 URL 即可。

**方式二：固定域名 Tunnel（需 Cloudflare 帳號）**

1. 在 [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/) 建立 Tunnel，取得 Token
2. 在設定頁選「Token Tunnel」→ 貼上 Token → 啟動
3. 或用指令列方式（進階）：

```bash
cloudflared tunnel login
cloudflared tunnel create yt-downloader
cloudflared tunnel route dns yt-downloader yt.yourdomain.com
```

建立 `~/.cloudflared/config.yml`：

```yaml
tunnel: <your-tunnel-id>
credentials-file: /home/user/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: yt.yourdomain.com
    service: http://localhost:3847
  - service: http_status:404    # 必須有此 catch-all entry
```

然後執行 `bash start.sh`。

---

## 使用說明

### 下載影片

1. 前往 **📥 下載** Tab
2. 選擇分類（可選）
3. 貼上 YouTube URL → 點「🔍 分析」
4. 選擇畫質（4K / 1080P / 720P / ...）
5. 選擇封裝格式（MP4 / MKV / MOV）
6. **檔名日期前綴**：預設開啟，影片上傳日期會加在檔名前（如 `20260302-title.mp4`）
7. 點「▶️ 開始下載」

### 查看進度

前往 **📊 管理** Tab，可即時查看下載進度、上傳狀態、Google Drive 連結。

### 分類管理

前往 **📁 分類** Tab，可新增/編輯/刪除分類，支援拖曳排序。

---

## 目錄結構

```
youtube-downloader/
├── server.js          # Express 主伺服器
├── package.json
├── .env.example       # 環境變數範本（必填：YT_AUTH_USER / YT_AUTH_PASS）
├── start.sh           # 啟動腳本（Linux/macOS/WSL2：server + Cloudflare Tunnel）
├── start.bat          # 啟動腳本（Windows）
├── stop.bat           # 停止腳本（Windows）
├── lib/
│   ├── auth.js        # Session 登入驗證（Cookie-based）
│   ├── downloader.js  # yt-dlp 封裝（下載、進度、Google Drive 上傳）
│   ├── categories.js  # 分類 CRUD + 拖曳排序
│   ├── logger.js      # Activity Log（JSON，max 500 條）
│   ├── settings.js    # 持久化應用設定（Telegram / 其他）
│   ├── setup.js       # Cloudflare / Google Drive 設定模組
│   └── storage.js     # JSON 讀寫封裝
├── public/
│   ├── index.html     # SPA 主介面（7 Tabs，含全部 CSS/JS）
│   └── login.html     # 登入頁面
└── data/              # 執行期資料（自動建立，勿 commit）
    ├── settings.json
    ├── downloads.json
    ├── categories.json
    ├── activity-log.json
    ├── cookies.txt    # YouTube cookies（可選，由 UI 上傳）
    ├── server.log
    └── tunnel.log
```

---

## 常見問題

**Q: 下載失敗，找不到 yt-dlp / ffmpeg？**  
在 `.env` 明確指定路徑：
```env
YT_DLP_PATH=/usr/local/bin/yt-dlp
FFMPEG_PATH=/usr/local/bin/ffmpeg
```

**Q: 沒有音訊，或畫質很低？**  
確認已安裝 `ffmpeg`。yt-dlp 需要 ffmpeg 合成影片流和音訊流。

**Q: 忘記登入密碼？**  
在登入頁點「Forgot Password?」，輸入帳號 Email，系統會發送驗證碼到你的信箱。
（需事先用 gog CLI 完成 Gmail 授權：`gog auth login`）

或直接修改 `.env` 中的 `YT_AUTH_PASS` 並重啟伺服器。

**Q: 502 Bad Gateway / 網頁打不開？**  
Server 進程可能已停止。執行 `bash start.sh` 重啟。

**Q: Cloudflare Error 1033？**  
`cloudflared` 進程停止了。執行 `bash start.sh` 重啟（無需重新登入）。

**Q: Google Drive 上傳失敗？**  
1. 確認 `gog auth login` 已完成授權
2. 在設定頁重新授權
3. Windows 用戶：gog CLI 不支援 Windows 原生，需使用 WSL2

**Q: Windows 上 Google Drive 上傳不可用？**  
gog CLI 僅支援 macOS / Linux。Windows 建議使用 WSL2：
```powershell
wsl --install   # 安裝 Ubuntu
# 然後在 WSL2 內執行 Linux 安裝步驟
```

---

## 版本記錄

| 版本 | 日期 | 功能 |
|------|------|------|
| v1.0 | 2026-03-08 | 初始版本：下載、分類、Drive 上傳、Telegram、認證、Cloudflare |
| v1.1 | 2026-03-08 | Activity Log、字體大小設定、文字亮度優化 |
| v1.2 | 2026-03-08 | 檔名日期前綴（Date Prefix Toggle） |
| v1.3 | 2026-03-08 | Standalone Setup UI（Cloudflare + Drive 設定面板）、Windows 支援 |
| v1.4 | 2026-03-08 | Telegram 設定移至 Web UI、設定面板重排 |
| v1.5 | 2026-03-08 | 修正 Date Prefix 無效 Bug（yt-dlp mtime 陷阱） |

---

## License

MIT
