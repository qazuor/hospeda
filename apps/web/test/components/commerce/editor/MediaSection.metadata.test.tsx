/**
 * @file MediaSection.metadata.test.tsx
 * @description Tests for the per-photo text editor wired into the commerce
 * (gastronomy / experience) media section by HOS-1036.
 *
 * The commerce twin of
 * `test/components/account/editor/ContentMediaSection.metadata.test.tsx`, and
 * for the same reason: the section could upload and remove a photo and nothing
 * else, so `alt`, `caption`, `description` and the photo credit had columns, an
 * API (as of the same issue) and no control anywhere in the editor.
 *
 * What is asserted here, over and above the panel's own suite:
 *
 *  - the toggle exists for the featured photo AND for each gallery photo;
 *  - saving PATCHes THAT row, with the vertical the section was rendered for —
 *    a `vertical` hard-coded to gastronomy would send an experience owner's
 *    correction to the wrong endpoint;
 *  - an edit to ONE field resends the other three unchanged. The body always
 *    carries all four (`buildPhotoMetadataUpdateBody` never omits; a field
 *    absent from the form travels as `null`, which CLEARS the column), so the
 *    server's three-state protection is never exercised from here and the only
 *    thing keeping an untouched caption alive is `rowToItem` seeding the form
 *    from the row;
 *  - a stock import keeps its `license` and `provider` — the two credit
 *    subfields the panel never shows — across an alt-only correction;
 *  - a successful save refreshes local state;
 *  - a failed save reports and changes nothing;
 *  - an SSR placeholder (no DB id yet) cannot be edited — the same rule that
 *    already gates remove and set-featured here.
 *
 * @module test/components/commerce/editor/MediaSection.metadata
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MediaSectionProps } from '../../../../src/components/commerce/editor/MediaSection.client';
import { MediaSection } from '../../../../src/components/commerce/editor/MediaSection.client';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockListMedia, mockUpdateMedia, mockAddToast } = vi.hoisted(() => ({
    mockListMedia: vi.fn(),
    mockUpdateMedia: vi.fn(),
    mockAddToast: vi.fn()
}));

vi.mock('../../../../src/lib/env', () => ({
    getApiUrl: () => 'http://api.test'
}));

vi.mock('../../../../src/lib/logger', () => ({
    webLogger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));

vi.mock('../../../../src/lib/api/endpoints-protected', () => ({
    commerceMediaApi: {
        listMedia: mockListMedia,
        addMedia: vi.fn(),
        removeMedia: vi.fn(),
        setFeaturedMedia: vi.fn(),
        updateMedia: mockUpdateMedia
    },
    protectedMediaApi: {
        deleteMedia: vi.fn()
    }
}));

vi.mock('../../../../src/store/toast-store', () => ({
    addToast: mockAddToast
}));

vi.mock('../../../../src/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string, params?: Record<string, string | number>): string => {
            const raw = fallback ?? key;
            return params
                ? Object.entries(params).reduce(
                      (acc, [name, value]) => acc.replaceAll(`{{${name}}}`, String(value)),
                      raw
                  )
                : raw;
        },
        tPlural: (key: string, count: number, params?: Record<string, string | number>): string => {
            const raw = `${key}_${count}`;
            return params
                ? Object.entries(params).reduce(
                      (acc, [name, value]) => acc.replaceAll(`{{${name}}}`, String(value)),
                      raw
                  )
                : raw;
        }
    })
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const LISTING_ID = '00000000-0000-4000-8000-0000000000aa';

const defaultProps: MediaSectionProps = {
    locale: 'es',
    vertical: 'gastronomy',
    listingId: LISTING_ID
};

const FEATURED_ROW = {
    id: 'media-uuid-featured',
    url: 'https://cdn.example.com/featured.jpg',
    publicId: 'hospeda/gastronomy/abc/img-featured',
    caption: 'Epígrafe viejo',
    description: 'Una descripción vieja de la foto',
    alt: 'Alt viejo de la portada',
    attribution: null,
    isFeatured: true,
    sortOrder: 0,
    state: 'visible' as const,
    moderationState: 'APPROVED'
};

const GALLERY_ROW = {
    id: 'media-uuid-g1',
    url: 'https://cdn.example.com/gallery1.jpg',
    publicId: 'hospeda/gastronomy/abc/img-g1',
    caption: null,
    description: null,
    alt: null,
    attribution: null,
    isFeatured: false,
    sortOrder: 1,
    state: 'visible' as const,
    moderationState: 'APPROVED'
};

/**
 * A photo that came from a stock import, so its credit carries `license` and
 * `provider` — the two subfields the panel never shows and never collects.
 * Every other fixture here has `attribution: null`, which leaves the branch of
 * `buildAttribution` that carries those two over completely unexercised.
 */
const STOCK_ROW = {
    id: 'media-uuid-g2',
    url: 'https://cdn.example.com/gallery2.jpg',
    publicId: 'hospeda/gastronomy/abc/img-g2',
    caption: null,
    description: null,
    alt: 'Alt de stock',
    attribution: {
        photographer: 'Ana Fotógrafa',
        sourceUrl: 'https://unsplash.com/photos/xyz',
        license: 'Unsplash License',
        provider: 'unsplash' as const
    },
    isFeatured: false,
    sortOrder: 1,
    state: 'visible' as const,
    moderationState: 'APPROVED'
};

const FEATURED_TOGGLE = 'Editar textos de la portada';
const GALLERY_TOGGLE_1 = 'Editar textos de la foto 1';
const ALT_LABEL = '¿Qué muestra la foto?';
const DESCRIPTION_LABEL = 'Descripción (opcional)';
const PHOTOGRAPHER_LABEL = '¿Quién sacó la foto?';
const SAVE_LABEL = 'Guardar';

async function renderHydrated(props: Partial<MediaSectionProps> = {}) {
    const view = render(
        <MediaSection
            {...defaultProps}
            {...props}
        />
    );
    await waitFor(() => expect(mockListMedia).toHaveBeenCalled());
    await screen.findByRole('button', { name: FEATURED_TOGGLE });
    return view;
}

beforeEach(() => {
    vi.clearAllMocks();
    mockListMedia.mockResolvedValue({
        ok: true as const,
        data: { media: [FEATURED_ROW, GALLERY_ROW] }
    });
    mockUpdateMedia.mockResolvedValue({
        ok: true as const,
        data: { media: { ...GALLERY_ROW, alt: 'Alt nuevo' } }
    });
});

// ---------------------------------------------------------------------------

describe('MediaSection — photo text metadata (HOS-1036)', () => {
    it('offers the text editor on the featured photo AND on every gallery photo', async () => {
        await renderHydrated();

        expect(screen.getByRole('button', { name: FEATURED_TOGGLE })).toBeTruthy();
        expect(screen.getByRole('button', { name: GALLERY_TOGGLE_1 })).toBeTruthy();
    });

    it('opens the panel showing the values already persisted on that row', async () => {
        await renderHydrated();

        fireEvent.click(screen.getByRole('button', { name: FEATURED_TOGGLE }));

        expect((screen.getByLabelText(ALT_LABEL) as HTMLTextAreaElement).value).toBe(
            FEATURED_ROW.alt
        );
    });

    it('PATCHes the row it was opened from, with the whole text body', async () => {
        await renderHydrated();

        fireEvent.click(screen.getByRole('button', { name: GALLERY_TOGGLE_1 }));
        fireEvent.change(screen.getByLabelText(ALT_LABEL), {
            target: { value: 'Milanesa napolitana servida en la barra' }
        });
        fireEvent.click(screen.getByRole('button', { name: SAVE_LABEL }));

        await waitFor(() => expect(mockUpdateMedia).toHaveBeenCalledTimes(1));
        expect(mockUpdateMedia.mock.calls[0]?.[0]).toEqual({
            vertical: 'gastronomy',
            id: LISTING_ID,
            mediaId: GALLERY_ROW.id,
            body: {
                alt: 'Milanesa napolitana servida en la barra',
                caption: null,
                description: null,
                attribution: null
            }
        });
    });

    it('RESENDS the fields it did not touch, unchanged', async () => {
        // The premise of the whole feature. `buildPhotoMetadataUpdateBody` always
        // sends all four fields — a field that is not in the form travels as
        // `null`, which CLEARS the column — so the only thing standing between
        // "fix the alt" and "erase the caption" is `rowToItem` seeding the form
        // from the row. Drop `description: row.description ?? undefined` there
        // and this is the assertion that notices; the other tests in this file
        // open a row whose caption and description are already `null`.
        mockUpdateMedia.mockResolvedValue({
            ok: true as const,
            data: { media: { ...FEATURED_ROW, alt: 'Alt nuevo de portada' } }
        });
        await renderHydrated();

        fireEvent.click(screen.getByRole('button', { name: FEATURED_TOGGLE }));
        // The description is the field with no other test looking at it, and
        // the one the owner is least likely to notice missing.
        expect((screen.getByLabelText(DESCRIPTION_LABEL) as HTMLTextAreaElement).value).toBe(
            FEATURED_ROW.description
        );
        fireEvent.change(screen.getByLabelText(ALT_LABEL), {
            target: { value: 'Alt nuevo de portada' }
        });
        fireEvent.click(screen.getByRole('button', { name: SAVE_LABEL }));

        await waitFor(() => expect(mockUpdateMedia).toHaveBeenCalledTimes(1));
        // toStrictEqual, not toEqual: the latter ignores keys whose value is
        // `undefined`, which is exactly what a dropped mapping produces.
        expect(mockUpdateMedia.mock.calls[0]?.[0]).toStrictEqual({
            vertical: 'gastronomy',
            id: LISTING_ID,
            mediaId: FEATURED_ROW.id,
            body: {
                alt: 'Alt nuevo de portada',
                caption: FEATURED_ROW.caption,
                description: FEATURED_ROW.description,
                attribution: null
            }
        });
    });

    it("preserves a stock import's licence and provider through an alt-only edit", async () => {
        // The panel shows the photographer and the link, and never the licence
        // or the provider — so those two survive only because
        // `buildAttribution` carries them over from the row. Losing them
        // rewrites an Unsplash photo as a `user-upload`, which is the credit
        // their API terms require us to keep displaying.
        mockListMedia.mockResolvedValue({
            ok: true as const,
            data: { media: [FEATURED_ROW, STOCK_ROW] }
        });
        mockUpdateMedia.mockResolvedValue({
            ok: true as const,
            data: { media: { ...STOCK_ROW, alt: 'Alt corregido' } }
        });
        await renderHydrated();

        fireEvent.click(screen.getByRole('button', { name: GALLERY_TOGGLE_1 }));
        // The credit the row already carries is what the panel opens with.
        expect((screen.getByLabelText(PHOTOGRAPHER_LABEL) as HTMLInputElement).value).toBe(
            STOCK_ROW.attribution.photographer
        );
        fireEvent.change(screen.getByLabelText(ALT_LABEL), { target: { value: 'Alt corregido' } });
        fireEvent.click(screen.getByRole('button', { name: SAVE_LABEL }));

        await waitFor(() => expect(mockUpdateMedia).toHaveBeenCalledTimes(1));
        expect(mockUpdateMedia.mock.calls[0]?.[0]?.body).toStrictEqual({
            alt: 'Alt corregido',
            caption: null,
            description: null,
            attribution: {
                photographer: 'Ana Fotógrafa',
                sourceUrl: 'https://unsplash.com/photos/xyz',
                license: 'Unsplash License',
                provider: 'unsplash'
            }
        });
    });

    it('sends the vertical it was rendered for, not a hard-coded one', async () => {
        await renderHydrated({ vertical: 'experience' });

        fireEvent.click(screen.getByRole('button', { name: GALLERY_TOGGLE_1 }));
        fireEvent.change(screen.getByLabelText(ALT_LABEL), {
            target: { value: 'Kayaks amarrados en la bajada' }
        });
        fireEvent.click(screen.getByRole('button', { name: SAVE_LABEL }));

        await waitFor(() => expect(mockUpdateMedia).toHaveBeenCalledTimes(1));
        expect(mockUpdateMedia.mock.calls[0]?.[0]?.vertical).toBe('experience');
    });

    it('refreshes the row after a successful save (thumbnail alt included)', async () => {
        const { container } = await renderHydrated();

        fireEvent.click(screen.getByRole('button', { name: GALLERY_TOGGLE_1 }));
        fireEvent.change(screen.getByLabelText(ALT_LABEL), { target: { value: 'Alt nuevo' } });
        fireEvent.click(screen.getByRole('button', { name: SAVE_LABEL }));

        await waitFor(() =>
            expect(
                container.querySelector(`img[src="${GALLERY_ROW.url}"]`)?.getAttribute('alt')
            ).toBe('Alt nuevo')
        );
    });

    it('reports a failed save and leaves the row untouched', async () => {
        mockUpdateMedia.mockResolvedValue({
            ok: false as const,
            error: { message: 'No se pudo guardar', code: 'INTERNAL_ERROR' }
        });
        const { container } = await renderHydrated();

        fireEvent.click(screen.getByRole('button', { name: GALLERY_TOGGLE_1 }));
        fireEvent.change(screen.getByLabelText(ALT_LABEL), { target: { value: 'Alt nuevo' } });
        fireEvent.click(screen.getByRole('button', { name: SAVE_LABEL }));

        await waitFor(() => expect(mockAddToast).toHaveBeenCalled());
        expect(
            container.querySelector(`img[src="${GALLERY_ROW.url}"]`)?.getAttribute('alt')
        ).not.toBe('Alt nuevo');
    });

    it('leaves the toggle disabled on an SSR placeholder that has no DB id yet', async () => {
        // `listMedia` never resolves, so the only rows on screen are the SSR
        // placeholders — which carry `id: ''` and cannot address an API row.
        mockListMedia.mockReturnValue(new Promise(() => {}));

        render(
            <MediaSection
                {...defaultProps}
                initialFeaturedImage={{ url: FEATURED_ROW.url, moderationState: 'APPROVED' }}
            />
        );

        const toggle = await screen.findByRole('button', { name: FEATURED_TOGGLE });
        expect((toggle as HTMLButtonElement).disabled).toBe(true);
    });
});
