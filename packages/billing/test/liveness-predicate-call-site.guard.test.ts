import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '../../..');

const stripComments = (source: string): string =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/**
 * Pin the surviving commerce call site to its granting-status predicate.
 */
const VERTICAL_GATES = [
    {
        vertical: 'commerce listing visibility',
        file: 'packages/service-core/src/services/commerce/commerce-visibility.ts',
        predicate: 'isEntitlementGrantingStatus',
        notThisOne: 'isSubscriptionLive'
    }
] as const;

describe('HOS-1310 Part 2: the two vertical gates, pinned', () => {
    it.each(VERTICAL_GATES)('$vertical resolves liveness through $predicate', ({
        file,
        predicate,
        notThisOne
    }) => {
        const liveCode = stripComments(readFileSync(resolve(REPO_ROOT, file), 'utf-8'));

        expect(
            liveCode,
            `${file} no longer calls ${predicate}. If this is the HOS-1310 unification ` +
                'landing, that is a product decision and this guard is the place to record ' +
                `it: update both entries together, and say in the commit which criterion ` +
                'won and why an elapsed period does (or does not) still grant access.'
        ).toMatch(new RegExp(`\\b${predicate}\\s*\\(`));

        expect(
            liveCode,
            `${file} now calls ${notThisOne} as well. Calling both is how the two gates ` +
                'quietly converge on an unreviewed third answer — HOS-1275 composed them ' +
                'deliberately in ONE file and documented why at length; do the same here ' +
                'or unify them properly.'
        ).not.toMatch(new RegExp(`\\b${notThisOne}\\s*\\(`));
    });
});
