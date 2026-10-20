#!/usr/bin/env bash
# Restarts the dev server on port 3000 in the background, logging to $LOG.
LOG=${LOG:-$(dirname "$0")/../../.qa/dev.log}
mkdir -p "$(dirname "$LOG")"
fuser -k 3000/tcp >/dev/null 2>&1
sleep 1
nohup npx next dev -p 3000 > "$LOG" 2>&1 &
for i in $(seq 1 60); do
  if curl -s -o /dev/null http://localhost:3000/login; then echo "dev ready"; exit 0; fi
  sleep 1
done
echo "dev failed to start"; tail -20 "$LOG"; exit 1
