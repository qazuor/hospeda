#!/usr/bin/env bash
#
# hops installer — compiles the toolkit to a single binary and drops it
# on PATH so callers can `hops <command>` instead of
# `bun run src/index.ts <command>`.
#
# Designed to be safe to re-run: every step is idempotent, and reusing
# the same TARGET_DIR overwrites the previous binary in place.
#
# Usage:
#   ./install.sh                          # interactive
#   HOPS_TARGET=~/.local/bin ./install.sh  # non-interactive
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
DIM="\033[2m"
RESET="\033[0m"

ok()   { printf "${GREEN}✓${RESET} %s\n" "$1"; }
info() { printf "${DIM}→${RESET} %s\n" "$1"; }
warn() { printf "${YELLOW}⚠${RESET} %s\n" "$1"; }
err()  { printf "${RED}✗${RESET} %s\n" "$1" >&2; }

# ---------------------------------------------------------------------------
# 1. Bun
# ---------------------------------------------------------------------------

if ! command -v bun >/dev/null 2>&1; then
    err "bun is required but not found on PATH."
    echo
    echo "Install bun first:"
    echo "  curl -fsSL https://bun.sh/install | bash"
    echo "  exec \$SHELL"
    exit 1
fi
ok "bun $(bun --version)"

# ---------------------------------------------------------------------------
# 2. Install deps
# ---------------------------------------------------------------------------

info "Installing dependencies..."
bun install --silent
ok "Dependencies installed"

# ---------------------------------------------------------------------------
# 3. Compile single-file binary
# ---------------------------------------------------------------------------

info "Compiling binary..."
rm -f hops-bin
bun build src/index.ts --compile --outfile=hops-bin >/dev/null
chmod +x hops-bin
ok "Binary compiled ($(du -h hops-bin | cut -f1))"

# ---------------------------------------------------------------------------
# 4. Pick install target
# ---------------------------------------------------------------------------

DEFAULT_TARGET="${HOME}/.local/bin"
SYSTEM_TARGET="/usr/local/bin"

if [[ -n "${HOPS_TARGET:-}" ]]; then
    TARGET_DIR="$HOPS_TARGET"
    info "Using HOPS_TARGET=$TARGET_DIR"
else
    echo
    echo "Where do you want to install hops?"
    echo "  1) $DEFAULT_TARGET   (no sudo, user-local — recommended)"
    echo "  2) $SYSTEM_TARGET    (system-wide, requires sudo)"
    echo "  3) custom path"
    read -rp "Choice [1]: " choice
    choice="${choice:-1}"

    case "$choice" in
        1) TARGET_DIR="$DEFAULT_TARGET" ;;
        2) TARGET_DIR="$SYSTEM_TARGET" ;;
        3)
            read -rp "Target directory: " TARGET_DIR
            if [[ -z "$TARGET_DIR" ]]; then
                err "Empty path. Aborting."
                exit 1
            fi
            ;;
        *)
            err "Invalid choice: $choice"
            exit 1
            ;;
    esac
fi

# Decide whether sudo is needed: try to create the dir as the current
# user; fall back to sudo if it fails.
if ! mkdir -p "$TARGET_DIR" 2>/dev/null; then
    info "$TARGET_DIR not writable — using sudo"
    sudo mkdir -p "$TARGET_DIR"
    SUDO="sudo"
else
    if [[ -w "$TARGET_DIR" ]]; then
        SUDO=""
    else
        SUDO="sudo"
    fi
fi

TARGET="$TARGET_DIR/hops"

# ---------------------------------------------------------------------------
# 5. Move binary into place
# ---------------------------------------------------------------------------

info "Installing to $TARGET..."
$SUDO mv hops-bin "$TARGET"
$SUDO chmod +x "$TARGET"
ok "Installed: $TARGET"

# ---------------------------------------------------------------------------
# 6. PATH sanity check
# ---------------------------------------------------------------------------

if ! echo ":$PATH:" | grep -q ":$TARGET_DIR:"; then
    echo
    warn "$TARGET_DIR is NOT on your PATH."
    echo "  Add this to your shell rc file (~/.bashrc, ~/.zshrc, ~/.profile):"
    echo
    echo "      export PATH=\"$TARGET_DIR:\$PATH\""
    echo
    echo "  Then run:  exec \$SHELL"
    echo
fi

# ---------------------------------------------------------------------------
# 7. Verify
# ---------------------------------------------------------------------------

if VERSION="$("$TARGET" --version 2>&1)"; then
    ok "hops $VERSION ready."
    echo
    echo "Try:  hops --help"
else
    err "Binary installed but failed to run --version:"
    echo "  $VERSION"
    exit 1
fi
