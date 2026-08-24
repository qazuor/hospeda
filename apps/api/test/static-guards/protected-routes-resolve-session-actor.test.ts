/**
 * @file protected-routes-resolve-session-actor.test.ts
 * @description Static guard for HOS-786.
 *
 * A route under `src/routes/<entity>/protected/` is, by definition, reached
 * with a session. If its handler builds its actor with `createGuestActor()` the
 * session is discarded and every permission/visibility check downstream runs as
 * an anonymous reader — which does not fail loudly, it degrades: a DRAFT or
 * PRIVATE row answers NOT_FOUND and the UI paints an empty list.
 *
 * That is exactly how `accommodation/protected/getFaqs.ts` shipped (it was the
 * public route, copied). One route forgot the gate, so this is a guard rather
 * than one more per-route test: the next copy-paste has to fail here.
 *
 * The detector is anchored on the imported binding `createGuestActor` — the
 * unavoidable token — not on a comment or a call shape a rewrite could dodge.
 *
 * @module test/static-guards/protected-routes-resolve-session-actor
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROUTES_ROOT = path.resolve(__dirname, '../../src/routes');
const GUEST_ACTOR_FACTORY = 'createGuestActor';

interface Offense {
    readonly file: string;
    readonly line: number;
}

/**
 * Collects every `.ts` file that lives inside a `protected/` segment under
 * `src/routes`.
 *
 * @param dir - Directory to walk.
 * @returns Absolute paths of the protected route modules found.
 */
function collectProtectedRouteFiles(dir: string): readonly string[] {
    if (!fs.existsSync(dir)) return [];

    const files: string[] = [];

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            files.push(...collectProtectedRouteFiles(fullPath));
            continue;
        }

        if (!entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts')) continue;
        if (!path.relative(ROUTES_ROOT, fullPath).split(path.sep).includes('protected')) continue;

        files.push(fullPath);
    }

    return files;
}

/**
 * Finds every line in a protected route module that names the guest-actor
 * factory.
 *
 * @param file - Absolute path of the module to inspect.
 * @returns One offense per offending line.
 */
function inspectFile(file: string): readonly Offense[] {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    const offenses: Offense[] = [];

    lines.forEach((line, index) => {
        if (line.includes(GUEST_ACTOR_FACTORY)) {
            offenses.push({ file: path.relative(ROUTES_ROOT, file), line: index + 1 });
        }
    });

    return offenses;
}

describe('HOS-786 static guard — protected routes must resolve the session actor', () => {
    const files = collectProtectedRouteFiles(ROUTES_ROOT);

    it('finds protected route modules to scan', () => {
        expect(files.length).toBeGreaterThan(50);
    });

    it(`no protected route builds its actor with ${GUEST_ACTOR_FACTORY}()`, () => {
        const offenses = files.flatMap((file) => inspectFile(file));

        expect(
            offenses,
            [
                `${offenses.length} protected route(s) discard the session actor.`,
                'Use `getActorFromContext(c)` instead — see HOS-786.',
                ...offenses.map((offense) => `  ${offense.file}:${offense.line}`)
            ].join('\n')
        ).toEqual([]);
    });
});
