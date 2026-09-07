import { describe, expect, it } from 'vitest';

import {
    getNextPendingWelcomeTour,
    getWelcomeToursForRoles,
    WEB_TOURS
} from '../../src/config/tours';

/** A `hasSeen` stub that reports every tour in `seenTourIds` as seen (at its
 * configured version) and everything else as unseen. */
function seenTours(seenTourIds: readonly string[]) {
    return ({ tourId }: { tourId: string; version: number }): boolean =>
        seenTourIds.includes(tourId);
}

const NEVER_SEEN = seenTours([]);

describe('web tours config', () => {
    describe('getWelcomeToursForRoles', () => {
        it('returns no tours for a guest, an empty role set, or a role with no tour', () => {
            expect(getWelcomeToursForRoles({ roles: null })).toEqual([]);
            expect(getWelcomeToursForRoles({ roles: [] })).toEqual([]);
            expect(getWelcomeToursForRoles({ roles: ['GUEST'] })).toEqual([]);
        });

        it('matches on ANY held role, not just the first one (HOS-296)', () => {
            expect(getWelcomeToursForRoles({ roles: ['USER', 'HOST'] }).map((t) => t.id)).toEqual([
                'web.tourist.welcome',
                'web.host.welcome'
            ]);
        });

        it('returns tours in WEB_TOURS declared (priority) order for a multi-hat user (HOS-788)', () => {
            // A HOST who is also a GASTRONOMY_OWNER matches both audiences.
            // The order must not depend on the order roles were passed in.
            const forward = getWelcomeToursForRoles({ roles: ['HOST', 'GASTRONOMY_OWNER'] }).map(
                (t) => t.id
            );
            const reversed = getWelcomeToursForRoles({ roles: ['GASTRONOMY_OWNER', 'HOST'] }).map(
                (t) => t.id
            );
            expect(forward).toEqual(['web.host.welcome', 'web.gastronomy.welcome']);
            expect(reversed).toEqual(forward);
        });

        it.each([
            ['USER', 'web.tourist.welcome'],
            ['HOST', 'web.host.welcome'],
            ['GASTRONOMY_OWNER', 'web.gastronomy.welcome'],
            ['EXPERIENCE_OWNER', 'web.experience.welcome'],
            ['EDITOR', 'web.editor.welcome'],
            ['SPONSOR', 'web.sponsor.welcome']
        ])('role %s matches its own dedicated tour %s', (role, expectedTourId) => {
            const tours = getWelcomeToursForRoles({ roles: [role] });
            expect(tours.map((t) => t.id)).toContain(expectedTourId);
        });
    });

    describe('getNextPendingWelcomeTour', () => {
        it('returns the tourist tour for a plain USER (HOS-788 — the bug this fixes)', () => {
            // Before HOS-788, no tour listed 'USER' at all, so a brand-new
            // signup matched nothing and never saw a first-run tour.
            expect(getNextPendingWelcomeTour({ roles: ['USER'], hasSeen: NEVER_SEEN })?.id).toBe(
                'web.tourist.welcome'
            );
        });

        it('surfaces the host tour once the tourist tour is seen and HOST is granted (HOS-788 core case)', () => {
            // This is the exact scenario the ticket is about: a tourist who
            // already ran the tourist tour later publishes an accommodation.
            // The OLD 'first match wins forever' mechanic could never show
            // them the host tour, because the tourist tour (once it existed)
            // would have "claimed" them on the very first match.
            const hasSeen = seenTours(['web.tourist.welcome']);
            expect(getNextPendingWelcomeTour({ roles: ['USER', 'HOST'], hasSeen })?.id).toBe(
                'web.host.welcome'
            );
        });

        it('returns undefined once every matching tour has been seen', () => {
            const hasSeen = seenTours(['web.tourist.welcome', 'web.host.welcome']);
            expect(getNextPendingWelcomeTour({ roles: ['USER', 'HOST'], hasSeen })).toBeUndefined();
        });

        it('returns undefined for a guest, an empty role set, or a role with no tour', () => {
            expect(getNextPendingWelcomeTour({ roles: null, hasSeen: NEVER_SEEN })).toBeUndefined();
            expect(getNextPendingWelcomeTour({ roles: [], hasSeen: NEVER_SEEN })).toBeUndefined();
            expect(
                getNextPendingWelcomeTour({ roles: ['GUEST'], hasSeen: NEVER_SEEN })
            ).toBeUndefined();
        });

        it('resolves both tours for a multi-role user, one at a time, in priority order (HOS-788)', () => {
            // Mirrors the seeded 'host-commerce@local.test' dual-role fixture
            // (HOST + a commerce vertical): both the host and gastronomy
            // tours apply, and only one is handed out per call — the caller
            // (TourController) re-derives the next one once the first is
            // marked seen, chaining them instead of flattening both into a
            // single run.
            const roles = ['USER', 'HOST', 'GASTRONOMY_OWNER'];

            const first = getNextPendingWelcomeTour({ roles, hasSeen: NEVER_SEEN });
            expect(first?.id).toBe('web.tourist.welcome');

            const second = getNextPendingWelcomeTour({
                roles,
                hasSeen: seenTours(['web.tourist.welcome'])
            });
            expect(second?.id).toBe('web.host.welcome');

            const third = getNextPendingWelcomeTour({
                roles,
                hasSeen: seenTours(['web.tourist.welcome', 'web.host.welcome'])
            });
            expect(third?.id).toBe('web.gastronomy.welcome');

            const none = getNextPendingWelcomeTour({
                roles,
                hasSeen: seenTours([
                    'web.tourist.welcome',
                    'web.host.welcome',
                    'web.gastronomy.welcome'
                ])
            });
            expect(none).toBeUndefined();
        });
    });

    describe('WEB_TOURS content', () => {
        it('keeps DOM selectors aligned with account navigation tour targets for every tour', () => {
            const targetsById: Record<string, readonly string[]> = {
                'web.tourist.welcome': [
                    'center',
                    '[data-tour="favorites"]',
                    '[data-tour="alerts"]',
                    '[data-tour="reviews"]',
                    '[data-tour="inbox"]',
                    '[data-tour="profile"]'
                ],
                'web.host.welcome': [
                    'center',
                    '[data-tour="properties"]',
                    '[data-tour="host-dashboard"]',
                    '[data-tour="messages"]',
                    '[data-tour="promotions"]'
                ],
                'web.gastronomy.welcome': [
                    'center',
                    '[data-tour="commerce"]',
                    '[data-tour="commerce-listings"]',
                    '[data-tour="gastronomy-qr"]',
                    '[data-tour="commerce-views"]'
                ],
                'web.experience.welcome': [
                    'center',
                    '[data-tour="commerce"]',
                    '[data-tour="commerce-listings"]',
                    '[data-tour="commerce-views"]'
                ],
                'web.editor.welcome': [
                    'center',
                    '[data-tour="my-posts"]',
                    '[data-tour="my-events"]'
                ],
                'web.sponsor.welcome': ['center']
            };

            for (const tour of WEB_TOURS) {
                expect(tour.steps.map((step) => step.target)).toEqual(targetsById[tour.id]);
            }
        });

        it('never repeats the profile step outside the tourist tour (HOS-788 dedup rule)', () => {
            // The ticket is explicit: a step that moves into the tourist tour
            // must be removed from the role-specific tours, not duplicated.
            for (const tour of WEB_TOURS) {
                if (tour.id === 'web.tourist.welcome') continue;
                expect(tour.steps.some((step) => step.id === 'profile')).toBe(false);
            }
        });

        it('every tour declares at least one step', () => {
            for (const tour of WEB_TOURS) {
                expect(tour.steps.length).toBeGreaterThan(0);
            }
        });
    });
});
