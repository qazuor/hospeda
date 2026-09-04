/**
 * @file ContentMediaSection.metadata.test.tsx
 * @description Tests for the per-photo text editor wired into the post/event
 * media section by HOS-1036.
 *
 * Before this, the section could upload a photo and remove it, and that was
 * the whole vocabulary — `alt`, `caption`, `description` and the photo credit
 * had columns, an API (as of the same issue) and no control anywhere in the
 * editor. So the thing worth proving here is not that the panel works — that
 * is `PhotoMetadataEditor.test.tsx`'s job — but that it is REACHABLE from
 * every photo in this section and that saving from it actually reaches the
 * API with the right row id:
 *
 *  - the toggle exists for the featured photo AND for each gallery photo (the
 *    issue asks for both explicitly; only the gallery is easy to remember);
 *  - opening it shows what is PERSISTED, so it corrects rather than overwrites;
 *  - saving PATCHes THAT row — `mediaId` is asserted per photo, which is what
 *    catches an editor wired to the wrong item in a `.map()`;
 *  - an edit to ONE field resends the other three unchanged. The body always
 *    carries all four (`buildPhotoMetadataUpdateBody` never omits; a field
 *    absent from the form travels as `null`, which CLEARS the column), so the
 *    server's three-state protection is never exercised from here and the only
 *    thing keeping an untouched caption alive is `rowToItem` seeding the form
 *    from the row;
 *  - a stock import keeps its `license` and `provider` — the two credit
 *    subfields the panel never shows — across an alt-only correction;
 *  - a successful save refreshes local state, so the thumbnail's own `alt`
 *    attribute and a re-opened panel show the new value rather than the stale
 *    one the component mounted with;
 *  - a failed save reports and changes nothing;
 *  - the moderation lock (`disabled`) closes this affordance too — photos are
 *    content, and their text is the most content-like part of them.
 *
 * @module test/components/account/editor/ContentMediaSection.metadata
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContentMediaSectionProps } from '../../../../src/components/account/editor/ContentMediaSection.client';
import { ContentMediaSection } from '../../../../src/components/account/editor/ContentMediaSection.client';

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
    contentMediaApi: {
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
        tPlural: (key: string, count: number, params?: Record<string, string | number>): string =>
            Object.entries({ ...params, count }).reduce(
                (acc, [name, value]) => acc.replaceAll(`{{${name}}}`, String(value)),
                key
            )
    })
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const POST_ID = '00000000-0000-4000-8000-0000000000aa';

const defaultProps: ContentMediaSectionProps = {
    locale: 'es',
    entity: 'post',
    entityId: POST_ID
};

const FEATURED_ROW = {
    id: 'media-uuid-featured',
    url: 'https://cdn.example.com/featured.jpg',
    publicId: 'hospeda/posts/abc/img-featured',
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
    publicId: 'hospeda/posts/abc/img-g1',
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
    publicId: 'hospeda/posts/abc/img-g2',
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

/**
 * The accessible names the panel's toggle renders under, straight from
 * `PhotoMetadataEditor`. Written out rather than derived so a silent copy
 * change on either side shows up here as a failure instead of a tautology.
 */
const FEATURED_TOGGLE = 'Editar textos de la portada';
const GALLERY_TOGGLE_1 = 'Editar textos de la foto 1';

/** The panel's own field labels (fallback copy — the translator mock echoes it). */
const ALT_LABEL = '¿Qué muestra la foto?';
const CAPTION_LABEL = 'Epígrafe (opcional)';
const DESCRIPTION_LABEL = 'Descripción (opcional)';
const PHOTOGRAPHER_LABEL = '¿Quién sacó la foto?';
const SAVE_LABEL = 'Guardar';

async function renderHydrated(props: Partial<ContentMediaSectionProps> = {}) {
    const view = render(
        <ContentMediaSection
            {...defaultProps}
            {...props}
        />
    );
    await waitFor(() => expect(mockListMedia).toHaveBeenCalled());
    // The section only enables writes once hydration resolved.
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

describe('ContentMediaSection — photo text metadata (HOS-1036)', () => {
    it('offers the text editor on the featured photo AND on every gallery photo', async () => {
        await renderHydrated();

        expect(screen.getByRole('button', { name: FEATURED_TOGGLE })).toBeTruthy();
        expect(screen.getByRole('button', { name: GALLERY_TOGGLE_1 })).toBeTruthy();
    });

    it('opens the panel showing the values already persisted on that row', async () => {
        await renderHydrated();

        fireEvent.click(screen.getByRole('button', { name: FEATURED_TOGGLE }));

        const alt = screen.getByLabelText(ALT_LABEL) as HTMLTextAreaElement;
        const caption = screen.getByLabelText(CAPTION_LABEL) as HTMLInputElement;
        // This is a CORRECTION tool: a panel that opened blank would quietly
        // erase the row's existing text on the first save.
        expect(alt.value).toBe(FEATURED_ROW.alt);
        expect(caption.value).toBe(FEATURED_ROW.caption);
    });

    it('PATCHes the row it was opened from, with the whole text body', async () => {
        await renderHydrated();

        fireEvent.click(screen.getByRole('button', { name: GALLERY_TOGGLE_1 }));
        fireEvent.change(screen.getByLabelText(ALT_LABEL), {
            target: { value: 'Puesto de frutas en la peatonal' }
        });
        fireEvent.click(screen.getByRole('button', { name: SAVE_LABEL }));

        await waitFor(() => expect(mockUpdateMedia).toHaveBeenCalledTimes(1));
        // toEqual on the whole call, not objectContaining: a `mediaId` taken
        // from the wrong item of the `.map()` — or an `alt` that never left the
        // form — is exactly what a partial matcher would let through.
        expect(mockUpdateMedia.mock.calls[0]?.[0]).toEqual({
            entity: 'post',
            id: POST_ID,
            mediaId: GALLERY_ROW.id,
            body: {
                alt: 'Puesto de frutas en la peatonal',
                // Blank fields travel as `null` — CLEAR — never as `''`, which
                // the API's min() bound would reject instead of clearing.
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
        // the one the author is least likely to notice missing.
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
            entity: 'post',
            id: POST_ID,
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

    it('addresses the FEATURED row when opened from the featured photo', async () => {
        mockUpdateMedia.mockResolvedValue({
            ok: true as const,
            data: { media: { ...FEATURED_ROW, alt: 'Alt nuevo de portada' } }
        });
        await renderHydrated();

        fireEvent.click(screen.getByRole('button', { name: FEATURED_TOGGLE }));
        fireEvent.change(screen.getByLabelText(ALT_LABEL), {
            target: { value: 'Alt nuevo de portada' }
        });
        fireEvent.click(screen.getByRole('button', { name: SAVE_LABEL }));

        await waitFor(() => expect(mockUpdateMedia).toHaveBeenCalledTimes(1));
        expect(mockUpdateMedia.mock.calls[0]?.[0]?.mediaId).toBe(FEATURED_ROW.id);
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
        expect(screen.getByRole('alert').textContent).toContain('No se pudo guardar');
        // The UI must not claim a change the server refused.
        expect(
            container.querySelector(`img[src="${GALLERY_ROW.url}"]`)?.getAttribute('alt')
        ).not.toBe('Alt nuevo');
    });

    it('validates length client-side, before spending a request', async () => {
        await renderHydrated();

        fireEvent.click(screen.getByRole('button', { name: GALLERY_TOGGLE_1 }));
        fireEvent.change(screen.getByLabelText(ALT_LABEL), { target: { value: 'x'.repeat(201) } });
        fireEvent.click(screen.getByRole('button', { name: SAVE_LABEL }));

        await waitFor(() => expect(screen.getByText(/no puede superar/i)).toBeTruthy());
        expect(mockUpdateMedia).not.toHaveBeenCalled();
    });

    it('closes the affordance under the moderation lock', async () => {
        render(
            <ContentMediaSection
                {...defaultProps}
                disabled={true}
            />
        );
        await waitFor(() => expect(mockListMedia).toHaveBeenCalled());

        const toggle = await screen.findByRole('button', { name: FEATURED_TOGGLE });
        expect((toggle as HTMLButtonElement).disabled).toBe(true);
    });

    it('keeps one panel per photo — opening one does not open the other', async () => {
        const { container } = await renderHydrated();

        fireEvent.click(screen.getByRole('button', { name: GALLERY_TOGGLE_1 }));

        // Exactly one form is open, and it is the gallery photo's: its alt
        // field id carries that row's UUID.
        const forms = container.querySelectorAll('form');
        expect(forms).toHaveLength(1);
        expect(within(forms[0] as HTMLElement).getByLabelText(ALT_LABEL).id).toBe(
            `photo-alt-${GALLERY_ROW.id}`
        );
    });
});
