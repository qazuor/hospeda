# Notification System Installation Guide

Complete guide for setting up desktop notifications for Claude Code in Ubuntu/Linux environments.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Customization](#customization)
6. [Troubleshooting](#troubleshooting)
7. [Advanced Features](#advanced-features)

---

## Overview

The notification system provides real-time feedback when Claude Code completes tasks or encounters issues.

**Features:**

- Desktop notifications via `notify-send`
- Audio alerts (beep or system sounds)
- Notification logging for history
- Customizable urgency levels
- Icon and sound customization

**Supported Platforms:**

- Ubuntu 20.04+
- Debian 11+
- Other Linux distributions with libnotify

---

## Prerequisites

### Required Dependencies

```bash
# Update package manager
sudo apt update

# jq - REQUIRED (JSON processor for hooks)
sudo apt install jq

# libnotify-bin - REQUIRED (desktop notifications)
sudo apt install libnotify-bin
```

### Optional Dependencies

```bash
# beep - OPTIONAL (system beep sounds)
sudo apt install beep

# speech-dispatcher - OPTIONAL (text-to-speech)
sudo apt install speech-dispatcher
```

### Verify Installation

Create a verification script:

```bash
# Check dependencies
which jq && echo "✅ jq installed" || echo "❌ jq missing"
which notify-send && echo "✅ notify-send installed" || echo "❌ notify-send missing"
which beep && echo "✅ beep installed (optional)" || echo "⚠️  beep not installed (optional)"
```

**Expected output:**

```
✅ jq installed
✅ notify-send installed
✅ beep installed (optional)
```

---

## Installation

### Step 1: Create Directory Structure

```bash
# Navigate to project root
cd /path/to/hospeda

# Create .claude structure
mkdir -p .claude/hooks
mkdir -p .claude/.log
```

### Step 2: Create Notification Hook

Create `.claude/hooks/on-notification.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Read JSON payload from stdin
payload="$(cat)"
message=$(echo "$payload" | jq -r '.message')

# Create log directory if it doesn't exist
mkdir -p .claude/.log

# Log notification
timestamp=$(date '+%Y-%m-%d %H:%M:%S')
echo "[$timestamp] $message" >> .claude/.log/notifications.log

# Basic beep (works everywhere)
echo -ne '\007'

# Desktop notification
if command -v notify-send &> /dev/null; then
    notify-send "Claude Code" "$message" \
        --icon=dialog-information \
        --urgency=normal \
        --expire-time=5000
fi
```

### Step 3: Make Hook Executable

```bash
chmod +x .claude/hooks/on-notification.sh
```

### Step 4: Configure Claude Code

Update `.claude/settings.local.json`:

```json
{
  "hooks": {
    "on-notification": ".claude/hooks/on-notification.sh"
  }
}
```

### Step 5: Test Installation

```bash
# Manual test
echo '{"message":"Hello from Claude Code"}' | .claude/hooks/on-notification.sh
```

**Expected result:**

1. ✅ Hear a beep
2. ✅ See a desktop notification
3. ✅ Check log file: `cat .claude/.log/notifications.log`

---

## Configuration

### Basic Hook

Minimal notification hook:

```bash
#!/usr/bin/env bash
set -euo pipefail

payload="$(cat)"
message=$(echo "$payload" | jq -r '.message')

# Log
mkdir -p .claude/.log
echo "[$(date '+%Y-%m-%d %H:%M:%S')] $message" >> .claude/.log/notifications.log

# Beep
echo -ne '\007'

# Notify
notify-send "Claude Code" "$message"
```

### Notification Options

#### Urgency Levels

```bash
# Low urgency (subtle)
notify-send "Claude Code" "$message" --urgency=low

# Normal urgency (default)
notify-send "Claude Code" "$message" --urgency=normal

# Critical urgency (persistent)
notify-send "Claude Code" "$message" --urgency=critical
```

#### Icons

```bash
# Information
notify-send "Claude Code" "$message" --icon=dialog-information

# Warning
notify-send "Claude Code" "$message" --icon=dialog-warning

# Error
notify-send "Claude Code" "$message" --icon=dialog-error

# Success
notify-send "Claude Code" "$message" --icon=emblem-success
```

#### Duration

```bash
# Auto-dismiss after 5 seconds
notify-send "Claude Code" "$message" --expire-time=5000

# Persistent (until clicked)
notify-send "Claude Code" "$message" --expire-time=0
```

---

## Customization

### Smart Notification Hook

Advanced hook with conditional formatting:

```bash
#!/usr/bin/env bash
set -euo pipefail

payload="$(cat)"
message=$(echo "$payload" | jq -r '.message')

# Log
mkdir -p .claude/.log
timestamp=$(date '+%Y-%m-%d %H:%M:%S')
echo "[$timestamp] $message" >> .claude/.log/notifications.log

# Beep
echo -ne '\007'

# Determine urgency and icon based on message content
urgency="normal"
icon="dialog-information"
sound="/usr/share/sounds/freedesktop/stereo/message.oga"

if [[ "$message" == *"ERROR"* ]] || [[ "$message" == *"FAIL"* ]]; then
    urgency="critical"
    icon="dialog-error"
    sound="/usr/share/sounds/freedesktop/stereo/dialog-error.oga"
elif [[ "$message" == *"SUCCESS"* ]] || [[ "$message" == *"COMPLETE"* ]]; then
    icon="emblem-success"
    sound="/usr/share/sounds/freedesktop/stereo/complete.oga"
elif [[ "$message" == *"WARNING"* ]]; then
    urgency="normal"
    icon="dialog-warning"
    sound="/usr/share/sounds/freedesktop/stereo/dialog-warning.oga"
fi

# Desktop notification
if command -v notify-send &> /dev/null; then
    notify-send "Claude Code" "$message" \
        --icon="$icon" \
        --urgency="$urgency" \
        --expire-time=5000
fi

# Play sound
if command -v paplay &> /dev/null; then
    paplay "$sound" 2>/dev/null || true
fi
```

### Audio Options

#### Option 1: Basic Beep

```bash
# Terminal beep (no installation required)
echo -ne '\007'
```

#### Option 2: System Sounds

```bash
# Using paplay (PulseAudio - usually pre-installed)
paplay /usr/share/sounds/freedesktop/stereo/complete.oga

# Using aplay (ALSA)
aplay /usr/share/sounds/alsa/Front_Center.wav
```

#### Option 3: Custom Beep

```bash
# Using beep package (requires installation)
if command -v beep &> /dev/null; then
    beep -f 800 -l 200
fi

# Parameters:
# -f 800: Frequency in Hz (higher = higher pitch)
# -l 200: Duration in milliseconds
```

#### Option 4: Text-to-Speech

```bash
# Requires speech-dispatcher
if command -v spd-say &> /dev/null; then
    spd-say "$message"
fi
```

### Available System Sounds

Ubuntu/Debian systems include these sounds:

```bash
# Success/completion
/usr/share/sounds/freedesktop/stereo/complete.oga

# Error
/usr/share/sounds/freedesktop/stereo/dialog-error.oga

# Warning
/usr/share/sounds/freedesktop/stereo/dialog-warning.oga

# Message
/usr/share/sounds/freedesktop/stereo/message.oga

# Bell
/usr/share/sounds/freedesktop/stereo/bell.oga
```

---

## Troubleshooting

### Hook Not Executing

**Solution 1: Check Permissions**

```bash
# Verify executable
ls -l .claude/hooks/on-notification.sh

# Should show: -rwxr-xr-x

# If not, make executable
chmod +x .claude/hooks/on-notification.sh
```

**Solution 2: Verify jq Installation**

```bash
which jq
# Should output: /usr/bin/jq

# If not installed
sudo apt install jq
```

**Solution 3: Test Hook Manually**

```bash
echo '{"message":"Test notification"}' | .claude/hooks/on-notification.sh
```

### No Desktop Notifications

**Test notify-send:**

```bash
notify-send "Test" "This is a test notification"
```

**If not working, reinstall:**

```bash
sudo apt install --reinstall libnotify-bin
```

**Check notification daemon:**

```bash
# For GNOME
ps aux | grep notification-daemon

# For KDE
ps aux | grep knotify
```

### No Audio

**Solution 1: Check System Volume**

Ensure system volume is not muted.

**Solution 2: Test Audio**

```bash
# Test with paplay
paplay /usr/share/sounds/freedesktop/stereo/bell.oga

# Test with aplay
speaker-test -t sine -f 1000 -l 1
```

**Solution 3: Use Alternative Audio**

```bash
# Instead of beep, use paplay
paplay /usr/share/sounds/freedesktop/stereo/complete.oga
```

### Beep Permission Denied

The `beep` command requires special permissions.

**Solution: Use paplay instead**

```bash
# Replace beep with
paplay /usr/share/sounds/freedesktop/stereo/complete.oga
```

### Log File Not Created

**Check directory permissions:**

```bash
ls -ld .claude/.log

# If directory doesn't exist or no write permission
mkdir -p .claude/.log
chmod 755 .claude/.log
```

---

## Advanced Features

### Viewing Notification Logs

```bash
# View all notifications
cat .claude/.log/notifications.log

# View in real-time
tail -f .claude/.log/notifications.log

# View last 10
tail -n 10 .claude/.log/notifications.log

# Search for specific messages
grep "ERROR" .claude/.log/notifications.log

# Count notifications by type
grep -c "SUCCESS" .claude/.log/notifications.log
grep -c "ERROR" .claude/.log/notifications.log
```

### Log Rotation

Prevent log file from growing too large:

```bash
#!/usr/bin/env bash
# Add to hook

LOG_FILE=".claude/.log/notifications.log"
MAX_LINES=1000

# Rotate if too large
if [ -f "$LOG_FILE" ]; then
    lines=$(wc -l < "$LOG_FILE")
    if [ "$lines" -gt "$MAX_LINES" ]; then
        tail -n "$MAX_LINES" "$LOG_FILE" > "$LOG_FILE.tmp"
        mv "$LOG_FILE.tmp" "$LOG_FILE"
    fi
fi
```

### Notification Actions

Add clickable buttons to notifications:

```bash
notify-send "Claude Code" "$message" \
    --action="view=View Details" \
    --action="dismiss=Dismiss"
```

### Custom Icons

Use custom icon files:

```bash
notify-send "Claude Code" "$message" \
    --icon=/path/to/custom-icon.png
```

### Integration with Other Tools

#### Slack Integration

```bash
# Add to hook
if [ -n "$SLACK_WEBHOOK_URL" ]; then
    curl -X POST "$SLACK_WEBHOOK_URL" \
        -H 'Content-Type: application/json' \
        -d "{\"text\":\"Claude Code: $message\"}"
fi
```

#### Email Notifications

```bash
# For critical errors only
if [[ "$message" == *"ERROR"* ]]; then
    echo "$message" | mail -s "Claude Code Error" user@example.com
fi
```

---

## Final Checklist

Before using the notification system, verify:

- [ ] `jq` installed
- [ ] `libnotify-bin` installed
- [ ] `.claude/hooks/` directory created
- [ ] `on-notification.sh` created and executable
- [ ] Hook tested manually
- [ ] Desktop notifications working
- [ ] Audio alerts working (optional)
- [ ] Log file created in `.claude/.log/notifications.log`

---

## Related Documentation

- [MCP Installation Guide](.claude/docs/mcp-installation.md)
- [System Maintenance](.claude/docs/system-maintenance.md)
- [Quick Start Guide](.claude/docs/quick-start.md)
- [Recommended Hooks](.claude/docs/RECOMMENDED-HOOKS.md)

**External Resources:**

- [notify-send Manual](https://manpages.ubuntu.com/manpages/focal/man1/notify-send.1.html)
- [jq Manual](https://stedolan.github.io/jq/manual/)
- [Ubuntu Sound Theme](https://wiki.ubuntu.com/Sound)

---

## Changelog

| Version | Date | Changes | Author | Related |
|---------|------|---------|--------|---------|
| 1.0.0 | 2024-10-31 | Initial comprehensive notification guide | @tech-lead | P-004 |
