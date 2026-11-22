/**
 * @file verify-zod-jitless-build.mjs
 * @description Post-build check for HOS-2558: no built client chunk may reach
 * the `Function` constructor while it loads.
 *
 * Zod 4 probes `new Function('')` the first time it builds an object schema,
 * unless `jitless` is set. Under the site's CSP (no `unsafe-eval`) the browser
 * reports that probe as a `securitypolicyviolation`, even though Zod swallows
 * the exception. The fix lives in the Vite plugin `zodJitlessClientPlugin`
 * (`integrations/zod-jitless/index.ts`); this script proves it over the
 * REAL production output, which is the only place module order is final.
 *
 * Every `.js` file under `dist/client` is imported in its OWN Node process
 * (Zod caches the probe per realm, so chunks must not share one) with stubbed
 * browser globals and a counting `Function`. A chunk that loads Zod must load
 * with zero `Function` calls. Chunks that cannot load under the stubs are
 * listed, and the script fails if a chunk that contains Zod is among them,
 * because then nothing was proven for it.
 *
 * Usage (after `astro build`): `node scripts/verify-zod-jitless-build.mjs`
 */

import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CHILD_FLAG = '--child';

/**
 * Runs inside the child process: install browser stubs and a counting
 * `Function`, import one chunk, print one JSON line.
 *
 * @param {string} file - Absolute path of the chunk.
 */
async function runChild(file) {
    let functionCalls = 0;
    const RealFunction = globalThis.Function;
    globalThis.Function = new Proxy(RealFunction, {
        construct(target, args, newTarget) {
            functionCalls += 1;
            return Reflect.construct(target, args, newTarget);
        },
        apply(target, thisArg, args) {
            functionCalls += 1;
            return Reflect.apply(target, thisArg, args);
        }
    });

    /** A permissive stand-in: any property is another stand-in, calls return one. */
    const anything = (name) =>
        new Proxy(function stub() {}, {
            get(_target, prop) {
                if (prop === 'then') return undefined;
                if (prop === Symbol.toPrimitive) return () => '';
                if (prop === Symbol.iterator) return function* empty() {};
                if (prop === 'toString') return () => '';
                // Zod skips its probe on a Cloudflare user agent; a stub that is
                // truthy for `.includes()` would hide the probe from this check.
                if (prop === 'userAgent') return 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130';
                return anything(`${name}.${String(prop)}`);
            },
            apply: () => anything(`${name}()`),
            construct: () => anything(`new ${name}`),
            has: () => true
        });

    for (const name of [
        'window',
        'document',
        'navigator',
        'location',
        'history',
        'localStorage',
        'sessionStorage',
        'HTMLElement',
        'customElements',
        'matchMedia',
        'requestAnimationFrame',
        'IntersectionObserver',
        'ResizeObserver',
        'MutationObserver',
        'self'
    ]) {
        try {
            Object.defineProperty(globalThis, name, {
                value: anything(name),
                configurable: true,
                writable: true
            });
        } catch {
            // Some globals (navigator on recent Node) cannot be redefined; keep Node's.
        }
    }

    let error = null;
    try {
        await import(pathToFileURL(file).href);
    } catch (caught) {
        error = caught instanceof Error ? caught.message : String(caught);
    }
    process.stdout.write(
        `${JSON.stringify({
            functionCalls,
            zodLoaded: typeof globalThis.__zod_globalConfig === 'object',
            jitless: globalThis.__zod_globalConfig?.jitless === true,
            error
        })}\n`
    );
    // Timers scheduled by islands would keep the process alive.
    process.exit(0);
}

/** @param {string} dir */
function listJsFiles(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) return listJsFiles(full);
        return entry.name.endsWith('.js') ? [full] : [];
    });
}

/** Parent: spawn one child per chunk and aggregate. */
function runParent() {
    const appDir = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
    const clientDir = join(appDir, 'dist', 'client');
    const files = listJsFiles(clientDir);
    const self = fileURLToPath(import.meta.url);

    const offenders = [];
    const unprovenZod = [];
    let zodChunks = 0;
    let loaded = 0;
    for (const file of files) {
        const rel = file.slice(clientDir.length + 1);
        const run = spawnSync(process.execPath, [self, CHILD_FLAG, file], {
            encoding: 'utf8',
            timeout: 20_000
        });
        const line = (run.stdout ?? '').trim().split('\n').pop() ?? '';
        let report;
        try {
            report = JSON.parse(line);
        } catch {
            report = {
                functionCalls: 0,
                zodLoaded: false,
                error: `no report (${run.signal ?? run.status})`
            };
        }
        const containsZod = readFileSync(file, 'utf8').includes('__zod_globalConfig');
        if (report.zodLoaded) zodChunks += 1;
        if (!report.error) loaded += 1;
        if (report.functionCalls > 0) offenders.push(`${rel} (${report.functionCalls} calls)`);
        if (report.error && containsZod) unprovenZod.push(`${rel}: ${report.error}`);
    }

    console.log(
        `[zod-jitless] ${files.length} client chunks, ${loaded} loaded, ${zodChunks} loaded Zod, ${offenders.length} reached Function`
    );
    for (const offender of offenders) console.error(`  Function reached: ${offender}`);
    for (const unproven of unprovenZod) console.error(`  Zod chunk failed to load: ${unproven}`);
    if (offenders.length > 0 || unprovenZod.length > 0 || zodChunks === 0) {
        if (zodChunks === 0) console.error('  No chunk loaded Zod: the check proved nothing.');
        process.exit(1);
    }
}

if (process.argv[2] === CHILD_FLAG) {
    await runChild(process.argv[3]);
} else {
    runParent();
}
