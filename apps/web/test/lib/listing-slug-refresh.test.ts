import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    buildSlugRefreshPayload,
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
    it('treats ACTIVE as published', () => {
        expect(isListingPublished({ lifecycleState: 'ACTIVE' })).toBe(true);
    });

    it.each([
        'DRAFT',
        'ARCHIVED',
        'PENDING_REVIEW',
        ''
    ])('treats %s as not published', (lifecycleState) => {
        expect(isListingPublished({ lifecycleState })).toBe(false);
    });

    it.each([null, undefined])('treats a missing state (%s) as not published', (lifecycleState) => {
        expect(isListingPublished({ lifecycleState })).toBe(false);
    });

    it('is the SAME predicate the slug-refresh opt-in gates on', () => {
        // Pinned as an equivalence rather than two independent truths: a second
        // definition of "published" that drifted from this one is exactly the
        // failure the notice is supposed to stop being an example of.
        for (const lifecycleState of ['ACTIVE', 'DRAFT', 'ARCHIVED']) {
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
