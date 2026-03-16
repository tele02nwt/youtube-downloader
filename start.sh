#!/bin/bash
# YouTube Downloader — start server + Cloudflare Tunnel
set -e

APP_DIR="/data/.openclaw/workspace_project/projects/youtube-downloader"
TUNNEL_CONFIG="/data/.cloudflared/config.yml"
PID_DIR="$APP_DIR/data"
mkdir -p "$PID_DIR"

# Kill ALL existing server.js processes (not just pid file)
echo "🛑 Stopping existing processes..."
pkill -9 -f "node server.js" 2>/dev/null || true
sleep 1

# Also kill by PID files
for f in "$PID_DIR/server.pid" "$PID_DIR/tunnel.pid"; do
  if [ -f "$f" ]; then
    kill -9 "$(cat "$f")" 2>/dev/null || true
    rm -f "$f"
  fi
done

# Release port 3847 if anything else is holding it
fuser -k 3847/tcp 2>/dev/null || true
sleep 1

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
