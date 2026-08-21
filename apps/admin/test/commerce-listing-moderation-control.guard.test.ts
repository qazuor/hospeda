/**
 * Guard: the commerce detail routes must actually render the reject control
 * (HOS-589 AC-26).
 *
 * The endpoint and the widget can both be perfect while nobody can reach them:
 * deleting the card from a route file is a one-line change that breaks no test,
 * fails no typecheck, and produces a page that looks entirely normal. The whole
 * point of AC-26 is that "a route with no control is reachable only by a
 * hand-crafted request", so the wiring itself needs an assertion.
 *
 * Route files are excluded from the admin unit suite's coverage and are not
 * rendered here (a TanStack file route needs a router), so this reads the
 * source — the same technique `content-state-write-surfaces.guard.test.ts` uses
 * for the post/event list widgets.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROUTES = [
    {
        vertical: 'gastronomy',
        path: '../src/routes/_authed/gastronomies/$id.tsx',
        listingHook: 'useModerateGastronomyMutation',
        reviewHook: 'useModerateGastronomyReviewMutation',
        labelKey: 'admin-entities.entities.gastronomy.singular'
    },
    {
        vertical: 'experience',
        path: '../src/routes/_authed/experiences/$id.tsx',
        listingHook: 'useModerateExperienceMutation',
        reviewHook: 'useModerateExperienceReviewMutation',
        labelKey: 'admin-entities.entities.experience.singular'
    }
] as const;

const readRoute = (relativePath: string): string =>
    readFileSync(join(__dirname, relativePath), 'utf8');

describe('the reject control is present on both commerce detail routes (AC-26)', () => {
    for (const { vertical, path, listingHook, reviewHook, labelKey } of ROUTES) {
        describe(vertical, () => {
            it('renders CommerceListingModerationCard', () => {
                expect(
                    readRoute(path),
                    `The ${vertical} detail route no longer renders CommerceListingModerationCard. Without it POST /:id/moderate is only callable by hand, which is precisely what AC-26 forbids.`
                ).toContain('<CommerceListingModerationCard');
            });

            it('wires the LISTING moderation hook into that card, not the review one', () => {
                const source = readRoute(path);

                // Cut the card's own JSX block before asserting: the route also
                // renders a reviews panel driven by `useModerate*ReviewMutation`,
                // so a whole-file `toContain` would pass on either hook and this
                // guard would be blind to the exact confusion it exists to catch.
                const start = source.indexOf('<CommerceListingModerationCard');
                expect(start, 'card not found').toBeGreaterThan(-1);
                const block = source.slice(start, source.indexOf('/>', start));

                expect(
                    block,
                    `The card must be driven by ${listingHook}. ${reviewHook} moderates reviews written about the listing and would leave the listing itself unmoderatable.`
                ).toContain(listingHook);
                expect(block).not.toContain(reviewHook);
            });

            it('feeds the card the listing name, current state and entity label', () => {
                const source = readRoute(path);
                const start = source.indexOf('<CommerceListingModerationCard');
                const block = source.slice(start, source.indexOf('/>', start));

                // `currentValue` is the one that fails silently: without it the
                // badge renders an em dash and choosing the state it already has
                // is a no-op the admin cannot tell from a broken control.
                expect(block).toContain('currentValue=');
                expect(block).toContain('moderationState');
                expect(block).toContain('entityName=');
                expect(block).toContain(labelKey);
            });
        });
    }
});
