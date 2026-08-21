/**
 * @file billing-limit-toast-actions.guard.test.ts
 * @description HOS-723 — every consumer of the limit-reached helper forwards
 * BOTH call-to-action slots to its toast.
 *
 * ## Why a static guard and not N behavioural tests
 *
 * Since HOS-723 the helper decides which CTA leads: `action` is the add-on when
 * one raises the limit and the plan upgrade otherwise, and `secondaryAction`
 * carries the demoted plan in the former case. A consumer that forwards only
 * `action` therefore renders the add-on and SILENTLY DROPS the plan upgrade —
 * a toast with a single paid way out and no route to the bigger plan. Nothing
 * about that is a type error (`secondaryAction` is optional on `addToast`), it
 * produces no warning, and it looks entirely reasonable at the call site.
 *
 * That is the shape the repo has been bitten by repeatedly: "a canonical helper
 * exists, and N call sites never adopted it". The failure is about the SET of
 * call sites, not about any one of them, so the assertion has to be about the
 * set too — a behavioural test per consumer proves nothing about the consumer
 * added next month.
 *
 * The scan enumerates call sites from the source rather than from a hand-kept
 * list, so a new one is covered the moment it is written, and it slices ONE
 * `addToast(...)` block per call site: a file-wide `toContain` would be
 * satisfied by any single correct block and blind to a second one that forgot.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_DIR = resolve(__dirname, '../../src');

/**
 * Files that build a limit-reached toast payload. Listed explicitly so the
 * guard fails loudly if one is moved or deleted, rather than quietly scanning
 * nothing and passing.
 */
const KNOWN_CONSUMERS = [
    'components/host/CreatePropertyMiniForm.client.tsx',
    'components/shared/favorite/FavoriteButton.client.tsx',
    // HOS-724. The photo cap is the FIRST consumer where the demoted slot is
    // not hypothetical: `max_photos_per_accommodation` is one of the four
    // limits an add-on raises, so dropping `secondaryAction` here would leave a
    // host who wants the bigger plan with no route to it at all.
    'components/host/editor/use-photo-section.ts'
] as const;

/** `const <name> = buildLimitReachedPayload[FromDetails](` */
const PAYLOAD_ASSIGNMENT = /const\s+(\w+)\s*=\s*buildLimitReachedPayload(?:FromDetails)?\s*\(/g;

/**
 * Returns the source of the first `addToast(...)` call starting at or after
 * `from`, by balancing parentheses. Slicing to the matching close paren is what
 * makes each call site assertable on its own.
 */
function sliceAddToastCall({
    source,
    from
}: {
    readonly source: string;
    readonly from: number;
}): string | null {
    const start = source.indexOf('addToast(', from);

    if (start === -1) {
        return null;
    }

    let depth = 0;

    for (let i = source.indexOf('(', start); i < source.length; i++) {
        const char = source[i];

        if (char === '(') {
            depth++;
        } else if (char === ')') {
            depth--;

            if (depth === 0) {
                return source.slice(start, i + 1);
            }
        }
    }

    return null;
}

describe('HOS-723 guard — limit toasts forward both CTA slots', () => {
    it('finds every known consumer (the scan is not vacuous)', () => {
        for (const relativePath of KNOWN_CONSUMERS) {
            const source = readFileSync(resolve(SRC_DIR, relativePath), 'utf8');

            expect(source).toContain('buildLimitReachedPayload');
        }
    });

    for (const relativePath of KNOWN_CONSUMERS) {
        it(`${relativePath} passes action AND secondaryAction at every call site`, () => {
            const source = readFileSync(resolve(SRC_DIR, relativePath), 'utf8');

            const callSites = [...source.matchAll(PAYLOAD_ASSIGNMENT)];

            // A consumer with zero recognised call sites would pass every
            // assertion below by iterating nothing.
            expect(callSites.length).toBeGreaterThan(0);

            for (const match of callSites) {
                const variable = match[1];
                const call = sliceAddToastCall({
                    source,
                    from: (match.index ?? 0) + match[0].length
                });

                expect(
                    call,
                    `${relativePath}: no addToast(...) call follows \`${variable}\``
                ).not.toBeNull();

                expect(
                    call,
                    `${relativePath}: the toast built from \`${variable}\` must forward ` +
                        '`action` — without it the toast has no CTA at all.'
                ).toContain(`action: ${variable}.action`);

                expect(
                    call,
                    `${relativePath}: the toast built from \`${variable}\` must forward ` +
                        '`secondaryAction` — without it, on the 4 limits an add-on raises, ' +
                        'the plan upgrade is silently dropped and the toast offers only the ' +
                        'add-on.'
                ).toContain(`secondaryAction: ${variable}.secondaryAction`);
            }
        });
    }
});
