import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    buildSlugRefreshPayload,
    getSlugRefreshOptInPlacement,
    isListingPublished,
    shouldOfferPublishedSlugRefresh
} from '@/lib/listing-slug-refresh';

describe('listing-slug-refresh', () => {
    it('offers the opt-in only for published listings whose name changed', () => {
        expect(
            shouldOfferPublishedSlugRefresh({
                currentLifecycleState: 'ACTIVE',
                initialName: 'Nombre original',
                currentName: 'Nombre nuevo'
            })
        ).toBe(true);

        expect(
            shouldOfferPublishedSlugRefresh({
                currentLifecycleState: 'DRAFT',
                initialName: 'Nombre original',
                currentName: 'Nombre nuevo'
            })
        ).toBe(false);

        expect(
            shouldOfferPublishedSlugRefresh({
                currentLifecycleState: 'ACTIVE',
                initialName: 'Nombre original',
                currentName: 'Nombre original'
            })
        ).toBe(false);
    });

    // HOS-879: the slug is generated from `type` + `name`, so a type-only
    // change needs the same opt-in as a rename does — but ONLY for callers
    // that actually pass `initialType`/`currentType`. A caller that omits
    // them (e.g. commerce, whose slug is name-only) must keep its exact
    // pre-HOS-879 behavior.
    it('offers the opt-in for a published listing whose type changed, name untouched', () => {
        expect(
            shouldOfferPublishedSlugRefresh({
                currentLifecycleState: 'ACTIVE',
                initialName: 'Casa del Río',
                currentName: 'Casa del Río',
                initialType: 'COUNTRY_HOUSE',
                currentType: 'CABIN'
            })
        ).toBe(true);
    });

    it('does not offer the opt-in for a DRAFT listing whose type changed — no address to protect', () => {
        expect(
            shouldOfferPublishedSlugRefresh({
                currentLifecycleState: 'DRAFT',
                initialName: 'Casa del Río',
                currentName: 'Casa del Río',
                initialType: 'COUNTRY_HOUSE',
                currentType: 'CABIN'
            })
        ).toBe(false);
    });

    it('does not offer the opt-in when neither name nor type actually changed', () => {
        expect(
            shouldOfferPublishedSlugRefresh({
                currentLifecycleState: 'ACTIVE',
                initialName: 'Casa del Río',
                currentName: 'Casa del Río',
                initialType: 'CABIN',
                currentType: 'CABIN'
            })
        ).toBe(false);
    });

    it('ignores type entirely when the caller omits initialType/currentType (commerce parity)', () => {
        // Simulates the commerce call site, which never passes these two
        // fields because its slug does not depend on `type` at all.
        expect(
            shouldOfferPublishedSlugRefresh({
                currentLifecycleState: 'ACTIVE',
                initialName: 'Casa del Río',
                currentName: 'Casa del Río'
            })
        ).toBe(false);
    });

    it('builds the opt-in payload only when the published rename was explicitly requested', () => {
        expect(
            buildSlugRefreshPayload({
                currentLifecycleState: 'ACTIVE',
                initialName: 'Nombre original',
                currentName: 'Nombre nuevo',
                refreshSlugFromName: true
            })
        ).toEqual({ refreshSlugFromName: true });

        expect(
            buildSlugRefreshPayload({
                currentLifecycleState: 'ACTIVE',
                initialName: 'Nombre original',
                currentName: 'Nombre nuevo',
                refreshSlugFromName: false
            })
        ).toEqual({});
    });

    it('builds the opt-in payload for a type-only change when explicitly requested (HOS-879)', () => {
        expect(
            buildSlugRefreshPayload({
                currentLifecycleState: 'ACTIVE',
                initialName: 'Casa del Río',
                currentName: 'Casa del Río',
                initialType: 'COUNTRY_HOUSE',
                currentType: 'CABIN',
                refreshSlugFromName: true
            })
        ).toEqual({ refreshSlugFromName: true });
    });
});

/**
 * HOS-879 UI gap fix: the UI's `isListingPublished` used `=== 'ACTIVE'`,
 * disagreeing with the backend's `!== DRAFT` gate
 * (`packages/service-core/src/utils/listing-slug-policy.ts`). A host with an
 * INACTIVE (paused) or ARCHIVED listing — or one with no recognized lifecycle
 * state at all — never saw the opt-in even though the backend would have
 * honored the flag had it arrived. These five cases are the full decision
 * table the fix must satisfy.
 */
describe('shouldOfferPublishedSlugRefresh: every non-DRAFT state is published (HOS-879 gap fix)', () => {
    it.each([
        ['DRAFT', false],
        ['ACTIVE', true],
        ['INACTIVE', true],
        ['ARCHIVED', true],
        [undefined, true]
    ] as const)('currentLifecycleState=%s -> offered=%s', (currentLifecycleState, expected) => {
        expect(
            shouldOfferPublishedSlugRefresh({
                currentLifecycleState,
                initialName: 'Nombre original',
                currentName: 'Nombre nuevo'
            })
        ).toBe(expected);
    });
});

/**
 * HOS-879 UX follow-up. The opt-in notice used to render pinned next to
 * `name` regardless of which field actually changed — a host who changed
 * only `type` on a published listing saw it next to a field they never
 * touched, easy to miss. `getSlugRefreshOptInPlacement` is the function that
 * decides WHERE the (single, shared) opt-in should render.
 */
describe('getSlugRefreshOptInPlacement (HOS-879 UX follow-up)', () => {
    it('offers it only near name when only the name changed', () => {
        expect(
            getSlugRefreshOptInPlacement({
                currentLifecycleState: 'ACTIVE',
                initialName: 'Nombre original',
                currentName: 'Nombre nuevo',
                initialType: 'HOTEL',
                currentType: 'HOTEL'
            })
        ).toEqual({ nearName: true, nearType: false });
    });

    it('offers it only near type when only the type changed', () => {
        expect(
            getSlugRefreshOptInPlacement({
                currentLifecycleState: 'ACTIVE',
                initialName: 'Casa del Río',
                currentName: 'Casa del Río',
                initialType: 'COUNTRY_HOUSE',
                currentType: 'CABIN'
            })
        ).toEqual({ nearName: false, nearType: true });
    });

    it('offers it in BOTH positions when both name and type changed', () => {
        expect(
            getSlugRefreshOptInPlacement({
                currentLifecycleState: 'ACTIVE',
                initialName: 'Casa del Río',
                currentName: 'Casa Renombrada',
                initialType: 'COUNTRY_HOUSE',
                currentType: 'CABIN'
            })
        ).toEqual({ nearName: true, nearType: true });
    });

    it('offers it in neither position when nothing changed', () => {
        expect(
            getSlugRefreshOptInPlacement({
                currentLifecycleState: 'ACTIVE',
                initialName: 'Casa del Río',
                currentName: 'Casa del Río',
                initialType: 'CABIN',
                currentType: 'CABIN'
            })
        ).toEqual({ nearName: false, nearType: false });
    });

    it('offers it in neither position on a DRAFT listing, even if both changed', () => {
        expect(
            getSlugRefreshOptInPlacement({
                currentLifecycleState: 'DRAFT',
                initialName: 'Casa del Río',
                currentName: 'Casa Renombrada',
                initialType: 'COUNTRY_HOUSE',
                currentType: 'CABIN'
            })
        ).toEqual({ nearName: false, nearType: false });
    });

    it('is consistent with shouldOfferPublishedSlugRefresh: the OR of both positions', () => {
        const cases = [
            { name: 'changed', type: 'unchanged' as const },
            { name: 'unchanged', type: 'changed' as const },
            { name: 'changed', type: 'changed' as const },
            { name: 'unchanged', type: 'unchanged' as const }
        ];

        for (const { name, type } of cases) {
            const input = {
                currentLifecycleState: 'ACTIVE',
                initialName: 'Casa del Río',
                currentName: name === 'changed' ? 'Casa Renombrada' : 'Casa del Río',
                initialType: 'COUNTRY_HOUSE',
                currentType: type === 'changed' ? 'CABIN' : 'COUNTRY_HOUSE'
            };

            const placement = getSlugRefreshOptInPlacement(input);
            expect(placement.nearName || placement.nearType).toBe(
                shouldOfferPublishedSlugRefresh(input)
            );
        }
    });
});

/**
 * HOS-834. The editor's address notice used to describe BOTH states in one
 * sentence ("follows the name while unpublished; once published it stops") and
 * never said which one you were in, so on a published listing its first half
 * described something that does not happen to it.
 *
 * The state is resolved through `isListingPublished` — the same predicate that
 * gates the slug-refresh opt-in — so what the sentence claims and what the
 * editor does cannot disagree.
 */
describe('isListingPublished (HOS-834)', () => {
    it('treats DRAFT as not published — the only state that is not', () => {
        expect(isListingPublished({ lifecycleState: 'DRAFT' })).toBe(false);
    });

    // HOS-879 UI gap fix: the backend policy (`listing-slug-policy.ts`) treats
    // anything other than DRAFT as published — INACTIVE (paused), ARCHIVED, and
    // an absent/unrecognized state included. Before this fix, the UI used
    // `=== 'ACTIVE'`, so a paused or archived listing never saw the slug-refresh
    // opt-in even though the backend would have honored the flag had it arrived.
    it.each([
        'ACTIVE',
        'INACTIVE',
        'ARCHIVED',
        'PENDING_REVIEW'
    ])('treats %s as published', (lifecycleState) => {
        expect(isListingPublished({ lifecycleState })).toBe(true);
    });

    it.each([
        null,
        undefined,
        ''
    ])('treats a missing/unknown state (%s) as published — cannot prove it was never published', (lifecycleState) => {
        expect(isListingPublished({ lifecycleState })).toBe(true);
    });

    it('is the SAME predicate the slug-refresh opt-in gates on', () => {
        // Pinned as an equivalence rather than two independent truths: a second
        // definition of "published" that drifted from this one is exactly the
        // failure the notice is supposed to stop being an example of.
        for (const lifecycleState of ['ACTIVE', 'DRAFT', 'INACTIVE', 'ARCHIVED']) {
            const offered = shouldOfferPublishedSlugRefresh({
                currentLifecycleState: lifecycleState,
                initialName: 'Nombre original',
                currentName: 'Nombre nuevo'
            });

            expect(offered).toBe(isListingPublished({ lifecycleState }));
        }
    });
});

describe('the commerce editor states ONE address rule (HOS-834)', () => {
    // HOS-1080: the notice moved with the name field, onto the basic-info
    // section's own route. It belongs wherever renaming happens and nowhere
    // else — a page that cannot change the name has nothing to say about what
    // renaming does to the URL.
    const EDITOR_PAGE = join(
        __dirname,
        '../../src/pages/[lang]/mi-cuenta/comercio/[vertical]/[id]/editar/datos.astro'
    );

    /**
     * Isolates the rendered notice element, so these assertions describe what
     * the page PRINTS rather than any string that happens to appear in a
     * 200-line file — frontmatter and comments included.
     */
    function readNoticeElement(): string {
        const source = readFileSync(EDITOR_PAGE, 'utf-8');
        const start = source.indexOf('class="ce-identity__notice"');
        expect(start, 'notice element not found').toBeGreaterThan(-1);

        const end = source.indexOf('</p>', start);
        expect(end, 'notice element is unterminated').toBeGreaterThan(start);

        return source.slice(start, end);
    }

    it('branches the notice on the published state', () => {
        expect(readNoticeElement()).toContain('listingIsPublished');
    });

    it('renders a distinct key for each state', () => {
        const notice = readNoticeElement();

        expect(notice).toContain('commerce.owner.editor.slugFixedNotice');
        expect(notice).toContain('commerce.owner.editor.slugFollowsNameNotice');
    });

    it('no longer renders the both-states-at-once key', () => {
        expect(readNoticeElement()).not.toContain('slugImmutableNotice');
    });

    it('derives the state from the shared predicate, not a local string compare', () => {
        const source = readFileSync(EDITOR_PAGE, 'utf-8');

        expect(source).toContain("import { isListingPublished } from '@/lib/listing-slug-refresh'");
        // A hand-rolled `=== 'ACTIVE'` here would be the second definition this
        // whole approach exists to avoid.
        expect(source).not.toMatch(/lifecycleState\s*===\s*['"]ACTIVE['"]/);
    });
});
