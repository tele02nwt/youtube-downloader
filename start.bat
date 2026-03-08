@echo off
REM ─────────────────────────────────────────────
REM YouTube Downloader — Windows 啟動腳本
REM 適用於原生 Windows 環境（無 WSL2）
REM ─────────────────────────────────────────────

title YouTube Downloader

REM 檢查 .env 檔案
if not exist ".env" (
    echo [錯誤] 找不到 .env 檔案！
    echo 請複製 .env.example 為 .env 並填入設定：
    echo   copy .env.example .env
    echo   notepad .env
    pause
    exit /b 1
)

REM 檢查 node_modules
if not exist "node_modules" (
    echo [安裝] 正在安裝 Node.js 依賴...
    npm install
    if %errorlevel% neq 0 (
        echo [錯誤] npm install 失敗！請確認已安裝 Node.js
        pause
        exit /b 1
    )
)

REM 停止現有伺服器
if exist "data\server.pid" (
    set /p OLD_PID=<data\server.pid
    taskkill /PID %OLD_PID% /F >nul 2>&1
    del "data\server.pid"
)

REM 建立 data 目錄
if not exist "data" mkdir data

REM 啟動伺服器
echo [啟動] YouTube Downloader 伺服器...
start /b node server.js > data\server.log 2>&1
timeout /t 2 /nobreak > nul

REM 取得 PID（Windows 簡化版）
for /f "tokens=2" %%i in ('tasklist ^| findstr /i "node.exe"') do (
    echo %%i > data\server.pid
    goto :started
)

:started
echo.
echo ✅ 伺服器已啟動！
echo 🌐 瀏覽器開啟：http://localhost:3847
echo.
echo 按任意鍵在瀏覽器中開啟...
pause > nul
start http://localhost:3847

echo.
echo 伺服器持續在背景運行。關閉此視窗不會停止伺服器。
echo 如需停止，請執行 stop.bat 或關閉 node.exe 進程。
pause
