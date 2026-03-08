@echo off
REM YouTube Downloader — Windows 停止腳本

if exist "data\server.pid" (
    set /p OLD_PID=<data\server.pid
    taskkill /PID %OLD_PID% /F >nul 2>&1
    del "data\server.pid"
    echo ✅ 伺服器已停止 (PID %OLD_PID%)
) else (
    taskkill /IM node.exe /F >nul 2>&1
    echo ✅ 已停止所有 node.exe 進程
)
pause
