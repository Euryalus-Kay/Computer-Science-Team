#!/usr/bin/env bash
# Restarts the dev server on port 3000 in the background, logging to $LOG.
LOG=${LOG:-/tmp/claude-0/-home-user-Computer-Science-Team/a0644c86-17e1-54a3-90f6-276a1a04d406/scratchpad/dev.log}
fuser -k 3000/tcp >/dev/null 2>&1
sleep 1
nohup npx next dev -p 3000 > "$LOG" 2>&1 &
for i in $(seq 1 60); do
  if curl -s -o /dev/null http://localhost:3000/login; then echo "dev ready"; exit 0; fi
  sleep 1
done
echo "dev failed to start"; tail -20 "$LOG"; exit 1
