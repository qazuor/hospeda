#!/usr/bin/env bash
# Check for CSP-incompatible patterns in source files
# These patterns are blocked by Content Security Policy and should not appear in source code

set -euo pipefail

echo "Checking for CSP-incompatible patterns..."

PATTERNS='onclick=|onload=|onerror=|onsubmit=|onmouseover=|onfocus=|onblur=|eval\(|new Function\(|document\.write\(|javascript:'

# Search in .astro, .tsx, and .ts source files, excluding tests and node_modules
# Exclude lines where the match appears inside a comment (// or /* or *)
MATCHES=$(grep -rn --include='*.astro' --include='*.tsx' --include='*.ts' -E "$PATTERNS" \
    apps/web/src apps/admin/src \
    --exclude-dir=node_modules \
    --exclude-dir=dist \
    --exclude='*.test.*' \
    --exclude='*.spec.*' \
    2>/dev/null | grep -vE ':[0-9]+:\s*(//|/\*|\*)' || true)

if [ -n "$MATCHES" ]; then
    echo "ERROR: CSP-incompatible patterns found:"
    echo "$MATCHES"
    echo ""
    echo "Inline event handlers (onclick, onload, etc.) and eval() are blocked by CSP."
    echo "Use addEventListener() in a <script> tag instead."
    exit 1
fi

echo "No CSP-incompatible patterns found."
