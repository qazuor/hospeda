/**
 * @file auth-session-gate.guard.test.ts
 * @description HOS-1153 — the internal-URL gate must stay unbypassable.
 *
 * `resolveAuthSession` is deliberately dumb: it sends whatever
 * `{ apiUrl, internalRequestSecret }` pair it is handed, so it stays pure and
 * unit-testable without env or a request context. The decision — send the
 * shared secret ONLY over `HOSPEDA_INTERNAL_API_URL` — lives one level up, in
 * `resolveInternalRequestTarget`, and `fetchAuthSession` is the single caller
 * that applies it.
 *
 * That is a structural hole a behavioural test cannot close: a second call site
 * passing the PUBLIC url plus the secret would reopen the leak with the whole
 * suite green, because the `resolveInternalRequestTarget` tests never see that
 * call site. And the leak is not local — `isTrustedInternalRequest` runs at
 * step (0) of `rateLimitMiddleware`, so the secret escaping disables rate
 * limiting for the entire API.
 *
 * So the repo convention applies: a static guard, not N behavioural tests.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = resolve(HERE, '../../src');
const OWNER_FILE = resolve(SRC_DIR, 'lib/auth-session.ts');
const OWNER_SOURCE = readFileSync(OWNER_FILE, 'utf8');

/**
 * Every `.ts`/`.tsx` file under `apps/admin/src`, excluding generated output.
 *
 * @param dir - Directory to walk.
 * @returns Absolute file paths.
 */
function collectSourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            out.push(...collectSourceFiles(full));
            continue;
        }
        // routeTree.gen.ts is generated; it never calls into this module.
        if (entry === 'routeTree.gen.ts') continue;
        if (/\.tsx?$/.test(entry)) out.push(full);
    }
    return out;
}

describe('HOS-1153 guard — the internal-URL gate has exactly one call site', () => {
    it('still exports both halves of the gate', () => {
        // Anchored on the declarations themselves. Without this, renaming
        // either symbol would make every scan below find nothing and the guard
        // would pass while protecting an empty set — a guard anchored on a name
        // must fail loudly on the rename, not go quiet.
        expect(
            OWNER_SOURCE,
            'resolveInternalRequestTarget is gone or renamed — this guard no longer protects what it claims to.'
        ).toMatch(/^export function resolveInternalRequestTarget\(/m);
        expect(
            OWNER_SOURCE,
            'resolveAuthSession is gone or renamed — this guard no longer protects what it claims to.'
        ).toMatch(/^export async function resolveAuthSession\(/m);
    });

    it('is the only module in apps/admin/src that calls resolveAuthSession', () => {
        // Arrange
        const offenders: string[] = [];

        // Act
        for (const file of collectSourceFiles(SRC_DIR)) {
            if (file === OWNER_FILE) continue;
            if (/\bresolveAuthSession\s*\(/.test(readFileSync(file, 'utf8'))) {
                offenders.push(relative(SRC_DIR, file));
            }
        }

        // Assert
        expect(
            offenders,
            `resolveAuthSession sends whatever secret it is given, over whatever URL it is given. A call site outside auth-session.ts bypasses resolveInternalRequestTarget and can put the shared secret on the PUBLIC, Cloudflare-fronted URL — which disables rate limiting for the whole API, not just the admin (HOS-1153). Route the call through fetchAuthSession, or apply resolveInternalRequestTarget at the new site. Offenders: ${offenders.join(', ')}`
        ).toEqual([]);
    });

    it('feeds its own single call from resolveInternalRequestTarget', () => {
        // Arrange: inside the owner file, the one call must receive the gate's
        // output rather than a hand-built pair. Checking the destructure is
        // what makes "the gate ran" visible; asserting the call merely exists
        // would pass on `resolveAuthSession({ apiUrl: publicApiUrl, secret })`.
        const mentions = [...OWNER_SOURCE.matchAll(/\bresolveAuthSession\s*\(/g)].length;
        const declarations = [...OWNER_SOURCE.matchAll(/\bfunction\s+resolveAuthSession\s*\(/g)]
            .length;
        const callCount = mentions - declarations;

        // Assert
        expect(declarations, 'resolveAuthSession must be declared exactly once').toBe(1);
        expect(callCount, 'expected exactly one resolveAuthSession call in its own module').toBe(1);
        expect(
            OWNER_SOURCE,
            'fetchAuthSession must take its apiUrl/secret pair from resolveInternalRequestTarget, not build one itself.'
        ).toMatch(
            /const\s*\{\s*apiUrl,\s*internalRequestSecret\s*\}\s*=\s*resolveInternalRequestTarget\(/
        );
        expect(OWNER_SOURCE).toMatch(
            /return resolveAuthSession\(\{\s*apiUrl,\s*cookieHeader,\s*internalRequestSecret\s*\}\)/
        );
    });
});
