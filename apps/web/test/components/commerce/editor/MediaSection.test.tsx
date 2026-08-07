/**
 * @file MediaSection.test.tsx
 * @description Tests for the self-contained commerce media editor (HOS-372).
 *
 * Covers the per-operation persistence migration (mirrors
 * `test/components/host/editor/PhotoSection.test.tsx` for the accommodation
 * editor):
 * - On mount: hydrates from `commerceMediaApi.listMedia` and splits featured
 *   vs gallery.
 * - Adding a gallery photo calls `addMedia` immediately (NOT deferred to a
 *   parent Save) and shows it in the grid.
 * - Removing a gallery photo calls `removeMedia` immediately and fires NO
 *   client-side Cloudinary delete: since HOS-372 the server deletes the binary
 *   inside `removeMedia`, before dropping the row. The client-side call this
 *   replaced was unreachable anyway — `media/protected/delete-entity` rejects
 *   `gastronomy` and `experience` with HTTP 400.
 * - Setting a new featured image calls upload → addMedia → setFeaturedMedia
 *   immediately, and the previous featured moves to the gallery.
 * - A failed operation surfaces an inline error + toast and does NOT mutate
 *   state (the UI never claims success on failure).
 * - Gallery cap enforcement (HOS-322 size-limit coverage retained).
 *
 * HOS-258 folded the widget into `editor/MediaSection.client.tsx`, so the
 * component now takes `locale` and builds its own translator (and owns its CSS
 * modules) instead of receiving a `t` function and a `classes` bag.
 *
 * @module test/components/commerce/editor/MediaSection
 */

import { DEFAULT_ENTITY_MAX_FILE_SIZE_MB, mbToBytes } from '@repo/media';
import { getGalleryCap } from '@repo/schemas';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MediaSectionProps } from '../../../../src/components/commerce/editor/MediaSection.client';
import { MediaSection } from '../../../../src/components/commerce/editor/MediaSection.client';

// ---------------------------------------------------------------------------
// Hoisted mocks (vi.hoisted executes before vi.mock factories)
// ---------------------------------------------------------------------------

const {
    mockListMedia,
    mockAddMedia,
    mockRemoveMedia,
    mockSetFeaturedMedia,
    mockDeleteMedia,
    mockAddToast
} = vi.hoisted(() => ({
    mockListMedia: vi.fn(),
    mockAddMedia: vi.fn(),
    mockRemoveMedia: vi.fn(),
    mockSetFeaturedMedia: vi.fn(),
    mockDeleteMedia: vi.fn().mockResolvedValue({ ok: true, data: { deleted: true } }),
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
        addMedia: mockAddMedia,
        removeMedia: mockRemoveMedia,
        setFeaturedMedia: mockSetFeaturedMedia
    },
    protectedMediaApi: {
        deleteMedia: mockDeleteMedia
    }
}));

vi.mock('../../../../src/store/toast-store', () => ({
    addToast: mockAddToast
}));

vi.mock('../../../../src/lib/i18n', () => ({
    // Interpolating translator, matching the real `createTranslations().t`.
    createTranslations: () => ({
        t: (key: string, fallback?: string, params?: Record<string, string | number>): string => {
            const raw = fallback ?? key;
            return params
                ? Object.entries(params).reduce(
                      (acc, [name, value]) => acc.replaceAll(`{{${name}}}`, String(value)),
                      raw
                  )
                : raw;
        }
    })
}));

const LISTING_ID = '00000000-0000-4000-8000-0000000000aa';

const defaultProps: MediaSectionProps = {
    locale: 'es',
    vertical: 'gastronomy',
    listingId: LISTING_ID
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FEATURED_ROW = {
    id: 'media-uuid-featured',
    url: 'https://cdn.example.com/featured.jpg',
    publicId: 'hospeda/gastronomies/abc/gallery/img-featured',
    isFeatured: true,
    sortOrder: 0,
    state: 'visible' as const,
    moderationState: 'APPROVED'
};

const GALLERY_ROW_1 = {
    id: 'media-uuid-g1',
    url: 'https://cdn.example.com/gallery1.jpg',
    publicId: 'hospeda/gastronomies/abc/gallery/img-g1',
    isFeatured: false,
    sortOrder: 1,
    state: 'visible' as const,
    moderationState: 'APPROVED'
};

const GALLERY_ROW_2 = {
    id: 'media-uuid-g2',
    url: 'https://cdn.example.com/gallery2.jpg',
    publicId: 'hospeda/gastronomies/abc/gallery/img-g2',
    isFeatured: false,
    sortOrder: 2,
    state: 'visible' as const,
    moderationState: 'APPROVED'
};

const NEW_ROW = {
    id: 'media-uuid-new',
    url: 'https://cdn.example.com/new.jpg',
    publicId: 'hospeda/gastronomies/abc/gallery/img-new',
    isFeatured: false,
    sortOrder: 3,
    state: 'visible' as const,
    moderationState: 'APPROVED'
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeListOk(rows: (typeof FEATURED_ROW)[] = [FEATURED_ROW, GALLERY_ROW_1]) {
    return Promise.resolve({ ok: true as const, data: { media: rows } });
}

function makeListEmpty() {
    return Promise.resolve({ ok: true as const, data: { media: [] } });
}

function makeAddOk(row = NEW_ROW) {
    return Promise.resolve({ ok: true as const, data: { media: row } });
}

function makeRemoveOk() {
    return Promise.resolve({ ok: true as const, data: {} });
}

function makeError(message = 'Server error') {
    return Promise.resolve({
        ok: false as const,
        error: { message, code: 'INTERNAL_ERROR' }
    });
}

function stubFetchUploadOk(url = NEW_ROW.url, publicId = NEW_ROW.publicId) {
    global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
            success: true,
            data: { url, publicId, width: 800, height: 600 }
        })
    } as Response);
}

/** A file of an exact byte length. */
const fileOfBytes = (bytes: number): File =>
    new File([new Uint8Array(new ArrayBuffer(bytes))], 'listing.jpg', { type: 'image/jpeg' });

function fileInputs(): { featured: HTMLInputElement; gallery: HTMLInputElement } {
    const inputs = document.querySelectorAll('input[type="file"]');
    return { featured: inputs[0] as HTMLInputElement, gallery: inputs[1] as HTMLInputElement };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MediaSection — per-operation persistence (HOS-372)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockListMedia.mockReturnValue(makeListEmpty());
        mockDeleteMedia.mockResolvedValue({ ok: true, data: { deleted: true } });
    });

    // ── Hydration ───────────────────────────────────────────────────────

    describe('hydration from listMedia on mount', () => {
        it('calls listMedia with the vertical and listing id on mount', async () => {
            render(<MediaSection {...defaultProps} />);
            await waitFor(() => {
                expect(mockListMedia).toHaveBeenCalledWith({
                    vertical: 'gastronomy',
                    id: LISTING_ID
                });
            });
        });

        it('splits the featured row into the featured slot', async () => {
            mockListMedia.mockReturnValue(makeListOk([FEATURED_ROW, GALLERY_ROW_1]));
            render(<MediaSection {...defaultProps} />);

            await waitFor(() => {
                const img = screen.getByAltText('Imagen principal');
                expect(img).toHaveAttribute('src', FEATURED_ROW.url);
            });
        });

        it('splits non-featured rows into the gallery grid', async () => {
            mockListMedia.mockReturnValue(makeListOk([FEATURED_ROW, GALLERY_ROW_1, GALLERY_ROW_2]));
            render(<MediaSection {...defaultProps} />);

            await waitFor(() => {
                const imgs = screen.getAllByRole('img');
                expect(imgs).toHaveLength(3);
            });
        });
    });

    // ── Adding a gallery photo ─────────────────────────────────────────

    describe('adding a gallery photo', () => {
        it('calls addMedia after a successful upload — immediately, not deferred to a save', async () => {
            stubFetchUploadOk();
            mockAddMedia.mockReturnValue(makeAddOk());

            render(<MediaSection {...defaultProps} />);
            await waitFor(() => expect(mockListMedia).toHaveBeenCalled());

            const { gallery } = fileInputs();
            const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
            fireEvent.change(gallery, { target: { files: [file] } });

            await waitFor(() => {
                expect(mockAddMedia).toHaveBeenCalledWith({
                    vertical: 'gastronomy',
                    id: LISTING_ID,
                    body: expect.objectContaining({
                        url: NEW_ROW.url,
                        publicId: NEW_ROW.publicId,
                        moderationState: 'APPROVED'
                    })
                });
            });

            // No Save button exists on this component — the call above already
            // proves persistence happened without one. The new item appears too.
            await waitFor(() => {
                const imgs = screen.getAllByRole('img');
                expect(imgs.map((i) => i.getAttribute('src'))).toContain(NEW_ROW.url);
            });
        });

        it('does NOT mutate gallery state when addMedia fails, and surfaces the error', async () => {
            stubFetchUploadOk();
            mockAddMedia.mockReturnValue(makeError('quota exceeded'));

            render(<MediaSection {...defaultProps} />);
            await waitFor(() => expect(mockListMedia).toHaveBeenCalled());

            const { gallery } = fileInputs();
            const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
            fireEvent.change(gallery, { target: { files: [file] } });

            await waitFor(() => {
                expect(screen.getByText('quota exceeded')).toBeInTheDocument();
            });
            expect(screen.queryAllByRole('img')).toHaveLength(0);
            expect(mockAddToast).toHaveBeenCalledWith({ type: 'error', message: 'quota exceeded' });
        });
    });

    // ── Removing a gallery photo ───────────────────────────────────────

    describe('removing a gallery photo', () => {
        it('calls removeMedia immediately and does NOT fire a client-side Cloudinary delete (the server does it)', async () => {
            mockListMedia.mockReturnValue(makeListOk([GALLERY_ROW_1, GALLERY_ROW_2]));
            mockRemoveMedia.mockReturnValue(makeRemoveOk());

            render(<MediaSection {...defaultProps} />);
            await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(2));

            const removeButtons = screen.getAllByLabelText('Eliminar');
            fireEvent.click(removeButtons[0]);

            await waitFor(() => {
                expect(mockRemoveMedia).toHaveBeenCalledWith({
                    vertical: 'gastronomy',
                    id: LISTING_ID,
                    mediaId: GALLERY_ROW_1.id
                });
            });

            await waitFor(() => {
                const imgs = screen.getAllByRole('img');
                expect(imgs).toHaveLength(1);
                expect(imgs[0]).toHaveAttribute('src', GALLERY_ROW_2.url);
            });

            // HOS-372: the binary is deleted server-side, inside removeMedia,
            // BEFORE the row is dropped. The old client-side call this replaced
            // could never have succeeded — `media/protected/delete-entity`
            // rejects `gastronomy`/`experience` with HTTP 400.
            expect(mockDeleteMedia).not.toHaveBeenCalled();
        });

        it('does NOT remove the item from state when removeMedia fails, and never calls the Cloudinary cleanup', async () => {
            mockListMedia.mockReturnValue(makeListOk([GALLERY_ROW_1]));
            mockRemoveMedia.mockReturnValue(makeError('remove failed'));

            render(<MediaSection {...defaultProps} />);
            await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1));

            fireEvent.click(screen.getByLabelText('Eliminar'));

            await waitFor(() => {
                expect(screen.getByText('remove failed')).toBeInTheDocument();
            });
            expect(screen.getAllByRole('img')).toHaveLength(1);
            expect(mockDeleteMedia).not.toHaveBeenCalled();
        });
    });

    // ── Setting a new featured image ───────────────────────────────────

    describe('setting a new featured image', () => {
        it('calls upload → addMedia → setFeaturedMedia immediately and updates the featured slot', async () => {
            mockListMedia.mockReturnValue(makeListOk([GALLERY_ROW_1]));
            stubFetchUploadOk();
            mockAddMedia.mockReturnValue(makeAddOk({ ...NEW_ROW, isFeatured: false }));
            const featuredRow = { ...NEW_ROW, isFeatured: true };
            mockSetFeaturedMedia.mockReturnValue(
                Promise.resolve({ ok: true as const, data: { media: featuredRow } })
            );

            render(<MediaSection {...defaultProps} />);
            await waitFor(() => expect(mockListMedia).toHaveBeenCalled());

            const { featured } = fileInputs();
            const file = new File(['img'], 'portada.jpg', { type: 'image/jpeg' });
            fireEvent.change(featured, { target: { files: [file] } });

            await waitFor(() => {
                expect(mockAddMedia).toHaveBeenCalledWith({
                    vertical: 'gastronomy',
                    id: LISTING_ID,
                    body: expect.objectContaining({ url: NEW_ROW.url })
                });
            });

            await waitFor(() => {
                expect(mockSetFeaturedMedia).toHaveBeenCalledWith({
                    vertical: 'gastronomy',
                    id: LISTING_ID,
                    mediaId: NEW_ROW.id
                });
            });

            await waitFor(() => {
                const img = screen.getByAltText('Imagen principal');
                expect(img).toHaveAttribute('src', featuredRow.url);
            });
        });

        it('moves the previous featured image to the gallery when a new one is set', async () => {
            mockListMedia.mockReturnValue(makeListOk([FEATURED_ROW]));
            stubFetchUploadOk();
            mockAddMedia.mockReturnValue(makeAddOk({ ...NEW_ROW, isFeatured: false }));
            const newFeaturedRow = { ...NEW_ROW, isFeatured: true };
            mockSetFeaturedMedia.mockReturnValue(
                Promise.resolve({ ok: true as const, data: { media: newFeaturedRow } })
            );

            render(<MediaSection {...defaultProps} />);
            await waitFor(() => {
                expect(screen.getByAltText('Imagen principal')).toHaveAttribute(
                    'src',
                    FEATURED_ROW.url
                );
            });

            const { featured } = fileInputs();
            const file = new File(['img'], 'new-portada.jpg', { type: 'image/jpeg' });
            fireEvent.change(featured, { target: { files: [file] } });

            await waitFor(() => {
                expect(screen.getByAltText('Imagen principal')).toHaveAttribute(
                    'src',
                    newFeaturedRow.url
                );
            });

            await waitFor(() => {
                const urls = screen.getAllByRole('img').map((i) => i.getAttribute('src'));
                expect(urls).toContain(FEATURED_ROW.url);
            });
        });

        it('surfaces an inline error + toast and keeps state when setFeaturedMedia fails', async () => {
            mockListMedia.mockReturnValue(makeListOk([]));
            stubFetchUploadOk();
            mockAddMedia.mockReturnValue(makeAddOk({ ...NEW_ROW, isFeatured: false }));
            mockSetFeaturedMedia.mockReturnValue(makeError('featured op failed'));

            render(<MediaSection {...defaultProps} />);
            await waitFor(() => expect(mockListMedia).toHaveBeenCalled());

            const { featured } = fileInputs();
            const file = new File(['img'], 'portada.jpg', { type: 'image/jpeg' });
            fireEvent.change(featured, { target: { files: [file] } });

            await waitFor(() => {
                expect(screen.getByText('featured op failed')).toBeInTheDocument();
            });
            expect(screen.queryByAltText('Imagen principal')).not.toBeInTheDocument();
            expect(mockAddToast).toHaveBeenCalledWith({
                type: 'error',
                message: 'featured op failed'
            });
        });

        it('removing the featured image calls removeMedia and no client-side Cloudinary delete', async () => {
            mockListMedia.mockReturnValue(makeListOk([FEATURED_ROW]));
            mockRemoveMedia.mockReturnValue(makeRemoveOk());

            render(<MediaSection {...defaultProps} />);
            await waitFor(() => {
                expect(screen.getByAltText('Imagen principal')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByLabelText('Eliminar'));

            await waitFor(() => {
                expect(mockRemoveMedia).toHaveBeenCalledWith({
                    vertical: 'gastronomy',
                    id: LISTING_ID,
                    mediaId: FEATURED_ROW.id
                });
            });
            await waitFor(() => {
                expect(screen.queryByAltText('Imagen principal')).not.toBeInTheDocument();
            });
            // HOS-372: deletion of the binary moved server-side (see the gallery
            // removal test above for the full rationale).
            expect(mockDeleteMedia).not.toHaveBeenCalled();
        });
    });

    // ── Gallery cap enforcement ────────────────────────────────────────

    describe('gallery cap enforcement', () => {
        const GALLERY_CAP = getGalleryCap('gastronomy');

        it('hides the add (+) button when the gallery is at the cap', async () => {
            const fullGallery = Array.from({ length: GALLERY_CAP }, (_, i) => ({
                ...GALLERY_ROW_1,
                id: `g-${i}`,
                url: `https://cdn.example.com/g${i}.jpg`,
                publicId: `gallery/g${i}`
            }));
            mockListMedia.mockReturnValue(makeListOk(fullGallery));

            render(<MediaSection {...defaultProps} />);

            await waitFor(() => {
                expect(screen.queryByText('+')).not.toBeInTheDocument();
            });
        });

        it('shows the add (+) button when the gallery is below the cap', async () => {
            render(<MediaSection {...defaultProps} />);
            await waitFor(() => {
                expect(screen.getByText('+')).toBeInTheDocument();
            });
        });
    });

    // ── File-size validation (HOS-322, retained) ───────────────────────

    describe('file-size validation (HOS-322)', () => {
        const CAP_BYTES = mbToBytes(DEFAULT_ENTITY_MAX_FILE_SIZE_MB);

        it('states the real cap in the upload hint', async () => {
            render(<MediaSection {...defaultProps} />);
            await waitFor(() => expect(mockListMedia).toHaveBeenCalled());

            const hint = screen.getByText((content) => content.includes('máx.'));
            expect(hint.textContent).toContain(String(DEFAULT_ENTITY_MAX_FILE_SIZE_MB));
            expect(hint.textContent).not.toContain('{{');
        });

        it('accepts a photo above the old 5 MB ceiling', async () => {
            stubFetchUploadOk();
            mockAddMedia.mockReturnValue(makeAddOk());

            render(<MediaSection {...defaultProps} />);
            await waitFor(() => expect(mockListMedia).toHaveBeenCalled());

            const { featured } = fileInputs();
            fireEvent.change(featured, {
                target: { files: [fileOfBytes(CAP_BYTES - mbToBytes(1))] }
            });

            await waitFor(() => expect(global.fetch).toHaveBeenCalled());
        });

        it('refuses a photo over the cap without calling the API, naming the cap', async () => {
            render(<MediaSection {...defaultProps} />);
            await waitFor(() => expect(mockListMedia).toHaveBeenCalled());
            global.fetch = vi.fn();

            const { featured } = fileInputs();
            fireEvent.change(featured, { target: { files: [fileOfBytes(CAP_BYTES + 1)] } });

            await waitFor(() => {
                const alert = screen.getByText((content) => content.includes('no puede superar'));
                expect(alert.textContent).toContain(String(DEFAULT_ENTITY_MAX_FILE_SIZE_MB));
            });
            expect(global.fetch).not.toHaveBeenCalled();
            expect(mockAddToast).toHaveBeenCalled();
        });
    });
});
