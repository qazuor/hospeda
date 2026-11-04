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
import { addon, base, grant, subscription, trial } from './sources';

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

describe('HOS-2027 — a same-vertical SUBSCRIPTION title supersedes the TRIAL', () => {
    const ACCOMMODATIONS = 'max_accommodations';
    const cap = (value: number) => grant({ key: ACCOMMODATIONS, value, strategy: 'SUM' });

    it('BASE + TRIAL(1) + SUBSCRIPTION(1) folds to 1, never 2', () => {
        const folded = foldPlegableSet({
            sources: [base([cap(0)]), trial([cap(1)]), subscription([cap(1)])]
        });

        expect(folded.get(ACCOMMODATIONS)).toBe(1);
    });

    it('the plegable set drops the trial and keeps base and subscription', () => {
        const trialSource = trial([cap(1)]);
        const plegable = selectPlegableSources({
            sources: [base([cap(0)]), trialSource, subscription([cap(1)])]
        });

        expect(plegable).not.toContain(trialSource);
        expect(plegable).toHaveLength(2);
    });

    it('the TRIAL alone still grants its own limit', () => {
        const folded = foldPlegableSet({ sources: [base([cap(0)]), trial([cap(1)])] });

        expect(folded.get(ACCOMMODATIONS)).toBe(1);
    });

    it('the trial contributes again when the subscription title is gone', () => {
        const folded = foldPlegableSet({ sources: [trial([cap(3)])] });

        expect(folded.get(ACCOMMODATIONS)).toBe(3);
    });

    it('an ADDON still adds on top of the subscription while the trial is dropped: 1 + 2 = 3', () => {
        const folded = foldPlegableSet({
            sources: [
                trial([cap(1)]),
                subscription([cap(1)]),
                addon({ scope: 'USER', grants: [cap(2)] })
            ]
        });

        expect(folded.get(ACCOMMODATIONS)).toBe(3);
    });

    it('a subscription of ANOTHER vertical (the inherited Tourist VIP) does not drop the trial', () => {
        const touristTrial = trial([cap(1)]);
        const inherited = { ...subscription([cap(5)]), foreignVertical: true as const };
        const plegable = selectPlegableSources({ sources: [touristTrial, inherited] });

        expect(plegable).toContain(touristTrial);
        expect(foldPlegableSet({ sources: [touristTrial, inherited] }).get(ACCOMMODATIONS)).toBe(6);
    });

    it('a subscription of the trial vertical drops it, even beside an inherited one', () => {
        const ownTrial = trial([cap(1)]);
        const plegable = selectPlegableSources({
            sources: [
                ownTrial,
                subscription([cap(1)]),
                { ...subscription([cap(5)]), foreignVertical: true as const }
            ]
        });

        expect(plegable).not.toContain(ownTrial);
    });
});
