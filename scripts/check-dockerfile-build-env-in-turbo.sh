#!/usr/bin/env bash
# check-dockerfile-build-env-in-turbo.sh
#
# HOS-1949 -- guard that every build-time ARG a Dockerfile declares for the
# bundler is visible to `turbo run build`.
#
# Why: the app Dockerfiles do `ARG VITE_X` -> `ENV VITE_X=$VITE_X` ->
# `pnpm turbo run build`. Turbo runs tasks in strict env mode: a task sees only
# the variables listed in turbo.json `globalEnv` / a task's `env` (plus what it
# infers for a detected framework). Anything else is silently dropped before
# Vite/Astro runs, so `import.meta.env.VITE_X` compiles to `void 0` and nothing
# errors. Measured in the deployed prod and staging admin bundles: six VITE_*
# vars (Sentry environment/project/CSP report URI, Turnstile site key, PostHog
# key/host) were dead for months.
#
# What is checked (ARG names in apps/*/Dockerfile):
#   - `VITE_*` and `PUBLIC_*`: every one, in every app Dockerfile. These are the
#     prefixes Vite/Astro INLINE into client bundles at build time, so a miss is
#     invisible at runtime.
#   - `HOSPEDA_*`: only in the admin and web Dockerfiles. Their builds read
#     HOSPEDA_* at build time (URLs, git SHA). The API Dockerfile is skipped: it
#     reads HOSPEDA_* at runtime from the container environment, never from the
#     build, so requiring them in turbo.json would only churn the cache.
# Not checked: unprefixed ARGs (SOURCE_COMMIT, build-tool credentials, ...)
# which are consumed by tools or the Dockerfile itself, not by the bundler's env.
#
# A name is covered when turbo.json `globalEnv` or any `tasks.*.env` has the exact
# name or a wildcard (`*`) pattern matching it and no `!`-negation excludes it.
#
# To resolve a failure: add the name (or a wildcard that covers it) to turbo.json
# `globalEnv`. Prefer the `VITE_*` / `PUBLIC_*` wildcards already there.

set -eu

TURBO_JSON="turbo.json"

if [[ ! -f "$TURBO_JSON" ]]; then
    echo "Skipped -- $TURBO_JSON not found."
    exit 0
fi

node - "$TURBO_JSON" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const turbo = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const patterns = [...(turbo.globalEnv ?? [])];
for (const task of Object.values(turbo.tasks ?? {})) {
    patterns.push(...(task.env ?? []));
}

const toRegex = (pattern) =>
    new RegExp(`^${pattern.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
const positive = patterns.filter((p) => !p.startsWith('!')).map(toRegex);
const negative = patterns.filter((p) => p.startsWith('!')).map((p) => toRegex(p.slice(1)));
const isCovered = (name) => positive.some((r) => r.test(name)) && !negative.some((r) => r.test(name));

const clientApps = new Set(['admin', 'web']);
const failures = [];
let checked = 0;

for (const app of fs.readdirSync('apps')) {
    const dockerfile = path.join('apps', app, 'Dockerfile');
    if (!fs.existsSync(dockerfile)) continue;
    const lines = fs.readFileSync(dockerfile, 'utf8').split('\n');
    const seen = new Set();
    lines.forEach((line, i) => {
        const match = /^\s*ARG\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(line);
        if (!match) return;
        const name = match[1];
        const guarded =
            name.startsWith('VITE_') ||
            name.startsWith('PUBLIC_') ||
            (name.startsWith('HOSPEDA_') && clientApps.has(app));
        if (!guarded || seen.has(name)) return;
        seen.add(name);
        checked += 1;
        if (!isCovered(name)) failures.push(`${dockerfile}:${i + 1}  ARG ${name}`);
    });
}

if (failures.length > 0) {
    console.error('Dockerfile build ARGs not visible to turbo (strict env mode drops them):');
    for (const f of failures) console.error(`  ${f}`);
    console.error('\nAdd each name, or a covering wildcard, to turbo.json "globalEnv". See HOS-1949.');
    process.exit(1);
}
console.log(`OK -- ${checked} build ARGs across apps/*/Dockerfile are covered by turbo.json env config.`);
NODE
