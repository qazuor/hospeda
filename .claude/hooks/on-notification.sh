# .claude/hooks/on-notification.sh
#!/usr/bin/env bash
set -euo pipefail

# Read the payload from stdin
payload="$(cat)"

# Extract the message from the JSON payload
message=$(echo "$payload" | jq -r '.message')

# Beep para llamar la atención (funciona sin instalar nada)
echo -ne '\007'

# Log the notification
mkdir -p .log
echo "[$(date '+%Y-%m-%d %H:%M:%S')] NOTIFICATION: $message" >> .log/notifications.log

# Notificación visual en Ubuntu (requiere libnotify-bin)
if command -v notify-send &> /dev/null; then
    notify-send "Claude Code" "$message" --icon=dialog-information --urgency=normal
fi

# Sonido del sistema (opcional - requiere beep)
# Descomenta las siguientes líneas si instalaste beep
# if command -v beep &> /dev/null; then
#     beep -f 800 -l 200
# fi