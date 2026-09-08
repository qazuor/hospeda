/**
 * @file publish-eligibility-canonical-predicate.guard.test.ts
 * @description Static guard: nothing under `apps/api/src` decides "may this
 * listing go live?" by comparing a `PublishEligibility` verdict inline
 * (HOS-1183 AC-4).
 *
 * Sibling of
 * `packages/service-core/test/services/accommodation/publish-eligibility-canonical-predicate.guard.test.ts`
 * — same defect class, different package, and each reads only its own `src`.
 *
 * ## Why this side needs its own guard
 *
 * `apps/api` owns the two ends of the verdict: `checkEligibility` PRODUCES it,
 * and the read route SERVES it. That makes this the likeliest place for the
 * rule to be restated — a route that computed `canPublish: eligibility !==
 * 'subscription_required'` would read as obviously correct, agree with the
 * server today, and diverge on the next verdict, which is HOS-1183 exactly.
 *
 * The route must therefore delegate the whole decision to
 * `AccommodationService.getPublishEligibility`, which composes the staff
 * bypass and the shared predicate in the same order `publish()` does. A route
 * that called `checkEligibility` itself would be reproducing that composition
 * from memory.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../src');

/** The read route. Must delegate, never resolve the verdict itself. */
const ELIGIBILITY_ROUTE = 'routes/accommodation/protected/publishEligibility.ts';

/** Every verdict literal, in either quote style. */
const VERDICT_LITERAL = /['"](?:first_publish|has_active_sub|subscription_required)['"]/g;

/** Decision constructs — see the service-core sibling for the rationale. */
const DECISION_CONSTRUCT =
    /(===|!==|==|!=|\bcase\b|\.includes\s*\(|\.has\s*\(|new Set\s*\(|\bswitch\b)/g;

/** How close a literal may sit to a decision construct before they are one expression. */
const DECISION_WINDOW = 60;

/** Strips comments so the guard never fails on prose explaining the rule. */
function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/** Verdict literals in live code sitting next to a decision construct. */
function findHandRolledDecisions(source: string): string[] {
    const liveCode = stripComments(source);
    const decisions = [...liveCode.matchAll(DECISION_CONSTRUCT)].map((m) => m.index ?? -1);
    const found: string[] = [];

    for (const literal of liveCode.matchAll(VERDICT_LITERAL)) {
        const at = literal.index ?? -1;
        if (decisions.some((d) => Math.abs(d - at) <= DECISION_WINDOW)) {
            found.push(
                liveCode
                    .slice(Math.max(0, at - DECISION_WINDOW), at + DECISION_WINDOW)
                    .replace(/\s+/g, ' ')
                    .trim()
            );
        }
    }
    return found;
}

function readSrc(relativePath: string): string {
    return readFileSync(resolve(SRC_ROOT, relativePath), 'utf-8');
}

/**
 * Files allowed to compare against a verdict literal, with the reason. A file
 * that trips the scan and is not listed here fails it.
 */
const DECISION_SCAN_EXCLUSIONS: ReadonlyArray<{
    readonly file: string;
    readonly why: string;
}> = [] as const;

const SCANNED_EXTENSIONS = ['.ts', '.tsx'];

/** Recursively collect source files under a directory, relative to `base`. */
function collectSourceFiles(dir: string, base: string): string[] {
    const found: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = `${dir}/${entry}`;
        if (statSync(full).isDirectory()) {
            found.push(...collectSourceFiles(full, base));
        } else if (SCANNED_EXTENSIONS.some((ext) => entry.endsWith(ext))) {
            found.push(full.slice(base.length + 1));
        }
    }
    return found;
}

describe('HOS-1183 guard: the API serves the verdict, it does not restate it', () => {
    it('the read route delegates to getPublishEligibility', () => {
        expect(
            stripComments(readSrc(ELIGIBILITY_ROUTE)),
            `${ELIGIBILITY_ROUTE} does not call getPublishEligibility. The verdict, the ` +
                'staff bypass and the publish predicate are composed once in the service; ' +
                'a route that assembles them again is the second statement of the rule.'
        ).toMatch(/getPublishEligibility\s*\(/);
    });

    it('the read route does not resolve the verdict itself', () => {
        // checkEligibility answers only the BILLING half. A route calling it
        // directly would then have to add the staff bypass from memory, and
        // forgetting it hides the publish button from platform staff the
        // server would have published.
        expect(
            stripComments(readSrc(ELIGIBILITY_ROUTE)),
            `${ELIGIBILITY_ROUTE} calls checkEligibility directly. Go through ` +
                'AccommodationService.getPublishEligibility so this endpoint and publish() ' +
                'reach their answer by the same steps in the same order.'
        ).not.toMatch(/checkEligibility\s*\(/);
    });

    it('no unreviewed file under src/ hand-rolls a publish decision', () => {
        const allowed = new Set(DECISION_SCAN_EXCLUSIONS.map((e) => e.file));
        const offenders = collectSourceFiles(SRC_ROOT, SRC_ROOT)
            .filter((file) => !allowed.has(file))
            .flatMap((file) =>
                findHandRolledDecisions(readSrc(file)).map((hit) => `${file}: ${hit}`)
            );

        expect(
            offenders,
            'These expressions decide publishability by comparing a verdict inline:\n' +
                `${offenders.map((f) => `  - ${f}`).join('\n')}\n\n` +
                'Route the decision through AccommodationService.getPublishEligibility ' +
                '(or publishEligibilityAllowsPublish in service-core), or add the file to ' +
                'DECISION_SCAN_EXCLUSIONS with the reason it is deliberate.'
        ).toEqual([]);
    });

    it('the resolver may still RETURN verdicts — producing one is not deciding on one', () => {
        // Guards the guard. `accommodation-publish-deps.ts` names all three
        // verdicts because it is the thing that produces them; if the scan
        // above ever started flagging that file, the pattern would have
        // widened from "compares a verdict" to "mentions one" and would be
        // about to be silenced with an exclusion.
        const resolver = 'services/accommodation-publish-deps.ts';
        const source = stripComments(readSrc(resolver));

        expect([...source.matchAll(VERDICT_LITERAL)].length).toBeGreaterThan(0);
        expect(findHandRolledDecisions(readSrc(resolver))).toEqual([]);
    });
});
