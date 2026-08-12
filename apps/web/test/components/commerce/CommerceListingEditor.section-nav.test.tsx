/**
 * @file CommerceListingEditor.section-nav.test.tsx
 * @description The commerce owner editor's sticky section nav.
 *
 * WHAT THIS ACTUALLY GUARDS. Not "a nav renders" — that a nav link RESOLVES.
 * `EditorSectionNav` builds `href="#<id>"` from the array it is handed and
 * scrolls via `document.getElementById(id)`; when no element carries that id the
 * click silently does nothing, which reads to the owner as a dead control rather
 * than as an error. The ids are not assigned by the orchestrator either — seven
 * of the eight are emitted by the section components themselves
 * (`id="editor-basicInfo"` inside `BasicInfoSection`, and so on), so the nav and
 * its targets live in different files and can drift apart with nothing failing.
 * That is the coupling under test.
 *
 * The eighth, `editor-translations`, is the exception: `CommerceTranslationPanel`
 * is shared and renders a bare `<fieldset>` with no id prop, so the orchestrator
 * wraps it. The wrapper is asserted here for the same reason as the rest — it is
 * the only anchor that a refactor of the panel could take away.
 *
 * WHY THE EMPTY-CATALOG CASE IS ITS OWN TEST. `AmenitiesSection` returns `null`
 * when both catalogs are empty, so its nav entry is the single conditional one.
 * A nav built unconditionally passes every "the links resolve" assertion in the
 * populated case and dangles only for owners whose vertical has no catalog —
 * exactly the population least likely to be checked by hand.
 *
 * NOT COVERED, on purpose: the scrollspy highlight. `IntersectionObserver` is a
 * no-op mock in `test/setup.ts` (jsdom does not implement it), so no assertion
 * here could distinguish a working observer from a dead one — and jsdom has no
 * layout, so `scrollIntoView` has nothing to scroll. Whether the nav visually
 * tracks the reading position is a browser question.
 */

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AmenityData } from '../../../src/lib/api/types';
import type { CommerceListingDetail } from '../../../src/lib/commerce/owner-listings';

vi.mock('@/store/toast-store', () => ({ addToast: vi.fn() }));

vi.mock('../../../src/components/commerce/CommerceListingEditor.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

// The real TipTap editor costs an order of magnitude in mount time and this
// suite asserts nothing about rich text. Same shim the sibling suites use.
vi.mock('@/components/host/editor/RichTextEditor.client', () => ({
    RichTextEditor: ({ ariaLabel }: { ariaLabel?: string }) => <textarea aria-label={ariaLabel} />
}));

vi.mock('../../../src/lib/api/client', () => ({ apiClient: { patch: vi.fn() } }));

vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    protectedMediaApi: { deleteMedia: vi.fn().mockResolvedValue({ ok: true, data: {} }) },
    commerceMediaApi: {
        listMedia: vi.fn().mockResolvedValue({ ok: true, data: { media: [] } }),
        addMedia: vi.fn().mockResolvedValue({ ok: true, data: { media: {} } }),
        removeMedia: vi.fn().mockResolvedValue({ ok: true, data: {} }),
        setFeaturedMedia: vi.fn().mockResolvedValue({ ok: true, data: { media: {} } })
    }
}));

vi.mock('../../../src/lib/env', () => ({ getApiUrl: () => 'http://api.test' }));
vi.mock('../../../src/lib/logger', () => ({ webLogger: { warn: vi.fn() } }));

import { CommerceListingEditor } from '../../../src/components/commerce/CommerceListingEditor.client';

const DESTINATION_1 = '11111111-1111-4111-8111-111111111111';

const baseData = {
    id: 'abc',
    ownerId: 'owner-1',
    name: 'La Parrilla',
    slug: 'la-parrilla',
    destinationId: DESTINATION_1,
    description: 'Descripción original con suficiente longitud para pasar validación.',
    richDescription: 'old text'
} as unknown as CommerceListingDetail;

const amenityCatalog = [
    { id: 'a1', slug: 'wifi', icon: null, category: 'connectivity' }
] as unknown as readonly AmenityData[];

function renderEditor({ withCatalogs }: { withCatalogs: boolean }) {
    return render(
        <CommerceListingEditor
            vertical="gastronomy"
            listingId="abc"
            locale="es"
            initialData={baseData}
            destinations={[{ id: DESTINATION_1, name: 'Concepción del Uruguay' }]}
            amenities={withCatalogs ? amenityCatalog : []}
            features={[]}
        />
    );
}

/** The nav's links, in render order, as the ids they point at. */
function navTargetIds(): string[] {
    const nav = screen.getByRole('navigation', {
        name: 'Navegación de secciones del formulario'
    });
    return within(nav)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href') ?? '')
        .map((href) => href.replace(/^#/, ''));
}

describe('CommerceListingEditor — section nav', () => {
    it('points every link at a section that is actually in the document', () => {
        const { container } = renderEditor({ withCatalogs: true });

        const dangling = navTargetIds().filter((id) => container.querySelector(`#${id}`) === null);

        expect(
            dangling,
            `These nav links have no target in the DOM: ${dangling.join(', ')}. ` +
                'Clicking one scrolls nowhere. The ids come from the section components ' +
                '(id="editor-*"), so either a section stopped emitting its id or the nav ' +
                'array in CommerceListingEditor names one that never existed.'
        ).toEqual([]);
    });

    it('lists the sections in the order they are rendered', () => {
        const { container } = renderEditor({ withCatalogs: true });

        const ids = navTargetIds();
        const domOrder = [...container.querySelectorAll('[id^="editor-"]')]
            .map((el) => el.id)
            .filter((id) => ids.includes(id));

        // The scrollspy resolves ties by taking the first entry of the nav array
        // that is intersecting, so a nav ordered differently from the DOM
        // highlights the wrong link whenever two sections share the viewport.
        expect(ids).toEqual(domOrder);
    });

    it('covers all eight sections when the amenity catalog is populated', () => {
        renderEditor({ withCatalogs: true });

        expect(navTargetIds()).toEqual([
            'editor-basicInfo',
            'editor-contact',
            'editor-socialNetworks',
            'editor-openingHours',
            'editor-media',
            'editor-translations',
            'editor-amenities',
            'editor-price'
        ]);
    });

    it('drops the amenities entry when both catalogs are empty, and still dangles nothing', () => {
        const { container } = renderEditor({ withCatalogs: false });

        // AmenitiesSection renders null here, so the section genuinely is not on
        // the page — the entry must go with it, not merely be styled inert.
        expect(container.querySelector('#editor-amenities')).toBeNull();

        const ids = navTargetIds();
        expect(ids).not.toContain('editor-amenities');
        expect(ids.filter((id) => container.querySelector(`#${id}`) === null)).toEqual([]);
    });

    it('anchors the shared translation panel, which cannot carry an id itself', () => {
        const { container } = renderEditor({ withCatalogs: true });

        expect(container.querySelector('#editor-translations')).not.toBeNull();
    });
});
