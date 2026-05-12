#!/usr/bin/env bash
#
# hops uninstaller — removes the binary placed by install.sh. Looks for
# hops on PATH first; if not found, looks at the canonical install
# locations.
#

set -euo pipefail

GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
RESET="\033[0m"

ok()   { printf "${GREEN}✓${RESET} %s\n" "$1"; }
warn() { printf "${YELLOW}⚠${RESET} %s\n" "$1"; }
err()  { printf "${RED}✗${RESET} %s\n" "$1" >&2; }

# 1. Locate the binary.
TARGET=""
if T="$(command -v hops 2>/dev/null)"; then
    TARGET="$T"
else
    for candidate in "$HOME/.local/bin/hops" "/usr/local/bin/hops"; do
        if [[ -f "$candidate" ]]; then
            TARGET="$candidate"
            break
        fi
    done
fi

if [[ -z "$TARGET" ]]; then
    warn "hops not found on PATH or in standard locations. Nothing to uninstall."
    exit 0
fi

echo "Found: $TARGET"

# 2. Confirm.
if [[ "${HOPS_FORCE:-}" != "1" ]]; then
    read -rp "Remove? [y/N]: " ans
    if [[ "$ans" != "y" && "$ans" != "Y" ]]; then
        echo "Cancelled."
        exit 0
    fi
fi

# 3. Remove (sudo if needed).
if [[ -w "$TARGET" ]]; then
    rm "$TARGET"
else
    sudo rm "$TARGET"
fi

ok "Removed $TARGET"

# 4. Warn about leftover hops-bin in the repo if someone re-ran a partial install.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/hops-bin" ]]; then
    warn "Build artifact still present: $SCRIPT_DIR/hops-bin (gitignored — safe to delete)."
fi
