# .claude/hooks/on-notification.sh
#!/usr/bin/env bash
set -euo pipefail

# Read the payload from stdin
payload="$(cat)"

# Extract the message from the JSON payload
message=$(echo "$payload" | jq -r '.message')

# Notificación visual en Ubuntu (requiere libnotify-bin)
if command -v notify-send &> /dev/null; then
    notify-send "Claude Code" "$message" --icon=dialog-information --urgency=normal
fi

if command -v espeak &> /dev/null; then
    espeak -p 30 -s 160 "$message"
fi

# Log the notification
mkdir -p .claude/.log
echo "[$(date '+%Y-%m-%d %H:%M:%S')] NOTIFICATION: $message" >> .claude/.log/notifications.log