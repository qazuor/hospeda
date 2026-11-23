/**
 * @file verify-zod-jitless-build.mjs
 * @description Post-build check for HOS-2558: no built client chunk may reach
 * the `Function` constructor while it loads, and Zod's `jitless` must be ON in
 * every browser realm that loads Zod.
 *
 * Zod 4 probes `new Function('')` the first time it builds an object schema,
 * unless `jitless` is set. Under the site's CSP (no `unsafe-eval`) the browser
 * reports that probe as a `securitypolicyviolation`, even though Zod swallows
 * the exception. The fix lives in the Vite plugin `zodJitlessClientPlugin`
 * (`integrations/zod-jitless/index.ts`); this script proves it over the
 * REAL production output, which is the only place module order is final.
 *
 * Which chunks are imported (pre-filtered by content, so the run stays short):
 * - the Zod core chunks: the ones whose text holds `__zod_globalConfig`;
 * - every chunk that STATICALLY imports one of them, directly or through other
 *   chunks. Those are the only chunks that can build a schema at load. A chunk
 *   reached only through a dynamic `import()` does not load Zod when imported.
 *
 * Each candidate is imported in its OWN Node process (Zod caches the probe per
 * realm, so chunks must not share one) with stubbed browser globals and a
 * counting `Function`, with bounded parallelism. The run FAILS when:
 * - a chunk reached `Function`;
 * - a chunk loaded Zod with `jitless` off (the plugin is missing or no longer
 *   reaches Zod's core: without this, removing the plugin would leave a green
 *   run whenever the schema-building chunks cannot load under the stubs);
 * - a candidate chunk failed to load (nothing was proven for it);
 * - no chunk loaded Zod at all.
 *
 * Usage (after `astro build`): `node scripts/verify-zod-jitless-build.mjs`
 */

import { spawn } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CHILD_FLAG = '--child';
const ZOD_MARKER = '__zod_globalConfig';
/** Per-chunk ceiling. A chunk loads in well under a second; a hang is a failure. */
const CHUNK_TIMEOUT_MS = 8_000;
/** Concurrent child processes: the runner's cores, capped so a big machine stays polite. */
const CONCURRENCY = Math.max(1, Math.min(availableParallelism(), 8));
/** Static `import ... from "./x.js"`, `export ... from "./x.js"` and bare `import "./x.js"`. */
const STATIC_IMPORT =
    /(?:\bimport|\bexport)\s*(?:[\w*${}\s,]+?\s*from\s*)?["'](\.{1,2}\/[^"']+\.js)["']/g;

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
        'self',
        // `CSS.supports`/`CSS.escape`, and Leaflet's `L`, read at load by map and form islands.
        'CSS',
        'L'
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
            zodLoaded: typeof globalThis[ZOD_MARKER] === 'object',
            jitless: globalThis[ZOD_MARKER]?.jitless === true,
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

/**
 * Picks the chunks worth importing: the Zod core chunks and every chunk that
 * statically reaches one of them.
 *
 * @param {readonly string[]} files - Absolute paths of every client chunk.
 * @returns {{ readonly core: ReadonlySet<string>, readonly candidates: readonly string[] }}
 */
function selectZodChunks(files) {
    const sources = new Map(files.map((file) => [file, readFileSync(file, 'utf8')]));
    const core = new Set(files.filter((file) => sources.get(file)?.includes(ZOD_MARKER)));
    /** @type {Map<string, string[]>} */
    const importers = new Map();
    for (const [file, source] of sources) {
        for (const match of source.matchAll(STATIC_IMPORT)) {
            const target = resolve(dirname(file), match[1]);
            if (!sources.has(target)) continue;
            const list = importers.get(target) ?? [];
            list.push(file);
            importers.set(target, list);
        }
    }
    const reached = new Set(core);
    const queue = [...core];
    while (queue.length > 0) {
        const next = queue.pop();
        for (const importer of importers.get(next) ?? []) {
            if (reached.has(importer)) continue;
            reached.add(importer);
            queue.push(importer);
        }
    }
    return { core, candidates: files.filter((file) => reached.has(file)) };
}

/**
 * Imports one chunk in a fresh process and returns its report.
 *
 * @param {string} self - This script's path.
 * @param {string} file - The chunk.
 */
function probeChunk(self, file) {
    return new Promise((done) => {
        const child = spawn(process.execPath, [self, CHILD_FLAG, file], {
            stdio: ['ignore', 'pipe', 'ignore']
        });
        let stdout = '';
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (chunk) => {
            stdout += chunk;
        });
        const timer = setTimeout(() => child.kill('SIGKILL'), CHUNK_TIMEOUT_MS);
        child.on('close', (code, signal) => {
            clearTimeout(timer);
            const line = stdout.trim().split('\n').pop() ?? '';
            try {
                done(JSON.parse(line));
            } catch {
                done({
                    functionCalls: 0,
                    zodLoaded: false,
                    jitless: false,
                    error: `no report (${signal ?? code})`
                });
            }
        });
    });
}

/** Parent: probe the candidate chunks with bounded parallelism and aggregate. */
async function runParent() {
    const started = Date.now();
    const appDir = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
    const clientDir = join(appDir, 'dist', 'client');
    const files = listJsFiles(clientDir);
    const self = fileURLToPath(import.meta.url);
    const { core, candidates } = selectZodChunks(files);

    const reports = new Map();
    let cursor = 0;
    const worker = async () => {
        while (cursor < candidates.length) {
            const file = candidates[cursor];
            cursor += 1;
            reports.set(file, await probeChunk(self, file));
        }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    const rel = (file) => file.slice(clientDir.length + 1);
    const offenders = [];
    const jitlessOff = [];
    const failed = [];
    let zodChunks = 0;
    for (const file of candidates) {
        const report = reports.get(file);
        if (report.zodLoaded) zodChunks += 1;
        if (report.functionCalls > 0)
            offenders.push(`${rel(file)} (${report.functionCalls} calls)`);
        if (report.zodLoaded && report.jitless !== true) jitlessOff.push(rel(file));
        if (report.error) failed.push(`${rel(file)}: ${report.error}`);
    }

    console.log(
        `[zod-jitless] ${files.length} client chunks, ${core.size} Zod core, ${candidates.length} probed ` +
            `(x${CONCURRENCY}), ${zodChunks} loaded Zod, ${offenders.length} reached Function, ` +
            `${jitlessOff.length} without jitless, ${failed.length} failed to load, ` +
            `${((Date.now() - started) / 1000).toFixed(1)}s`
    );
    for (const offender of offenders) console.error(`  Function reached: ${offender}`);
    for (const chunk of jitlessOff) console.error(`  Zod loaded with jitless OFF: ${chunk}`);
    for (const failure of failed) console.error(`  Zod chunk failed to load: ${failure}`);
    if (zodChunks === 0) console.error('  No chunk loaded Zod: the check proved nothing.');
    if (offenders.length > 0 || jitlessOff.length > 0 || failed.length > 0 || zodChunks === 0) {
        process.exit(1);
    }
}

if (process.argv[2] === CHILD_FLAG) {
    await runChild(process.argv[3]);
} else {
    await runParent();
}
