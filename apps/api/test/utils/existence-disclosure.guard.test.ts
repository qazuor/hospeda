/**
 * Static guard: a route cannot answer an ownership failure in a way that
 * confirms the id exists (HOS-600).
 *
 * The August 2026 smoke found this on three endpoints; sweeping the rest of the
 * API turned up nine more, across two idioms. Twelve call sites is the repo's
 * threshold for a guard rather than twelve patches, and it is the shape the
 * error contract already enforces elsewhere (`ownership.ts` may not answer 403 —
 * `error-contract.guard.test.ts`). This extends the same rule from the ownership
 * middleware to the routes that check ownership themselves.
 *
 * It covers ONE of the two idioms — `row.ownerId !== actor.id` written inline in
 * a route. The other idiom lives in `packages/service-core` permission helpers
 * (`canAccessBookmark`, `checkCanAccessAlert`, ...), which no route-shaped
 * pattern can see; those are pinned by their own service-level tests.
 *
 * Two assertions, deliberately different in kind:
 *
 *   1. STATUS — a branch that compares an entity's owner field to `actor.id`
 *      may not construct a 403. That is the visible half of the leak (users,
 *      media upload/delete, commerce start-subscription).
 *
 *   2. MESSAGE — a route that ALSO delegates existence to `service.getById`
 *      may not hand-write its own not-found string. That is the invisible half:
 *      accommodation, experience and gastronomy each answered 404 NOT_FOUND on
 *      both branches, and leaked purely because the route's literal
 *      (`'Accommodation not found'`) differed from the service's composed
 *      `'accommodation not found'`. A status-only guard is blind to it by
 *      construction, which is exactly why the earlier review passed it.
 *
 * Both assertions are mutation-tested: restoring either original defect fails
 * this file.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROUTES = join(__dirname, '../../src/routes');

/** Every `.ts` under `src/routes/`. */
function collectRouteFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            out.push(...collectRouteFiles(full));
            continue;
        }
        if (full.endsWith('.ts') && !full.endsWith('.d.ts')) {
            out.push(full);
        }
    }
    return out;
}

/** Strips comments so prose describing the old behaviour cannot trip a match. */
function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
}

/**
 * A comparison of a FETCHED ROW's owner column against the caller.
 *
 * The negative lookbehind excludes request-supplied values (`body.userId`,
 * `input.userId`, ...): comparing those to the actor guards who a request may
 * act FOR, not whether a row exists, so a 403 there discloses nothing.
 */
const OWNERSHIP_COMPARISON =
    /(?<!\bbody|\binput|\bparams|\bquery|\bdata)\.(?:ownerId|userId|authorId|createdById)\s*(?:!==|===)\s*actor\??\.id/g;

/**
 * The REFUSAL form of the same comparison: `row.ownerId !== actor.id`.
 *
 * The message assertion uses this narrower shape rather than
 * {@link OWNERSHIP_COMPARISON}. `=== actor.id` also appears as an INCLUSIVE
 * predicate — `media/admin/upload.ts` uses it to decide whether the caller's
 * own photo cap applies — and such a branch refuses nobody, so it has no
 * not-found message to keep consistent with anything.
 */
const OWNERSHIP_REFUSAL =
    /(?<!\bbody|\binput|\bparams|\bquery|\bdata)\.(?:ownerId|userId|authorId|createdById)\s*!==\s*actor\??\.id/;

/** Any way this codebase constructs a 403. */
const FORBIDDEN_ANSWER = /HTTPException\(\s*403|,\s*(?:ctx|c)\s*,\s*403\s*\)|code:\s*'FORBIDDEN'/;

/**
 * How far past the comparison the guard looks for the refusal it introduces.
 * Wide enough to span a log call plus a multi-line response, narrow enough that
 * an unrelated entitlement 403 later in the same file is not attributed to it.
 */
const BRANCH_WINDOW = 700;

/** A hand-written `<something> not found` message. */
const NOT_FOUND_LITERAL = /['"`][A-Za-z][A-Za-z0-9 ]{0,40}not found/;

/** The route asked a service whether the row exists. */
const DELEGATES_EXISTENCE = /\.getById\(\s*actor/;

const routeFiles = collectRouteFiles(ROUTES);

describe('existence disclosure — static guards', () => {
    it('scans a non-empty set of route files', () => {
        // The instrument check. A broken walk would make every assertion below
        // vacuously true and report the same "all clear" as a real pass.
        expect(routeFiles.length).toBeGreaterThan(200);
    });

    it('finds the ownership comparisons it is meant to police', () => {
        // Second instrument check, on the PREDICATE rather than the file list:
        // a regex that silently stops matching (a rename, a refactor to a
        // helper) would also make the guard green while policing nothing.
        //
        // `OWNERSHIP_COMPARISON` carries `/g`, so `.test()` leaves `lastIndex`
        // parked after a hit and the NEXT call would resume mid-string. Count
        // through `matchAll`, which manages its own cursor, rather than
        // remembering to reset one.
        const withOwnership = routeFiles.filter(
            (file) =>
                [...stripComments(readFileSync(file, 'utf8')).matchAll(OWNERSHIP_COMPARISON)]
                    .length > 0
        );

        expect(withOwnership.length).toBeGreaterThanOrEqual(8);
    });

    it('no route answers 403 in a branch that compared a row owner to the actor', () => {
        const offenders: string[] = [];

        for (const file of routeFiles) {
            const code = stripComments(readFileSync(file, 'utf8'));
            for (const match of code.matchAll(OWNERSHIP_COMPARISON)) {
                const start = match.index ?? 0;
                const branch = code.slice(start, start + BRANCH_WINDOW);
                if (FORBIDDEN_ANSWER.test(branch)) {
                    offenders.push(file.replace(ROUTES, 'src/routes'));
                    break;
                }
            }
        }

        expect(offenders).toEqual([]);
    });

    it('no route that delegates existence to a service writes its own not-found message', () => {
        const offenders: string[] = [];

        for (const file of routeFiles) {
            const code = stripComments(readFileSync(file, 'utf8'));
            if (!OWNERSHIP_REFUSAL.test(code)) {
                continue;
            }
            if (!DELEGATES_EXISTENCE.test(code)) {
                // The route owns both branches itself, so there is no second
                // spelling for it to disagree with.
                continue;
            }
            if (NOT_FOUND_LITERAL.test(code)) {
                offenders.push(file.replace(ROUTES, 'src/routes'));
            }
        }

        expect(offenders).toEqual([]);
    });
});
