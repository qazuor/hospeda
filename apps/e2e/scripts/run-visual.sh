#!/usr/bin/env bash
# Runs the Mi Cuenta visual-regression suite (HOS-2471) with the browser served
# from the pinned Playwright Docker image, so screenshots render with the same
# Chromium build and the same fonts locally and in CI.
#
#   bash scripts/run-visual.sh                       # compare against baselines
#   bash scripts/run-visual.sh --update-snapshots=changed   # regenerate changed + missing baselines
#
# Any extra argument is passed to `playwright test` (e.g. a file or --grep).
#
# How it works:
#   1. Resolves the installed @playwright/test version and picks the image
#      mcr.microsoft.com/playwright:v<version>-noble (client and server must be
#      the same version, and the image tag is what pins the browser + fonts).
#   2. Starts `playwright run-server` inside that image on the host network,
#      mounting the repo read-only so the server runs the repo's own CLI.
#   3. Runs `playwright test -c playwright.visual.config.ts` on the host,
#      connected to that server. The app servers boot (or are reused) exactly
#      as in the rest of the suite.
#   4. Stops the container on exit, whatever the outcome.
#
# Must run with cwd = apps/e2e (the package scripts do). Requires Docker.
set -euo pipefail

E2E_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "${E2E_DIR}/../.." && pwd)"
PLAYWRIGHT_BIN="${E2E_DIR}/node_modules/.bin/playwright"
PORT="${HOSPEDA_E2E_VISUAL_PORT:-18094}"
CONTAINER="hospeda-e2e-visual-${PORT}"

if ! command -v docker >/dev/null 2>&1; then
    echo "run-visual: docker is required (the baselines only match the pinned Playwright image)." >&2
    exit 1
fi

VERSION="$("${PLAYWRIGHT_BIN}" --version | awk '{print $2}')"
if [[ -z "${VERSION}" ]]; then
    echo "run-visual: could not resolve the @playwright/test version." >&2
    exit 1
fi
IMAGE="mcr.microsoft.com/playwright:v${VERSION}-noble"

cleanup() {
    docker rm -f "${CONTAINER}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# A leftover container from an interrupted run would hold the port.
cleanup

echo "run-visual: starting ${IMAGE} (run-server on 127.0.0.1:${PORT})"
docker run --detach --rm --init --ipc=host --network host \
    --name "${CONTAINER}" \
    --volume "${REPO_ROOT}:${REPO_ROOT}:ro" \
    --workdir "${E2E_DIR}" \
    "${IMAGE}" \
    "${PLAYWRIGHT_BIN}" run-server --port "${PORT}" --host 127.0.0.1 >/dev/null

# Wait until the server accepts connections (60s ceiling; the first run on a
# machine also pays the image pull, which `docker run` already finished).
for _ in $(seq 1 60); do
    if (exec 3<>"/dev/tcp/127.0.0.1/${PORT}") 2>/dev/null; then
        break
    fi
    if ! docker inspect "${CONTAINER}" >/dev/null 2>&1; then
        echo "run-visual: the Playwright server container exited before listening." >&2
        exit 1
    fi
    sleep 1
done
if ! (exec 3<>"/dev/tcp/127.0.0.1/${PORT}") 2>/dev/null; then
    echo "run-visual: the Playwright server never listened on ${PORT}." >&2
    docker logs "${CONTAINER}" >&2 || true
    exit 1
fi

export HOSPEDA_E2E_VISUAL_WS_ENDPOINT="ws://127.0.0.1:${PORT}/"
cd "${E2E_DIR}"
"${PLAYWRIGHT_BIN}" test --config playwright.visual.config.ts "$@"
