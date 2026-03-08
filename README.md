# 🎬 YouTube Downloader

一個基於 **Express.js + yt-dlp** 的自架影片下載器 Web App，支援：

- 📥 下載 YouTube（及其他平台）影片 / 音樂
- ☁️ 自動上傳到 Google Drive（可選）
- 📲 Telegram 下載完成通知（需 OpenClaw，可選）
- 📁 分類管理下載項目
- 🔐 帳號密碼登入保護
- 📋 Activity Log 記錄
- 🌐 Cloudflare Tunnel 公開存取（可選）

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

### 1. 安裝依賴工具

**macOS (Homebrew)：**
```bash
brew install yt-dlp ffmpeg
# Google Drive 上傳（可選）
brew install steipete/tap/gogcli
```

**Linux (Ubuntu/Debian)：**
```bash
# yt-dlp
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

# ffmpeg
sudo apt update && sudo apt install -y ffmpeg
```

**Windows (winget)：**
```powershell
winget install yt-dlp.yt-dlp
winget install Gyan.FFmpeg
```

---

### 2. Clone / 解壓項目

```bash
# 如從壓縮包安裝，解壓後進入目錄
cd youtube-downloader
```

### 3. 安裝 Node 依賴

```bash
npm install
```

### 4. 設定環境變數

```bash
# 複製範本
cp .env.example .env

# 用任意編輯器修改
nano .env   # 或 vim .env
```

**最少需要填寫：**

```env
YT_AUTH_USER=your@email.com
YT_AUTH_PASS=your_password_here
```

完整 `.env` 選項說明請參考 `.env.example`。

---

### 5. 啟動伺服器

**Linux / macOS：**
```bash
# 前景執行（開發用）
node server.js

# 背景執行（含 Cloudflare Tunnel）
bash start.sh
```

**Windows：**
```powershell
# 雙擊或執行
start.bat
```

伺服器預設監聽 **Port 3847**。

開啟瀏覽器前往：[http://localhost:3847](http://localhost:3847)

---

## Google Drive 自動上傳（可選）

需安裝 [gog CLI](https://github.com/steipete/gogcli) 並完成 Google OAuth 授權：

```bash
brew install steipete/tap/gogcli
gog auth login
```

授權完成後，下載時勾選「上傳到 Google Drive」即可自動上傳。

---

## Cloudflare Tunnel 公開存取（可選）

若需要從外部網路存取，可設定 Cloudflare Tunnel：

1. [申請 Cloudflare 帳號](https://dash.cloudflare.com/)，將你的網域加入 Cloudflare
2. 安裝 `cloudflared`：
   ```bash
   # macOS
   brew install cloudflared
   
   # Linux
   curl -L https://pkg.cloudflare.com/cloudflared-linux-amd64.deb -o cloudflared.deb
   sudo dpkg -i cloudflared.deb
   ```
3. 登入並建立 Tunnel：
   ```bash
   cloudflared tunnel login
   cloudflared tunnel create yt-downloader
   ```
4. 建立 `/data/.cloudflared/config.yml`（路徑可按需調整）：
   ```yaml
   tunnel: <your-tunnel-id>
   credentials-file: /data/.cloudflared/<tunnel-id>.json
   
   ingress:
     - hostname: yt.yourdomain.com
       service: http://localhost:3847
     - service: http_status:404
   ```
5. 修改 `start.sh` 中的 `APP_DIR` 和 `TUNNEL_CONFIG` 路徑，然後執行：
   ```bash
   bash start.sh
   ```

---

## Telegram 通知（可選，需 OpenClaw）

需要本機已安裝並設定 [OpenClaw](https://openclaw.ai)。

設定方式：進入 Web UI → ⚙️ 設定 → **Telegram 通知** 面板。

填寫以下資料並點「💾 儲存設定」，然後開啟開關：

| 欄位 | 說明 |
|------|------|
| **Group ID** | Telegram 群組 ID（以 `-100` 開頭的數字）。將 [@userinfobot](https://t.me/userinfobot) 加入群組並發言，Bot 會回覆 ID |
| **Topic ID** | 可選。Forum（話題）群組才需要，右鍵話題 → 複製連結，URL 末尾數字即 Topic ID |

填完後點「📨 發送測試訊息」確認通知正常。

---

## 目錄結構

```
youtube-downloader/
├── server.js          # Express 主伺服器
├── package.json       # Node 依賴
├── .env.example       # 環境變數範本
├── start.sh           # 啟動腳本（Linux/macOS）
├── start.bat          # 啟動腳本（Windows）
├── lib/
│   ├── auth.js        # 登入驗證
│   ├── downloader.js  # yt-dlp 下載邏輯
│   ├── categories.js  # 分類管理
│   ├── logger.js      # Activity Log
│   ├── setup.js       # 初始化設定
│   └── storage.js     # 資料存儲
├── public/
│   ├── index.html     # 主介面
│   ├── login.html     # 登入頁面
│   ├── js/            # 前端 JS
│   └── css/           # 樣式
└── data/              # 執行期資料（自動生成，勿 commit）
    ├── downloads.json
    ├── categories.json
    └── activity-log.json
```

---

## 常見問題

**Q: 下載失敗，提示找不到 yt-dlp？**
在 `.env` 明確指定路徑：
```env
YT_DLP_PATH=/usr/local/bin/yt-dlp
```

**Q: 沒有音訊或畫質不夠高？**
確認已安裝 `ffmpeg`，yt-dlp 需要它來合成影片和音訊。

**Q: 忘記登入密碼？**
直接修改 `.env` 中的 `YT_AUTH_PASS`，重啟伺服器即生效。

---

## License

MIT
