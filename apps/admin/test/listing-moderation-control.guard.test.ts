/**
 * Guard: the listing detail routes render the listing's state card
 * (HOS-589 AC-26; read-only since HOS-1641, Coord-424).
 *
 * The card used to be the reject control: an inline select posting
 * `{ moderationState }` to `POST /:id/moderate`. Since HOS-1641 that column is
 * gone and the endpoint takes a moderation ACTION, so the card shows the
 * listing's `publicationStatus` (where a moderation reads as `MODERATED`) and
 * mutates nothing. The action-based moderation control arrives with HOS-1684;
 * when it lands, this guard goes back to asserting the control.
 *
 * What it asserts now: the card is still on both routes, it is fed
 * `publicationStatus`, and no moderation mutation is wired into it.
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
        entity: 'gastronomy'
    },
    {
        vertical: 'experience',
        path: '../src/routes/_authed/experiences/$id.tsx',
        entity: 'experience'
    }
] as const;

const readRoute = (relativePath: string): string =>
    readFileSync(join(__dirname, relativePath), 'utf8');

/** The `<ListingModerationCard … />` JSX block of a route. */
function cardBlock(source: string): string {
    const start = source.indexOf('<ListingModerationCard');
    expect(start, 'card not found').toBeGreaterThan(-1);
    return source.slice(start, source.indexOf('/>', start) + 2);
}

describe('the listing state card is present on both listing detail routes (AC-26)', () => {
    for (const { vertical, path, entity } of ROUTES) {
        describe(vertical, () => {
            it('renders ListingModerationCard', () => {
                expect(
                    readRoute(path),
                    `The ${vertical} detail route no longer renders ListingModerationCard.`
                ).toContain('<ListingModerationCard');
            });

            it('feeds the card the listing publicationStatus', () => {
                expect(cardBlock(readRoute(path))).toContain(
                    `publicationStatus={${entity}?.publicationStatus}`
                );
            });

            it('wires no moderation mutation and reads no retired column', () => {
                const source = readRoute(path);
                const block = cardBlock(source);
                expect(block).not.toMatch(/useModerate|Mutation|currentValue/);
                expect(source).not.toMatch(/moderationState/);
            });
        });
    }
});
