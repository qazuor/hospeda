#!/usr/bin/env bash
# smoke-test.sh — automated checks from VPS migration spec Fase 15.
#
# Hits each app's health/landing endpoint over HTTPS, validates SSL,
# Cloudflare proxy presence, security headers, and the SSO cookie
# attributes set by Better Auth's crossSubDomainCookies block (6.C).
#
# Usage:
#   scripts/smoke-test.sh                      # checks production hospeda.com.ar
#   scripts/smoke-test.sh staging              # checks staging.hospeda.com.ar
#   APEX=example.com scripts/smoke-test.sh     # custom apex (one-off)
#
# Exit code: 0 = all PASS, 1 = at least one FAIL.

set -u

ENV="${1:-prod}"

case "$ENV" in
    prod|production)
        APEX="${APEX:-hospeda.com.ar}"
        WEB="https://${APEX}"
        WEB_WWW="https://www.${APEX}"
        API="https://api.${APEX}"
        ADMIN="https://admin.${APEX}"
        ;;
    staging)
        APEX="${APEX:-staging.hospeda.com.ar}"
        WEB="https://${APEX}"
        WEB_WWW=""
        API="https://staging-api.hospeda.com.ar"
        ADMIN="https://staging-admin.hospeda.com.ar"
        ;;
    *)
        echo "usage: $0 [prod|staging]" >&2
        exit 2
        ;;
esac

PASS=0
FAIL=0
FAILURES=()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

color() { printf '\033[%sm%s\033[0m' "$1" "$2"; }
green() { color "32" "$1"; }
red()   { color "31" "$1"; }
gray()  { color "90" "$1"; }

pass() {
    PASS=$((PASS + 1))
    printf "  %s %s\n" "$(green "PASS")" "$1"
}

fail() {
    FAIL=$((FAIL + 1))
    FAILURES+=("$1")
    printf "  %s %s\n" "$(red "FAIL")" "$1"
    if [ -n "${2:-}" ]; then
        printf "       %s\n" "$(gray "$2")"
    fi
}

section() { printf "\n%s\n" "$(color '1;36' "▸ $1")"; }

# Fetches headers, follows redirects up to 3 times.
fetch_headers() {
    curl -sSL -I --max-redirs 3 --max-time 15 -o /dev/null -D - "$1" 2>/dev/null
}

http_status() {
    fetch_headers "$1" | awk 'NR==1 {print $2}' | tail -1
}

header_value() {
    fetch_headers "$1" | grep -i "^$2:" | tail -1 | sed -E "s/^[^:]+:[[:space:]]*//I" | tr -d '\r'
}

check_status() {
    local url=$1
    local expected=$2
    local actual
    actual=$(http_status "$url")
    if [ "$actual" = "$expected" ]; then
        pass "$url → $expected"
    else
        fail "$url → expected $expected, got $actual" "headers: $(fetch_headers "$url" | head -3 | tr '\n' '|')"
    fi
}

check_header_present() {
    local url=$1
    local header=$2
    local value
    value=$(header_value "$url" "$header")
    if [ -n "$value" ]; then
        pass "$url has $header: $value"
    else
        fail "$url missing $header header"
    fi
}

check_header_contains() {
    local url=$1
    local header=$2
    local needle=$3
    local value
    value=$(header_value "$url" "$header")
    if echo "$value" | grep -qi "$needle"; then
        pass "$url has $header containing '$needle'"
    else
        fail "$url $header does not contain '$needle'" "got: $value"
    fi
}

# ---------------------------------------------------------------------------
# Section 1 — Connectivity (status codes)
# ---------------------------------------------------------------------------
section "Connectivity ($ENV)"

check_status "${API}/api/v1/health/" "200"
check_status "${WEB}" "200"
check_status "${ADMIN}" "200"

if [ "$ENV" = "prod" ] && [ -n "$WEB_WWW" ]; then
    actual=$(http_status "$WEB_WWW")
    case "$actual" in
        301|308) pass "${WEB_WWW} → ${actual} redirect to apex" ;;
        *)       fail "${WEB_WWW} → expected 301/308 redirect, got $actual" ;;
    esac
fi

# ---------------------------------------------------------------------------
# Section 2 — SSL & Cloudflare proxy
# ---------------------------------------------------------------------------
section "SSL + Cloudflare"

check_header_present "${API}/api/v1/health/" "cf-ray"
check_header_contains "${API}/api/v1/health/" "server" "cloudflare"
check_header_contains "${WEB}" "server" "cloudflare"
check_header_contains "${ADMIN}" "server" "cloudflare"

# ---------------------------------------------------------------------------
# Section 3 — Security headers
# ---------------------------------------------------------------------------
section "Security headers"

# HSTS should be set on all 3 hosts (Cloudflare typically injects it; the
# origin can also set it explicitly).
check_header_present "${API}/api/v1/health/" "strict-transport-security"
check_header_present "${WEB}" "strict-transport-security"
check_header_present "${ADMIN}" "strict-transport-security"

check_header_contains "${WEB}" "x-frame-options" "DENY"
check_header_contains "${WEB}" "x-content-type-options" "nosniff"

# ---------------------------------------------------------------------------
# Section 4 — SSO cookie attributes (Better Auth crossSubDomainCookies)
# ---------------------------------------------------------------------------
section "Better Auth SSO cookie attributes"

# Without going through a full login flow we cannot validate the actual
# session cookie. But we can fetch any auth endpoint that hands back a
# Set-Cookie (e.g. CSRF token) and inspect attributes.
csrf_url="${API}/api/auth/get-session"
cookie_header=$(curl -sSI --max-time 15 "$csrf_url" 2>/dev/null | grep -i '^set-cookie:' || true)
if [ -z "$cookie_header" ]; then
    fail "$csrf_url did not set any cookie" "Set-Cookie header absent on the auth endpoint"
else
    if echo "$cookie_header" | grep -qi "domain=\.\?${APEX}"; then
        pass "Set-Cookie has Domain scoped to ${APEX}"
    else
        fail "Set-Cookie missing Domain=.${APEX}" "got: $(echo "$cookie_header" | head -1)"
    fi
    if echo "$cookie_header" | grep -qi "secure"; then
        pass "Set-Cookie has Secure flag"
    else
        fail "Set-Cookie missing Secure flag"
    fi
    if echo "$cookie_header" | grep -qi "httponly"; then
        pass "Set-Cookie has HttpOnly flag"
    else
        fail "Set-Cookie missing HttpOnly flag"
    fi
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo
TOTAL=$((PASS + FAIL))
if [ "$FAIL" -eq 0 ]; then
    printf "%s %d/%d checks passed\n" "$(green '✓')" "$PASS" "$TOTAL"
    exit 0
fi

printf "%s %d/%d failed\n" "$(red '✗')" "$FAIL" "$TOTAL"
echo
echo "Failures:"
for f in "${FAILURES[@]}"; do
    printf "  - %s\n" "$f"
done
exit 1
