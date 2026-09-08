/**
 * @file publish-eligibility-canonical-predicate.guard.test.ts
 * @description Static guard: every decision of the form "may this listing go
 * live?" must route through `publishEligibilityAllowsPublish`, never a
 * hand-rolled comparison against a {@link PublishEligibility} verdict
 * (HOS-1183 AC-4).
 *
 * Sibling of `apps/api/test/services/publish-eligibility-canonical-predicate.guard.test.ts`
 * — same defect class, same fix, different package. Two guards rather than one
 * because each reads only its own package's `src`, matching the existing
 * `billing-status-gate-canonical-predicate` pair.
 *
 * ## The defect class
 *
 * The rule has two sides. The server denies ONE verdict; the card's publish
 * button was gating on a boolean that meant only `has_active_sub`. When
 * HOS-1012 moved the trial off MercadoPago, the server learned that
 * `first_publish` publishes and the button did not — so the button vanished for
 * exactly the owner the server would have let through.
 *
 * That is not a typo, it is the predictable end state of one rule written in two
 * places. A second inline comparison is how it comes back, so the guard fails on
 * any comparison against a verdict literal outside the predicate's own file.
 *
 * ## Why it flags proximity to a comparison, not the literal alone
 *
 * The literal `'subscription_required'` legitimately appears in live code three
 * ways: the tuple that DEFINES the union, the `ServiceError` reason the API
 * contract requires the route to re-throw, and the resolver RETURNING the
 * verdict. Flagging every occurrence would fail on all of those. What is never
 * legitimate outside the predicate is *comparing* against it — so the scan looks
 * for a verdict literal sitting next to a decision construct (`===`, `!==`,
 * `case`, `.includes(`, `.has(`, `new Set(`, `switch`), which covers the forms a
 * hand-rolled decision can actually take rather than anchoring on one of them.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../src');

/** Where the rule lives. Every other file must call into it. */
const PREDICATE_FILE = 'services/accommodation/accommodation.types.ts';

/**
 * Files that decide publishability, and how many predicate calls each must
 * contain — one per gate. `accommodation.service.ts` has two: `update()`'s
 * ACTIVE-transition guard and `publish()` itself.
 */
const PUBLISH_GATE_FILES = [
    { file: 'services/accommodation/accommodation.service.ts', minCalls: 2 }
] as const;

/** An actual invocation of the canonical predicate, not a mention in prose. */
const PREDICATE_USE = /publishEligibilityAllowsPublish\s*\(/g;

/** Importing the canonical predicate from where it is defined. */
const PREDICATE_IMPORT =
    /publishEligibilityAllowsPublish[\s\S]{0,200}?from\s+['"][^'"]*accommodation\.types['"]/;

/** Every verdict literal, in either quote style. */
const VERDICT_LITERAL = /['"](?:first_publish|has_active_sub|subscription_required)['"]/g;

/**
 * Decision constructs. A verdict literal within {@link DECISION_WINDOW} of any
 * of these is a hand-rolled publish decision.
 *
 * `===`/`!==` are listed before `==`/`!=` in the alternation so the longer form
 * wins; a lone `=` is deliberately absent, because assigning a verdict to a
 * named constant is how the predicate itself is written.
 */
const DECISION_CONSTRUCT =
    /(===|!==|==|!=|\bcase\b|\.includes\s*\(|\.has\s*\(|new Set\s*\(|\bswitch\b)/g;

/**
 * How close a verdict literal may sit to a decision construct before the pair
 * is treated as one expression. 60 characters spans a comparison and its
 * operands without reaching an unrelated adjacent statement — measured against
 * the legitimate occurrences, the nearest of which
 * (`ServiceError(ServiceErrorCode.FORBIDDEN, 'subscription_required')`) has no
 * decision construct anywhere in its statement.
 */
const DECISION_WINDOW = 60;

/**
 * Strips block and line comments before scanning. The docblocks around this
 * change legitimately quote both a verdict and a `===` to explain the rule;
 * scanning prose would make the guard fail on its own explanation.
 */
function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/**
 * Returns every verdict literal in live code that sits within
 * {@link DECISION_WINDOW} characters of a decision construct, with a short
 * excerpt so a failure names the offending expression rather than just the file.
 */
function findHandRolledDecisions(source: string): string[] {
    const liveCode = stripComments(source);
    const decisions = [...liveCode.matchAll(DECISION_CONSTRUCT)].map((m) => m.index ?? -1);
    const found: string[] = [];

    for (const literal of liveCode.matchAll(VERDICT_LITERAL)) {
        const at = literal.index ?? -1;
        const near = decisions.some((d) => Math.abs(d - at) <= DECISION_WINDOW);
        if (near) {
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

describe('HOS-1183 guard: service-core publish gates use the canonical predicate', () => {
    it.each(
        PUBLISH_GATE_FILES.map((f) => f.file)
    )('%s imports publishEligibilityAllowsPublish', (file) => {
        expect(
            readSrc(file),
            `${file} does not import publishEligibilityAllowsPublish from ` +
                'accommodation.types. Publishability must be resolved by the shared ' +
                'predicate so the server and the publish button cannot disagree ' +
                '(HOS-1183 AC-4).'
        ).toMatch(PREDICATE_IMPORT);
    });

    it.each(PUBLISH_GATE_FILES)('$file calls the predicate at least $minCalls time(s)', ({
        file,
        minCalls
    }) => {
        const useCount = [...readSrc(file).matchAll(PREDICATE_USE)].length;
        expect(
            useCount,
            `${file} calls publishEligibilityAllowsPublish only ${useCount} time(s), ` +
                `expected at least ${minCalls}. Every publish gate in this file must ` +
                "route through it — update()'s ACTIVE-transition guard and publish() " +
                'are two separate gates enforcing one rule.'
        ).toBeGreaterThanOrEqual(minCalls);
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
                'That is the two-sided rule updated on one side, which is HOS-1183 itself. ' +
                'Call publishEligibilityAllowsPublish(eligibility), or add the file to ' +
                'DECISION_SCAN_EXCLUSIONS with the reason it is deliberate.'
        ).toEqual([]);
    });

    it('the predicate file itself needs no exclusion — it names the verdicts, never compares them', () => {
        // Not a formality. Both predicates compare against a NAMED constant
        // (PUBLISH_DENIED_ELIGIBILITY / PUBLISH_TRIAL_GRANTING_ELIGIBILITY)
        // rather than an inline literal, which is why the rule's own home does
        // not trip its own scan. Rewriting either as a bare literal comparison
        // would be a regression the scan would then have to be blinded to.
        expect(
            findHandRolledDecisions(readSrc(PREDICATE_FILE)),
            `${PREDICATE_FILE} compares against a verdict literal inline. Assign the ` +
                'verdict to a named constant and compare against that, so the file that ' +
                'defines the rule does not need an exemption from the guard enforcing it.'
        ).toEqual([]);
    });

    it('every scan exclusion still matches the pattern it excuses', () => {
        // An exclusion rots two ways: the file stops containing the pattern and
        // the entry guards nothing, or it is refactored and the entry blindfolds
        // the scan against a future regression in it.
        const stale = DECISION_SCAN_EXCLUSIONS.filter(
            (entry) => findHandRolledDecisions(readSrc(entry.file)).length === 0
        ).map((entry) => entry.file);

        expect(
            stale,
            `Listed in DECISION_SCAN_EXCLUSIONS but no longer matching:\n${stale
                .map((f) => `  - ${f}`)
                .join('\n')}`
        ).toEqual([]);
    });
});
