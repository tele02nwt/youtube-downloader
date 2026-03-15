#!/bin/bash
# YouTube Downloader — Health Check + Auto-restart

APP_DIR="/data/.openclaw/workspace_project/projects/youtube-downloader"
PID_DIR="$APP_DIR/data"
PORT=3847

server_alive=false
tunnel_alive=false
restarted=false

# Check server
if [ -f "$PID_DIR/server.pid" ]; then
  PID=$(cat "$PID_DIR/server.pid")
  if kill -0 "$PID" 2>/dev/null; then
    server_alive=true
  fi
fi

# Check tunnel
if [ -f "$PID_DIR/tunnel.pid" ]; then
  PID=$(cat "$PID_DIR/tunnel.pid")
  if kill -0 "$PID" 2>/dev/null; then
    tunnel_alive=true
  fi
fi

# Double-check server via HTTP (fail on connection refused OR non-200)
if $server_alive; then
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "http://localhost:$PORT/api/health" 2>/dev/null)
  if [[ "$HTTP_CODE" != "200" ]]; then
    server_alive=false
  fi
fi

# Restart if anything is down
if ! $server_alive || ! $tunnel_alive; then
  bash "$APP_DIR/start.sh" >> "$PID_DIR/healthcheck.log" 2>&1
  restarted=true

  TS=$(TZ=Asia/Hong_Kong date '+%Y-%m-%d %H:%M:%S HKT')
  # stdout: ONLY emit when restart happened (so cron announce stays silent on OK)
  echo "⚠️ YouTube Downloader was down and has been restarted. (server_was=$server_alive, tunnel_was=$tunnel_alive, $TS)"

  # log
  echo "RESTARTED: server_was=$server_alive tunnel_was=$tunnel_alive at $TS" >> "$PID_DIR/healthcheck.log"
else
  # OK path: log only, no stdout
  TS=$(TZ=Asia/Hong_Kong date '+%Y-%m-%d %H:%M:%S HKT')
  echo "OK: server=running tunnel=running at $TS" >> "$PID_DIR/healthcheck.log"
fi

# Trim healthcheck log (keep last 200 lines)
if [ -f "$PID_DIR/healthcheck.log" ]; then
  tail -200 "$PID_DIR/healthcheck.log" > "$PID_DIR/healthcheck.log.tmp" && mv "$PID_DIR/healthcheck.log.tmp" "$PID_DIR/healthcheck.log"
fi
