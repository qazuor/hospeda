/**
 * Guard: the three listing detail routes render a FUNCTIONAL listing moderation
 * control (HOS-589 AC-26; read-only under HOS-1641, Coord-424; the control is
 * back since HOS-1684).
 *
 * Why it exists:
 *
 * The endpoint and the widget can both be perfect while nobody can reach them:
 * deleting the card from a route file is a one-line change that breaks no test,
 * fails no typecheck, and produces a page that looks entirely normal. The whole
 * point of AC-26 is that "a route with no control is reachable only by a
 * hand-crafted request", so the wiring itself needs an assertion.
 *
 * HOS-1641 left the card read-only (its select posted `{ moderationState }`, a
 * body the action-based `POST /:id/moderate` refused with 400) and this guard
 * temporarily forbade any mutation. HOS-1684 gives the panel the four actions
 * (`REQUEST_FIX`, `TAKE_DOWN`, `LIFT`, `CLOSE_FIX_REQUEST`) on accommodations,
 * venue listings and experiences, so the guard demands the control again:
 *
 * 1. every route renders `<ListingModerationCard`;
 * 2. its JSX block passes the route's own `vertical`, `entityId={id}` and the
 *    listing's `publicationStatus`;
 * 3. the block is not driven by the REVIEW moderation hooks (the routes also
 *    render the review panel, so a whole-file `toContain` would pass on either
 *    hook and be blind to the exact confusion this guard exists to catch), and
 *    no route reads the retired `moderationState` column;
 * 4. the card is wired to `useModerateListingMutation`, gated by
 *    `LISTING_MODERATE` and opens `<ListingModerationActionDialog`; the hook
 *    posts to `/moderate` and validates the answer;
 * 5. none of them names a retired `*_MODERATION_CHANGE` permission (AC:V6:12:
 *    one moderation permission).
 *
 * Route files are excluded from the admin unit suite's coverage and are not
 * rendered here (a TanStack file route needs a router), so this reads the
 * source — the same technique `content-state-write-surfaces.guard.test.ts` uses
 * for the post/event list widgets.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROUTES = [
    {
        vertical: 'accommodation',
        path: '../src/routes/_authed/accommodations/$id.tsx',
        blockStatus: 'publicationStatus={publicationStatus}',
        fileStatus: 'publicationStatus={accommodation.publicationStatus}'
    },
    {
        vertical: 'venue',
        path: '../src/routes/_authed/venues/$id.tsx',
        blockStatus: 'publicationStatus={venue?.publicationStatus}',
        fileStatus: null
    },
    {
        vertical: 'experience',
        path: '../src/routes/_authed/experiences/$id.tsx',
        blockStatus: 'publicationStatus={experience?.publicationStatus}',
        fileStatus: null
    }
] as const;

const CARD_PATH = '../src/features/listing/components/ListingModerationCard.tsx';
const ACTIONS_PATH = '../src/features/listing/components/ListingModerationActions.tsx';
const DIALOG_PATH = '../src/features/listing/components/ListingModerationActionDialog.tsx';
const HOOK_PATH = '../src/features/listing/hooks/useModerateListingMutation.ts';

const RETIRED_PERMISSIONS = [
    'ACCOMMODATION_MODERATION_CHANGE',
    'VENUE_MODERATION_CHANGE',
    'EXPERIENCE_MODERATION_CHANGE'
] as const;

const read = (relativePath: string): string => readFileSync(join(__dirname, relativePath), 'utf8');

/** The card's source, plus its `ListingModerationActions` sibling if it was split out. */
function cardSource(): string {
    return existsSync(join(__dirname, ACTIONS_PATH))
        ? `${read(CARD_PATH)}\n${read(ACTIONS_PATH)}`
        : read(CARD_PATH);
}

/** The `<ListingModerationCard … />` JSX block of a route. */
function cardBlock(source: string): string {
    const start = source.indexOf('<ListingModerationCard');
    expect(start, 'card not found').toBeGreaterThan(-1);
    return source.slice(start, source.indexOf('/>', start) + 2);
}

describe('TEST:1684:5 AC-1684:3 the moderation card is on the three detail routes (AC-26)', () => {
    for (const { vertical, path, blockStatus, fileStatus } of ROUTES) {
        describe(vertical, () => {
            it('renders ListingModerationCard', () => {
                expect(
                    read(path),
                    `The ${vertical} detail route no longer renders ListingModerationCard: the listing cannot be moderated from the panel, and nothing else fails.`
                ).toContain('<ListingModerationCard');
            });

            it('feeds the card its vertical, the listing id and its publicationStatus', () => {
                const source = read(path);
                const block = cardBlock(source);
                expect(
                    block,
                    `The ${vertical} card does not say vertical="${vertical}": its actions would hit another vertical's route.`
                ).toContain(`vertical="${vertical}"`);
                expect(
                    block,
                    `The ${vertical} card is not fed entityId={id}: its actions would moderate another listing.`
                ).toContain('entityId={id}');
                expect(
                    block,
                    `The ${vertical} card is not fed the listing's publicationStatus: it would offer no action at all.`
                ).toContain(blockStatus);
                if (fileStatus) {
                    expect(
                        source,
                        `The ${vertical} page does not pass the loaded publicationStatus down to the card.`
                    ).toContain(fileStatus);
                }
            });

            it('gates purge and edit from the loaded publication state', () => {
                const source = read(path);
                const purge = source.slice(
                    source.indexOf('<ListingPurgeOnRequestCard'),
                    source.indexOf('/>', source.indexOf('<ListingPurgeOnRequestCard')) + 2
                );
                expect(purge).toMatch(/publicationStatus=/);
                expect(source).toContain('canEditListing(');
            });

            it('is not driven by the review moderation hooks and reads no retired column', () => {
                const source = read(path);
                expect(
                    cardBlock(source),
                    `The ${vertical} card is wired to a REVIEW moderation hook instead of the listing one.`
                ).not.toMatch(/ReviewMutation|currentValue/);
                expect(
                    source,
                    `The ${vertical} route reads the retired moderationState column (gone since HOS-1641).`
                ).not.toMatch(/moderationState/);
            });
        });
    }
});

describe('TEST:1684:5 AC-1684:3 the card is a functional control, not a read-only badge', () => {
    it('posts through useModerateListingMutation, gated by LISTING_MODERATE, via its dialog', () => {
        const source = cardSource();
        // The CALL, not the name: an import kept beside a local stub would
        // still contain the name while the buttons post nothing.
        expect(
            source,
            'ListingModerationCard does not call useModerateListingMutation(): its buttons would post nothing.'
        ).toMatch(/=\s*useModerateListingMutation\(\)/);
        expect(
            source,
            'ListingModerationCard is not gated by PermissionEnum.LISTING_MODERATE, the single moderation permission.'
        ).toContain('PermissionEnum.LISTING_MODERATE');
        expect(
            source,
            'ListingModerationCard does not open ListingModerationActionDialog: no action can carry its reason.'
        ).toContain('<ListingModerationActionDialog');
    });

    it('the hook posts to /moderate and validates the answer', () => {
        const hook = read(HOOK_PATH);
        expect(hook, 'useModerateListingMutation does not call the /moderate route.').toContain(
            '/moderate'
        );
        expect(
            hook,
            'useModerateListingMutation does not parse the answer with ListingModerationResponseSchema: a malformed answer would be shown as a state.'
        ).toContain('ListingModerationResponseSchema');
        expect(
            hook,
            'useModerateListingMutation mentions moderationState, the retired body the route refuses with 400.'
        ).not.toMatch(/moderationState/);
    });

    it('no part of the control names a retired *_MODERATION_CHANGE permission (AC:V6:12)', () => {
        const sources = [
            ['ListingModerationCard', cardSource()],
            ['ListingModerationActionDialog', read(DIALOG_PATH)],
            ['useModerateListingMutation', read(HOOK_PATH)]
        ] as const;
        for (const [name, source] of sources) {
            for (const permission of RETIRED_PERMISSIONS) {
                expect(
                    source,
                    `${name} names ${permission}: listing moderation has ONE permission, LISTING_MODERATE.`
                ).not.toContain(permission);
            }
        }
    });
});
