/**
 * @file deploy-purge-invariants.test.ts
 * @description Static guards for the deploy cache purge (HOS-427 AC-9, AC-10).
 *
 * Two invariants that unit tests cannot express, because both are statements
 * about the WHOLE source tree rather than about one function's behaviour.
 *
 * 1. The Cloudflare purge request is built in exactly ONE module. The dangerous
 *    part of that request is not the URL, it is knowing that Cloudflare answers
 *    some failures with HTTP 200 and `success: false`. A second, hand-rolled
 *    copy that forgot the envelope check would report a purge that evicted
 *    nothing as a success — and would pass its own unit tests happily.
 *
 * 2. The deploy purge can never emit `purge_everything`. `staging.hospeda.com.ar`
 *    and `hospeda.com.ar` are ONE Cloudflare zone and Cloudflare has no
 *    zone-scoped variant of that flag, so a whole-zone flush triggered by a
 *    staging deploy empties production's cache. The namespaced catch-all tag is
 *    the only thing separating the two environments, which makes "this module
 *    only ever purges by tag" a property worth asserting mechanically rather
 *    than trusting to review.
 *
 * @module test/static-guards/deploy-purge-invariants
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { stripComments } from './cacheable-responses-declare-tags';

const WEB_SRC = path.resolve(__dirname, '../../src');

/** The module allowed to talk to Cloudflare's purge API. */
const PURGE_CLIENT = 'lib/cache/cloudflare-purge.ts';

/** The module that runs the deploy purge. */
const DEPLOY_PURGE = 'lib/cache/purge-on-deploy.ts';

/** File extensions this guard inspects. */
const SCANNED_EXTENSIONS = new Set(['.astro', '.ts', '.tsx']);

/** Recursively collect every scannable file under `dir`. */
function collectFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];

    const files: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === 'dist') continue;
            files.push(...collectFiles(full));
            continue;
        }
        if (SCANNED_EXTENSIONS.has(path.extname(entry.name))) files.push(full);
    }
    return files;
}

const ALL_FILES = collectFiles(WEB_SRC);

/** Read a file under `src/`, with comments blanked out so prose is not code. */
function readCode({ file }: { readonly file: string }): string {
    return stripComments({ source: fs.readFileSync(path.join(WEB_SRC, file), 'utf8') });
}

describe('the Cloudflare purge request is built in exactly one place', () => {
    it('scans a non-trivial number of files (the scan itself is not vacuous)', () => {
        expect(ALL_FILES.length).toBeGreaterThan(100);
    });

    it('only the purge client names the Cloudflare purge endpoint', () => {
        const offenders = ALL_FILES.filter((file) => {
            const code = stripComments({ source: fs.readFileSync(file, 'utf8') });
            return code.includes('api.cloudflare.com') || code.includes('purge_cache');
        }).map((file) => path.relative(WEB_SRC, file));

        expect(offenders).toEqual([PURGE_CLIENT]);
    });

    it('the purge client really does contain the envelope check it centralises', () => {
        // Non-vacuity for the assertion above: it is only worth pinning the
        // endpoint to one file if that file is where the subtle check lives.
        const code = readCode({ file: PURGE_CLIENT });

        expect(code).toContain('success');
        expect(code).toContain('rejected');
    });
});

describe('the middleware actually calls the purge', () => {
    // Without this, the entire feature can be deleted and every behavioural test
    // still passes: they all exercise `schedulePurgeOnDeploy()` directly, so
    // nothing notices that no one calls it. The only production symptom would be
    // stale HTML for a TTL after every deploy — silent, delayed, and invisible
    // to CI, which is precisely the failure class this spec exists to remove.
    // Same shape as the `initIconSprite` assertions in test/lib/icon-sprite.test.ts.
    const middleware = fs.readFileSync(path.join(WEB_SRC, 'middleware.ts'), 'utf8');

    it('imports it', () => {
        expect(middleware).toContain(
            "import { schedulePurgeOnDeploy } from './lib/cache/purge-on-deploy'"
        );
    });

    it('invokes it inside the request handler', () => {
        expect(middleware).toMatch(/^\s{4}void schedulePurgeOnDeploy\(\);$/m);
    });

    it('invokes it before the static-asset early return', () => {
        // The static-asset branch returns without reaching the rest of the
        // handler, so a call placed after it would never run for the probe or
        // for any asset request — and could miss the first request entirely.
        const callIndex = middleware.indexOf('void schedulePurgeOnDeploy();');
        const earlyReturnIndex = middleware.indexOf('if (isStaticAssetRoute(');

        expect(callIndex).toBeGreaterThan(-1);
        expect(earlyReturnIndex).toBeGreaterThan(-1);
        expect(callIndex).toBeLessThan(earlyReturnIndex);
    });
});

describe('the deploy purge can never flush the whole zone', () => {
    it.each([
        'purge_everything',
        'purgeEverything',
        "kind: 'everything'"
    ])('never mentions %s', (forbidden) => {
        expect(readCode({ file: DEPLOY_PURGE })).not.toContain(forbidden);
    });

    it('purges by tag, which is what scopes it to this environment', () => {
        // Non-vacuity: "mentions nothing dangerous" would also be true of an
        // empty file. This asserts the safe form is actually present.
        const code = readCode({ file: DEPLOY_PURGE });

        expect(code).toContain("kind: 'tags'");
        expect(code).toContain('buildCatchAllTag');
    });

    it('the forbidden term is detectable at all, in the file that legitimately uses it', () => {
        // Proves the detector is not silently matching nothing: the purge client
        // DOES carry `purge_everything`, because /api/revalidate exposes a
        // deliberate operator escape hatch. If this ever stops matching, the
        // assertions above have quietly become vacuous.
        expect(readCode({ file: PURGE_CLIENT })).toContain('purge_everything');
    });
});
