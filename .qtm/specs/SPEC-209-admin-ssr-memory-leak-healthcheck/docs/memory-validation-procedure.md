# SPEC-209 — Memory Validation Procedure (T-004)

Executable staging procedure to (a) confirm the SSR memory leak before the fix and
(b) validate that the fix holds RSS steady. This document is the gate for the leak fix
(T-009) and the acceptance procedure for AC-2.1 / AC-2.3, executed in T-012.

The admin container starts as `node .output/server/index.mjs` (Nitro `node-server`
preset, `EXPOSE 3000`, `NODE_ENV=production`). All commands below assume the
`hospeda-admin-staging` container on the VPS.

## 0. What we are measuring and why

The leak is driven by `apps/admin/src/routes/__root.tsx`: `RootDocument` builds a
`QueryClient` (line ~207) and a `QZPayBilling` instance (line ~243) inside
`useState(() => ...)`. On the server the root mounts **once per request**, so every SSR
render constructs a fresh `QZPayBilling`. Coolify probes `GET /` every 30 s, each probe
server-renders the root, and the `livemode:true` billing client retains
timers/listeners — producing linear RSS growth (~986 MB in 48 h, ~990
`QZPayBilling initialized` log lines).

Two independent signals, used together (the risk table flags that a heap snapshot alone
can be inconclusive if the retention is native/timer rather than JS heap):

1. **`QZPayBilling initialized` log count** — direct proxy for per-request construction.
   The strongest, cheapest signal. Goes to ~0 on healthcheck traffic once `/healthz`
   (T-002/T-003) is live, and to ~1-per-real-page-load once the `__root` fix (T-009) is in.
2. **RSS slope** — the actual symptom. Must go from monotonic climb to a bounded band.

A heap snapshot is the **optional deep-confirmation** (AC-2.1) used only if the two
signals above disagree or the retained set must be named precisely.

## 1. Primary signal — `QZPayBilling initialized` log count (no code, no redeploy)

```bash
# On the VPS. Count over a fixed window while probes run.
# Adjust the container name / log source to the Coolify/Docker setup.
docker logs hospeda-admin-staging --since 30m 2>&1 \
  | grep -c 'QZPayBilling initialized'
```

- **Before fix, healthcheck = `GET /`**: count climbs ~1 per 30 s (~60 in 30 min).
- **After T-002/T-003 (`/healthz`)**: healthcheck probes contribute **0** new lines.
- **After T-009 (`__root` fix)**: even real page navigations contribute **0** server-side
  lines (billing is client-only); the only `QZPayBilling initialized` lines come from the
  browser, not the SSR process.

Record the count before and after each change. This is the AC-1.2 / AC-2.2 evidence.

## 2. RSS sampling — scripted probe loop (no code, no redeploy)

Sample the admin Node process RSS while driving probe load that mirrors Coolify.

```bash
# --- RSS sampler: logs epoch,rss_kb every 10s for the window ---
# Run inside or against the container; resolve PID of `node .output/server/index.mjs`.
PID=$(pgrep -f '.output/server/index.mjs' | head -1)
for i in $(seq 1 180); do            # 180 * 10s = 30 min
  RSS=$(awk '/VmRSS/{print $2}' /proc/$PID/status)
  echo "$(date +%s),$RSS"
  sleep 10
done | tee /tmp/spec209-rss-$(date +%s).csv
```

Drive load in a second shell, mirroring the Coolify cadence plus some real SSR:

```bash
# Healthcheck cadence (every 30s) — before fix hit `/`, after T-003 hit `/healthz`.
while true; do curl -fs http://localhost:3000/healthz > /dev/null; sleep 30; done &
# Plus periodic real SSR navigation to exercise the __root render path:
while true; do curl -fs http://localhost:3000/ > /dev/null; sleep 15; done &
```

`docker stats --no-stream hospeda-admin-staging` is an acceptable coarse alternative if
`/proc` access is awkward, but `/proc/<pid>/VmRSS` is the precise number.

## 3. Acceptance band (AC-2.3)

Sequence each run as **warmup → measure**:

- **Warmup**: first 3 min (JIT, module cache, first renders settle). Discard.
- **Baseline RSS (`R0`)**: mean RSS over minutes 3-5 after warmup.
- **Measurement window**: 30 min of sustained probe + navigation load (section 2).

**Pass criteria (all three):**

1. **Bounded**: `RSS_max - R0 ≤ 50 MB` across the 30-min window.
2. **No monotonic climb**: least-squares slope of RSS-vs-time over the window
   `< 0.5 MB/min` (≈ < 15 MB over 30 min). A genuine leak shows a clear positive slope;
   a healthy process oscillates around `R0` within GC sawtooth.
3. **Log signal agrees**: `QZPayBilling initialized` count attributable to the SSR
   process over the window is **0** (post-T-009) — see section 1.

**Fail**: any positive sustained slope ≥ 0.5 MB/min, or RSS climbing past `R0 + 50 MB`
without plateauing, or non-zero server-side billing-init count. A fail sends us back to
the heap snapshot (section 4) to name the retained set.

> Numbers (`50 MB`, `0.5 MB/min`, `30 min`, `3 min warmup`) are the starting band derived
> from the observed baseline (linear growth to ~986 MB). Re-baseline `R0` on the actual
> staging container at T-012 and tighten if the post-warmup process proves flatter.

## 4. Heap snapshot — optional deep confirmation (AC-2.1)

Use only if sections 1-3 are ambiguous or the dominant retained set must be named.

**Method A — `--heapsnapshot-signal` (preferred, no app code):** temporarily set the
admin start command on staging to add the flag, redeploy, then signal the process.

```bash
# Coolify: set NODE_OPTIONS or override the start command for the staging admin to:
#   node --heapsnapshot-signal=SIGUSR2 .output/server/index.mjs
# After sustained probe load, trigger a snapshot:
PID=$(pgrep -f '.output/server/index.mjs' | head -1)
kill -USR2 $PID         # writes Heap.<pid>.<seq>.heapsnapshot to the process cwd
# Take a second snapshot ~10 min and ~2000 probes later, then diff the two.
docker cp hospeda-admin-staging:/app/Heap.<pid>.<seq>.heapsnapshot ./
```

Load both snapshots in Chrome DevTools → Memory → Comparison view. The retained set that
grows snapshot-over-snapshot is the leak. Expect `QZPayBilling` instances (and whatever
they retain: timers, listeners, provider-sync closures) to dominate the delta. Revert the
start-command override after capture.

**Method B — `v8.writeHeapSnapshot()` behind a staging-only route:** if the start command
cannot be changed, add a temporary `/__heap` server route (same `server.handlers` shape as
`/healthz`, gated on `NODE_ENV !== 'production'` or a staging-only secret) that calls
`v8.writeHeapSnapshot()` and returns the path. Remove before merge. Method A is preferred
because it adds nothing to the shippable surface.

## 5. Record results

Append a dated entry to this file (and link engram `deploy/vps-memory-pressure`) with:
before/after `QZPayBilling initialized` counts, `R0`, `RSS_max`, the fitted slope, the
pass/fail verdict, and the snapshot delta if section 4 was run. That record is the AC-2.1 /
AC-2.3 sign-off referenced from the PR.
