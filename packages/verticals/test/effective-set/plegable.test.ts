/**
 * TEST:V3:2 (AC:V3:2, `V/15` §2.6, GUARD:G-R2): without a live TITLE that is not
 * a trial, the complements are discarded before folding. An addon `USER` or
 * `GLOBAL` bought with another vertical's subscription, against a vertical whose
 * only title is a trial, does not add; with a subscription in that vertical it
 * does.
 *
 * Type: unit. The discard is a pure function of the live coverage set.
 */
import { describe, expect, it } from 'vitest';
import { foldPlegableSet } from '../../src/effective-set/fold';
import { selectPlegableSources } from '../../src/effective-set/plegable';
import { addon, grant, subscription, trial } from './sources';

const PHOTOS = 'max_photos_per_accommodation';
const trialPhotos = () => trial([grant({ key: PHOTOS, value: 20, strategy: 'SUM' })]);
const subscriptionPhotos = () => subscription([grant({ key: PHOTOS, value: 20, strategy: 'SUM' })]);
const addonPhotos = (scope: 'USER' | 'GLOBAL') =>
    addon({ scope, grants: [grant({ key: PHOTOS, value: 30, strategy: 'SUM' })] });

describe('TEST:V3:2 — without a live non-trial title, the complements are discarded', () => {
    it.each([
        ['USER'] as const,
        ['GLOBAL'] as const
    ])('an addon %s with only a trial title does not add: 20, never 50', (scope) => {
        const folded = foldPlegableSet({
            sources: [trialPhotos(), addonPhotos(scope)]
        });

        expect(folded.get(PHOTOS)).toBe(20);
    });

    it.each([
        ['USER'] as const,
        ['GLOBAL'] as const
    ])('the same addon %s adds once the vertical holds a subscription: 50', (scope) => {
        const folded = foldPlegableSet({
            sources: [subscriptionPhotos(), addonPhotos(scope)]
        });

        expect(folded.get(PHOTOS)).toBe(50);
    });

    it.each([
        ['USER'] as const,
        ['GLOBAL'] as const
    ])('the plegable set keeps TITLE and BASE and drops the %s complement under a trial', (scope) => {
        const complement = addonPhotos(scope);
        const plegable = selectPlegableSources({
            sources: [trialPhotos(), complement]
        });

        expect(plegable).not.toContain(complement);
        expect(plegable).toHaveLength(1);
    });

    it('outside the trial nothing changes: the complement is admitted', () => {
        const complement = addonPhotos('USER');
        const plegable = selectPlegableSources({
            sources: [subscriptionPhotos(), complement]
        });

        expect(plegable).toContain(complement);
        expect(plegable).toHaveLength(2);
    });
});
