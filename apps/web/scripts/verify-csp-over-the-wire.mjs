/**
 * @file verify-csp-over-the-wire.mjs
 * @description Over-the-wire regression guard for HOS-74. Boots the built
 * `@astrojs/node` standalone server and asserts, via real HTTP, that every
 * former-prerender content route now carries the `content-security-policy`
 * header on a direct navigation — the exact property source-string unit tests
 * cannot prove (see csp-middleware.test.ts JSDoc).
 *
 * Root cause it guards against (HOS-74): a `prerender = true` route is served
 * as a static file by the standalone server WITHOUT running middleware, so the
 * CSP header set in src/middleware.ts never reaches it. Moving the routes to SSR
 * fixed it; this script fails CI if any of them regresses (or if the middleware
 * stops emitting the header).
 *
 * Usage: build `apps/web` first (`pnpm --filter=hospeda-web build`), then run
 * `node apps/web/scripts/verify-csp-over-the-wire.mjs`. Exits 0 on success,
 * non-zero (with a report) on any failure.
 *
 * Env: reads real values from the process env when present; fills safe
 * placeholders for the production-only monitoring vars so the server boots in a
 * CI runner without real Sentry/PostHog credentials.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname, '..');
const SERVER_ENTRY = resolve(WEB_ROOT, 'dist/server/entry.mjs');

const HOST = '127.0.0.1';
const PORT = Number(process.env.CSP_VERIFY_PORT ?? '4399');
const BASE = `http://${HOST}:${PORT}`;
const BOOT_TIMEOUT_MS = 30_000;

/**
 * Former-prerender content routes that MUST now emit the CSP header (HOS-74).
 * Locale-prefixed `/es/` since middleware enforces trailing slash + locale.
 */
const MUST_HAVE_CSP = [
    '/es/', // SSR baseline (home, already correct — sanity anchor)
    '/es/legal/terminos/',
    '/es/legal/privacidad/',
    '/es/legal/cookies/',
    '/es/nosotros/',
    '/es/preguntas-frecuentes/',
    '/es/contacto/',
    '/es/colaborar/',
    '/es/colaborar/editores/',
    '/es/colaborar/reportar/',
    '/es/colaborar/fotos/',
    '/es/beneficios/',
    '/es/suscriptores/propietarios/',
    '/es/guest/messages/verify-expired/'
];

/**
 * Intentional exception (HOS-74 OQ-3): private, noindex beta docs stay
 * prerendered and are accepted to ship WITHOUT CSP. Asserting its ABSENCE keeps
 * the exception honest — if beta ever starts emitting the header the assumption
 * changed and this should be revisited.
 */
const MUST_NOT_HAVE_CSP = ['/beta/'];

const CSP_HEADER = 'content-security-policy';

const serverEnv = {
    ...process.env,
    NODE_ENV: 'production',
    HOST,
    PORT: String(PORT),
    // Always-required inter-app URLs (safe local defaults if unset).
    HOSPEDA_API_URL: process.env.HOSPEDA_API_URL ?? 'http://localhost:3001',
    HOSPEDA_SITE_URL: process.env.HOSPEDA_SITE_URL ?? BASE,
    HOSPEDA_ADMIN_URL: process.env.HOSPEDA_ADMIN_URL ?? 'http://localhost:3100',
    HOSPEDA_BETTER_AUTH_URL:
        process.env.HOSPEDA_BETTER_AUTH_URL ?? 'http://localhost:3001/api/auth',
    // Production-only requirements — placeholders so the server boots in CI.
    PUBLIC_SENTRY_DSN: process.env.PUBLIC_SENTRY_DSN ?? 'https://placeholder@o0.ingest.sentry.io/0',
    PUBLIC_POSTHOG_KEY: process.env.PUBLIC_POSTHOG_KEY ?? 'phc_placeholder_ci_verify',
    HOSPEDA_REVALIDATION_SECRET:
        process.env.HOSPEDA_REVALIDATION_SECRET ??
        'placeholder_revalidation_secret_for_ci_0123456789'
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Poll the server until it answers (any HTTP status) or the boot timeout hits. */
const waitForServer = async () => {
    const deadline = Date.now() + BOOT_TIMEOUT_MS;
    while (Date.now() < deadline) {
        try {
            await fetch(`${BASE}/es/`, { redirect: 'manual' });
            return true;
        } catch {
            await sleep(400);
        }
    }
    return false;
};

const main = async () => {
    if (!existsSync(SERVER_ENTRY)) {
        console.error(
            `[csp-verify] Build output not found at ${SERVER_ENTRY}.\n            Run \`pnpm --filter=hospeda-web build\` first.`
        );
        process.exit(2);
    }

    console.log(`[csp-verify] Booting standalone server at ${BASE} ...`);
    const server = spawn('node', [SERVER_ENTRY], {
        cwd: WEB_ROOT,
        env: serverEnv,
        stdio: ['ignore', 'inherit', 'inherit']
    });

    let exitCode = 0;
    try {
        const up = await waitForServer();
        if (!up) {
            console.error('[csp-verify] Server did not become reachable in time.');
            process.exit(3);
        }
        console.log('[csp-verify] Server up. Checking routes...\n');

        const failures = [];

        for (const path of MUST_HAVE_CSP) {
            const res = await fetch(`${BASE}${path}`, { redirect: 'manual' });
            const csp = res.headers.get(CSP_HEADER);
            const ok = typeof csp === 'string' && csp.length > 0;
            console.log(
                `  ${ok ? 'OK ' : 'FAIL'}  ${path}  [${res.status}]  csp=${ok ? 'present' : 'MISSING'}`
            );
            if (!ok) {
                failures.push(
                    `${path} → expected CSP header, got: ${csp ?? '(none)'} (status ${res.status})`
                );
            }
        }

        for (const path of MUST_NOT_HAVE_CSP) {
            const res = await fetch(`${BASE}${path}`, { redirect: 'manual' });
            const csp = res.headers.get(CSP_HEADER);
            const ok = csp === null;
            console.log(
                `  ${ok ? 'OK ' : 'WARN'}  ${path}  [${res.status}]  csp=${csp ? 'present (unexpected)' : 'absent (expected)'}`
            );
            if (!ok) {
                failures.push(
                    `${path} → expected NO CSP header (prerender exception), but got one. Revisit HOS-74 OQ-3.`
                );
            }
        }

        console.log('');
        if (failures.length > 0) {
            console.error(`[csp-verify] FAILED (${failures.length}):`);
            for (const f of failures) console.error(`  - ${f}`);
            exitCode = 1;
        } else {
            console.log('[csp-verify] All routes carry the CSP header; beta exception intact. ✓');
        }
    } finally {
        server.kill('SIGTERM');
    }

    process.exit(exitCode);
};

main().catch((err) => {
    console.error('[csp-verify] Unexpected error:', err);
    process.exit(1);
});
