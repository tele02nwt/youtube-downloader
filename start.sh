#!/bin/bash
# YouTube Downloader — start server + Cloudflare Tunnel
set -e

APP_DIR="/data/.openclaw/workspace_project/projects/youtube-downloader"
TUNNEL_CONFIG="/data/.cloudflared/config.yml"
PID_DIR="$APP_DIR/data"
mkdir -p "$PID_DIR"

# Kill existing processes
for f in "$PID_DIR/server.pid" "$PID_DIR/tunnel.pid"; do
  if [ -f "$f" ]; then
    kill "$(cat "$f")" 2>/dev/null || true
    rm -f "$f"
  fi
done

# Start Node server
cd "$APP_DIR"
nohup node server.js > "$PID_DIR/server.log" 2>&1 &
echo $! > "$PID_DIR/server.pid"
echo "✅ Server started (PID $!)"

# Wait for server to be ready
sleep 2

# Start Cloudflare Tunnel
nohup cloudflared tunnel --config "$TUNNEL_CONFIG" run yt-downloader > "$PID_DIR/tunnel.log" 2>&1 &
echo $! > "$PID_DIR/tunnel.pid"
echo "✅ Tunnel started (PID $!)"
echo ""
echo "🌐 https://yt.ac02nwt.work"
