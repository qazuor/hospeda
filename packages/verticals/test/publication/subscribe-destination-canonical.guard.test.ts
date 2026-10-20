import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('TEST:V8a:2 canonical predicate guard', () => {
    it('delegates trial guards to evaluateTrialStart without querying trial rows itself', () => {
        const source = readFileSync(
            new URL('../../src/publication/subscribe-destination.ts', import.meta.url),
            'utf8'
        );
        expect(source).toContain('evaluateTrialStart');
        for (const forbidden of [
            'findTrialOfUser',
            'findTrialByPseudonym',
            'findTrialPlan',
            'findActivationEvent'
        ]) {
            expect(source).not.toContain(forbidden);
        }
    });
});
