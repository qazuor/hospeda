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

MODEL=~/.local/share/piper/voices/en_US-hfc_male-medium.onnx
CONFIG=$MODEL.json
LENGTH_SCALE=0.8
VOLUME=0.3
if command -v espeak &> /dev/null; then
    echo "$message" | piper -m "$MODEL" -c "$CONFIG" --output-raw  --length-scale $LENGTH_SCALE --volume $VOLUME | aplay -f S16_LE -r 22050
fi



# Log the notification
mkdir -p .claude/.log
echo "[$(date '+%Y-%m-%d %H:%M:%S')] NOTIFICATION: $message" >> .claude/.log/notifications.log