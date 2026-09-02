/**
 * @fileoverview HOS-1069 guard: every `resolveInitialModerationState()` call
 * site must forward whether the engine actually reached a verdict.
 *
 * The resolver decides `PENDING` for unjudged content by reading `degraded`,
 * and that branch is well covered by unit tests. What no test covers is the
 * WIRING: the line in each service that carries `moderateText().degraded` from
 * the engine to the resolver. Measured during review of `c115237b0` — deleting
 * that single line from `accommodationReview.service.ts` left 11/11 of its own
 * tests green, and deleting it from the other three left 306/306 green. The
 * fix would be silently undone in production for that entity type while CI
 * reported success.
 *
 * A GUARD rather than four integration tests, deliberately, for the reason the
 * repo has hit before: the failure mode is a call site someone ADDS later, and
 * no fixed list of per-service tests covers a service that does not exist yet.
 * This scans whatever call sites are actually in the tree.
 *
 * Why omitting it is invisible: `degraded` is OPTIONAL on the resolver's input,
 * on purpose — an unmigrated caller must keep its old behaviour rather than
 * flood the moderation queue. So dropping it type-checks, lints and passes.
 * The type system cannot catch this one; only this guard can.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVICES_ROOT = path.resolve(__dirname, '../../../src/services');

/**
 * The resolver whose call sites are guarded. Named once so a rename shows up
 * as the "found no call sites" failure below rather than as silent success.
 */
const RESOLVER = 'resolveInitialModerationState';

/**
 * Call sites are expected in these four services today. The guard does not
 * read this list to decide what to scan — it scans everything — but a count
 * dropping below it means either a service stopped resolving moderation state
 * or the scan itself broke.
 */
const MINIMUM_EXPECTED_CALL_SITES = 4;

/** One `resolveInitialModerationState({ ... })` call site as written. */
interface CallSite {
    /** Path relative to `src/services`, for a readable failure message. */
    readonly file: string;
    /** 1-indexed line where the call starts, so the failure is clickable. */
    readonly line: number;
    /** The verbatim object-literal argument, braces excluded. */
    readonly argument: string;
}

/**
 * Every `.ts` file under `src/services`, recursively, excluding declarations.
 *
 * @param params.dir - Absolute directory to walk.
 * @returns Absolute paths, in directory order.
 */
function collectSourceFiles({ dir }: { readonly dir: string }): readonly string[] {
    const found: string[] = [];

    for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) {
            found.push(...collectSourceFiles({ dir: full }));
            continue;
        }
        if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
            found.push(full);
        }
    }

    return found;
}

/**
 * Extracts every call site of the resolver across the service tree.
 *
 * Matches the object literal non-greedily up to the first `})`. Every call site
 * passes a FLAT literal today; a nested one would end the match early, which
 * the shape assertion below turns into a loud failure rather than a skipped
 * call site.
 *
 * @returns Every call site found, in file order.
 */
function extractCallSites(): readonly CallSite[] {
    const pattern = new RegExp(`${RESOLVER}\\(\\{([\\s\\S]*?)\\}\\)`, 'g');
    const sites: CallSite[] = [];

    for (const absolute of collectSourceFiles({ dir: SERVICES_ROOT })) {
        const source = readFileSync(absolute, 'utf8');
        // The resolver's own module defines it and documents it in examples;
        // those are not call sites that wire anything.
        if (absolute.endsWith('review-moderation.helpers.ts')) continue;

        pattern.lastIndex = 0;
        let match = pattern.exec(source);
        while (match !== null) {
            const argument = match[1] ?? '';
            sites.push({
                file: path.relative(SERVICES_ROOT, absolute),
                line: source.slice(0, match.index).split('\n').length,
                argument
            });
            match = pattern.exec(source);
        }
    }

    return sites;
}

describe('HOS-1069 — the degraded flag reaches the resolver from every service', () => {
    const callSites = extractCallSites();

    /**
     * Sanity: a rename, a move, or a regex that stopped matching would leave
     * this guard passing over an empty set, which is the failure mode a guard
     * must never have.
     */
    it(`finds at least ${MINIMUM_EXPECTED_CALL_SITES} call sites to check`, () => {
        expect(callSites.length).toBeGreaterThanOrEqual(MINIMUM_EXPECTED_CALL_SITES);
    });

    it('every call site forwards `degraded`', () => {
        const missing = callSites
            .filter((site) => !/\bdegraded\s*:/.test(site.argument))
            .map((site) => `${site.file}:${site.line}`);

        expect(
            missing,
            `These ${RESOLVER}() call sites do not pass \`degraded\`, so a moderation engine that reached no verdict will publish their content instead of holding it for review (HOS-1069):\n  ${missing.join('\n  ')}`
        ).toEqual([]);
    });

    /**
     * Passing a hard-coded `degraded: false` would satisfy the check above
     * while asserting something the call site cannot know — that the engine
     * answered. Only the literal `false` is refused: a caller with genuinely
     * nothing to moderate says so through a different path (see the empty-text
     * branches, which never reach a real engine result).
     */
    it('no call site hard-codes `degraded: false`', () => {
        const hardcoded = callSites
            .filter((site) => /\bdegraded\s*:\s*false\b/.test(site.argument))
            .map((site) => `${site.file}:${site.line}`);

        expect(
            hardcoded,
            `These call sites claim the engine reached a verdict without asking it:\n  ${hardcoded.join('\n  ')}`
        ).toEqual([]);
    });
});
