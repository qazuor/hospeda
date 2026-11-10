/**
 * Guard: the venue review moderation view renders the dimensions a reviewer
 * voted (HOS-1877, AC:7:6) and the panel never grows a local dimension list.
 *
 * Why it exists:
 *
 * The API can return `rating` and the helper and component can both be
 * perfect while the panel renders none of it: dropping the one JSX line from
 * the route breaks no test, fails no typecheck, and leaves a page that looks
 * normal. The mirror risk is a second, hand-written dimension list beside the
 * catalog: it drifts the moment `REVIEW_RULES.venue.dimensions` changes, which
 * is exactly what G-FAC-05 forbids. Route files are not rendered here (a
 * TanStack file route needs a router), so this reads the source — the same
 * technique `listing-moderation-control.guard.test.ts` uses.
 *
 * It asserts:
 *  1. the route imports and renders `<VenueReviewDimensions rating={review.rating} />`;
 *  2. the route, the helper and the component name no dimension id as a string
 *     literal and never compare the vertical.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROUTE_PATH = '../src/routes/_authed/venues/$id.tsx';
const HELPER_PATH = '../src/features/venue/config/venue-review-dimensions.ts';
const COMPONENT_PATH = '../src/features/venue/components/VenueReviewDimensions.tsx';

const SCANNED = [
    ['venue detail route', ROUTE_PATH],
    ['venue review dimensions helper', HELPER_PATH],
    ['VenueReviewDimensions component', COMPONENT_PATH]
] as const;

const DIMENSION_IDS = ['food', 'service', 'ambiance', 'value'] as const;

const read = (relativePath: string): string => readFileSync(join(__dirname, relativePath), 'utf8');

/** The `<VenueReviewDimensions … />` JSX block of the route. */
function dimensionsBlock(source: string): string {
    const start = source.indexOf('<VenueReviewDimensions');
    expect(start, 'VenueReviewDimensions is not rendered').toBeGreaterThan(-1);
    const end = source.indexOf('/>', start);
    expect(end, 'VenueReviewDimensions is not self-closing').toBeGreaterThan(-1);
    return source.slice(start, end + 2);
}

describe('TEST:7.5:3 AC:7:6 the venue review moderation view shows the voted dimensions', () => {
    it('imports VenueReviewDimensions and renders it with the review rating', () => {
        const source = read(ROUTE_PATH);

        expect(
            source,
            'The venue detail route does not import VenueReviewDimensions: the moderation panel can never show the breakdown.'
        ).toMatch(/import\s*\{[^}]*VenueReviewDimensions[^}]*\}/);

        expect(
            dimensionsBlock(source),
            'The venue detail route does not feed VenueReviewDimensions the review rating.'
        ).toContain('rating={review.rating}');
    });

    it('keeps no local dimension list and compares no vertical literal', () => {
        for (const [name, path] of SCANNED) {
            const source = read(path);

            for (const id of DIMENSION_IDS) {
                for (const quote of ['"', "'"]) {
                    expect(
                        source,
                        `${name} names the dimension literal ${quote}${id}${quote}: the catalog must stay the single source.`
                    ).not.toContain(`${quote}${id}${quote}`);
                }
            }

            expect(
                source,
                `${name} compares the vertical literal: the catalog decides, not the caller.`
            ).not.toMatch(/(?:===|!==)\s*(['"])venue\1/);
        }
    });
});
