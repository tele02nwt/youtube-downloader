#!/bin/bash
# YouTube Downloader — start server + Cloudflare Tunnel
set -e

APP_DIR="/data/.openclaw/workspace_project/projects/youtube-downloader"
TUNNEL_CONFIG="/data/.cloudflared/config.yml"
PID_DIR="$APP_DIR/data"
mkdir -p "$PID_DIR"

# Kill existing processes by PID files first
echo "🛑 Stopping existing processes..."
for f in "$PID_DIR/server.pid" "$PID_DIR/tunnel.pid"; do
  if [ -f "$f" ]; then
    OLD_PID=$(cat "$f")
    kill -9 "$OLD_PID" 2>/dev/null || true
    rm -f "$f"
  fi
done

# Release ports if anything else is still holding them
fuser -k 3847/tcp 2>/dev/null || true
fuser -k 3848/tcp 2>/dev/null || true
sleep 2

# Start Node server
cd "$APP_DIR"
nohup node server.js > "$PID_DIR/server.log" 2>&1 &
SERVER_PID=$!
echo $SERVER_PID > "$PID_DIR/server.pid"
echo "✅ Server started (PID $SERVER_PID)"

# Wait for server to be ready
sleep 2

# Start Cloudflare Tunnel
nohup cloudflared tunnel --config "$TUNNEL_CONFIG" run yt-downloader >> "$PID_DIR/tunnel.log" 2>&1 &
TUNNEL_PID=$!
echo $TUNNEL_PID > "$PID_DIR/tunnel.pid"
echo "✅ Tunnel started (PID $TUNNEL_PID)"
echo ""
echo "🌐 https://yt.ac02nwt.work"
