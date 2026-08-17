/**
 * @file ContentMediaSection.test.tsx
 * @description Tests for the shared post/event media editor (HOS-374 2D / HOS-390).
 *
 * Covers the per-operation persistence contract, ported from
 * `test/components/commerce/editor/MediaSection.test.tsx`:
 * - On mount: hydrates from `contentMediaApi.listMedia` and splits featured vs
 *   gallery, per entity.
 * - Adding a gallery photo calls `addMedia` immediately (NOT deferred to the
 *   editor's Save) and shows it in the grid.
 * - Removing calls `removeMedia` immediately and fires NO client-side Cloudinary
 *   delete — the server deletes the binary inside `removeMedia`, before dropping
 *   the row, so a client-side delete would be a second delete of a gone asset.
 * - Setting a featured image runs upload → addMedia → setFeaturedMedia, and the
 *   previous featured moves to the gallery.
 * - A failed operation surfaces an inline error + toast and does NOT mutate
 *   state (the UI never claims success on failure).
 * - Gallery cap enforcement, per entity (post 15, event 10 — different caps are
 *   the reason the cap assertions are derived from `getGalleryCap`, not typed in).
 * - The moderation lock (`disabled`) closes every write affordance. This is the
 *   one behavior with no commerce counterpart: commerce listings have no
 *   author-edit lock, posts and events do (HOS-374 §7.6.3).
 *
 * @module test/components/account/editor/ContentMediaSection
 */

import { DEFAULT_ENTITY_MAX_FILE_SIZE_MB, mbToBytes } from '@repo/media';
import { getGalleryCap } from '@repo/schemas';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContentMediaSectionProps } from '../../../../src/components/account/editor/ContentMediaSection.client';
import { ContentMediaSection } from '../../../../src/components/account/editor/ContentMediaSection.client';

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
    contentMediaApi: {
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
        },
        // Matches the real `createTranslations().tPlural`: no fallback arg,
        // just key + count + optional extra params.
        tPlural: (key: string, count: number, params?: Record<string, string | number>): string =>
            Object.entries({ ...params, count }).reduce(
                (acc, [name, value]) => acc.replaceAll(`{{${name}}}`, String(value)),
                key
            )
    })
}));

const POST_ID = '00000000-0000-4000-8000-0000000000aa';

const defaultProps: ContentMediaSectionProps = {
    locale: 'es',
    entity: 'post',
    entityId: POST_ID
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FEATURED_ROW = {
    id: 'media-uuid-featured',
    url: 'https://cdn.example.com/featured.jpg',
    publicId: 'hospeda/posts/abc/gallery/img-featured',
    isFeatured: true,
    sortOrder: 0,
    state: 'visible' as const,
    moderationState: 'APPROVED'
};

const GALLERY_ROW_1 = {
    id: 'media-uuid-g1',
    url: 'https://cdn.example.com/gallery1.jpg',
    publicId: 'hospeda/posts/abc/gallery/img-g1',
    isFeatured: false,
    sortOrder: 1,
    state: 'visible' as const,
    moderationState: 'APPROVED'
};

const NEW_ROW = {
    id: 'media-uuid-new',
    url: 'https://cdn.example.com/new.jpg',
    publicId: 'hospeda/posts/abc/gallery/img-new',
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
    new File([new Uint8Array(new ArrayBuffer(bytes))], 'photo.jpg', { type: 'image/jpeg' });

function fileInputs(): { featured: HTMLInputElement; gallery: HTMLInputElement } {
    const inputs = document.querySelectorAll('input[type="file"]');
    return { featured: inputs[0] as HTMLInputElement, gallery: inputs[1] as HTMLInputElement };
}

/** Waits for the mount-time hydration to settle so writes are enabled. */
async function renderHydrated(props: Partial<ContentMediaSectionProps> = {}) {
    const view = render(
        <ContentMediaSection
            {...defaultProps}
            {...props}
        />
    );
    await waitFor(() => expect(mockListMedia).toHaveBeenCalled());
    return view;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ContentMediaSection — per-operation persistence (HOS-390)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockListMedia.mockReturnValue(makeListEmpty());
        mockDeleteMedia.mockResolvedValue({ ok: true, data: { deleted: true } });
        stubFetchUploadOk();
    });

    // ── Hydration ───────────────────────────────────────────────────────

    describe('hydration from listMedia on mount', () => {
        it('calls listMedia with the entity and id on mount', async () => {
            await renderHydrated();

            expect(mockListMedia).toHaveBeenCalledWith({ entity: 'post', id: POST_ID });
        });

        it('uses the event endpoint when the entity is an event', async () => {
            await renderHydrated({ entity: 'event', entityId: 'event-uuid' });

            expect(mockListMedia).toHaveBeenCalledWith({ entity: 'event', id: 'event-uuid' });
        });

        it('splits the response into the featured slot and the gallery', async () => {
            mockListMedia.mockReturnValue(makeListOk());
            await renderHydrated();

            await waitFor(() => {
                const images = screen.getAllByRole('img');
                expect(images.map((i) => i.getAttribute('src'))).toEqual([
                    FEATURED_ROW.url,
                    GALLERY_ROW_1.url
                ]);
            });
        });
    });

    // ── Gallery add ─────────────────────────────────────────────────────

    describe('adding a gallery photo', () => {
        it('persists immediately via addMedia and shows the new photo', async () => {
            mockAddMedia.mockReturnValue(makeAddOk());
            await renderHydrated();

            fireEvent.change(fileInputs().gallery, { target: { files: [fileOfBytes(1024)] } });

            await waitFor(() => {
                expect(mockAddMedia).toHaveBeenCalledWith({
                    entity: 'post',
                    id: POST_ID,
                    body: expect.objectContaining({
                        url: NEW_ROW.url,
                        publicId: NEW_ROW.publicId,
                        moderationState: 'APPROVED'
                    })
                });
            });
            await waitFor(() => {
                expect(
                    screen.getAllByRole('img').some((i) => i.getAttribute('src') === NEW_ROW.url)
                ).toBe(true);
            });
        });

        it('shows an inline error + toast and adds nothing when addMedia fails', async () => {
            mockAddMedia.mockReturnValue(makeError('quota exceeded'));
            await renderHydrated();

            fireEvent.change(fileInputs().gallery, { target: { files: [fileOfBytes(1024)] } });

            await waitFor(() => {
                expect(screen.getByRole('alert')).toHaveTextContent('quota exceeded');
            });
            expect(mockAddToast).toHaveBeenCalledWith({
                type: 'error',
                message: 'quota exceeded'
            });
            expect(
                screen.queryAllByRole('img').some((i) => i.getAttribute('src') === NEW_ROW.url)
            ).toBe(false);
        });

        it('rejects a file over the size cap without uploading', async () => {
            await renderHydrated();

            const overCap = mbToBytes(DEFAULT_ENTITY_MAX_FILE_SIZE_MB) + 1;
            fireEvent.change(fileInputs().gallery, { target: { files: [fileOfBytes(overCap)] } });

            await waitFor(() => {
                expect(screen.getByRole('alert')).toHaveTextContent(
                    `no puede superar ${DEFAULT_ENTITY_MAX_FILE_SIZE_MB}MB`
                );
            });
            expect(global.fetch).not.toHaveBeenCalled();
            expect(mockAddMedia).not.toHaveBeenCalled();
        });

        it('rejects a non-image type without uploading', async () => {
            await renderHydrated();

            const pdf = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
            fireEvent.change(fileInputs().gallery, { target: { files: [pdf] } });

            await waitFor(() => {
                expect(screen.getByRole('alert')).toHaveTextContent('JPG, PNG o WebP');
            });
            expect(global.fetch).not.toHaveBeenCalled();
        });
    });

    // ── Gallery cap ─────────────────────────────────────────────────────

    describe('gallery cap', () => {
        it.each([
            ['post' as const, POST_ID],
            ['event' as const, 'event-uuid']
        ])('hides the add button for %s once the cap is reached', async (entity, id) => {
            const cap = getGalleryCap(entity);
            const rows = Array.from({ length: cap }, (_, i) => ({
                ...GALLERY_ROW_1,
                id: `g-${i}`,
                url: `https://cdn.example.com/g${i}.jpg`
            }));
            mockListMedia.mockReturnValue(makeListOk(rows));

            await renderHydrated({ entity, entityId: id });

            await waitFor(() => {
                expect(screen.getAllByRole('img')).toHaveLength(cap);
            });
            expect(screen.queryByLabelText('Agregar foto')).not.toBeInTheDocument();
        });

        it('uses a different cap for events than for posts', () => {
            // Guards the parameterization itself: if both resolved to the same
            // number, the per-entity test above would pass while proving nothing.
            expect(getGalleryCap('event')).not.toBe(getGalleryCap('post'));
        });
    });

    // ── Remove ──────────────────────────────────────────────────────────

    describe('removing a photo', () => {
        it('calls removeMedia and drops the item from the grid', async () => {
            mockListMedia.mockReturnValue(makeListOk([GALLERY_ROW_1]));
            mockRemoveMedia.mockReturnValue(makeRemoveOk());
            await renderHydrated();

            await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1));
            fireEvent.click(screen.getAllByLabelText('Eliminar')[0] as HTMLElement);

            await waitFor(() => {
                expect(mockRemoveMedia).toHaveBeenCalledWith({
                    entity: 'post',
                    id: POST_ID,
                    mediaId: GALLERY_ROW_1.id
                });
            });
            await waitFor(() => expect(screen.queryAllByRole('img')).toHaveLength(0));
        });

        it('never fires a client-side Cloudinary delete — the server owns it', async () => {
            mockListMedia.mockReturnValue(makeListOk([GALLERY_ROW_1]));
            mockRemoveMedia.mockReturnValue(makeRemoveOk());
            await renderHydrated();

            await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1));
            fireEvent.click(screen.getAllByLabelText('Eliminar')[0] as HTMLElement);

            await waitFor(() => expect(mockRemoveMedia).toHaveBeenCalled());
            expect(mockDeleteMedia).not.toHaveBeenCalled();
        });

        it('keeps the item when removeMedia fails', async () => {
            mockListMedia.mockReturnValue(makeListOk([GALLERY_ROW_1]));
            mockRemoveMedia.mockReturnValue(makeError('remove failed'));
            await renderHydrated();

            await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1));
            fireEvent.click(screen.getAllByLabelText('Eliminar')[0] as HTMLElement);

            await waitFor(() => {
                expect(screen.getByRole('alert')).toHaveTextContent('remove failed');
            });
            expect(screen.getAllByRole('img')).toHaveLength(1);
        });
    });

    // ── Featured ────────────────────────────────────────────────────────

    describe('setting the featured image', () => {
        it('runs upload → addMedia → setFeaturedMedia and moves the old one to the gallery', async () => {
            mockListMedia.mockReturnValue(makeListOk([FEATURED_ROW]));
            mockAddMedia.mockReturnValue(makeAddOk());
            mockSetFeaturedMedia.mockReturnValue(
                Promise.resolve({
                    ok: true as const,
                    data: { media: { ...NEW_ROW, isFeatured: true } }
                })
            );
            await renderHydrated();

            await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1));
            fireEvent.change(fileInputs().featured, { target: { files: [fileOfBytes(1024)] } });

            await waitFor(() => {
                expect(mockSetFeaturedMedia).toHaveBeenCalledWith({
                    entity: 'post',
                    id: POST_ID,
                    mediaId: NEW_ROW.id
                });
            });
            // Old featured demoted into the gallery, new one in the featured slot.
            await waitFor(() => {
                const srcs = screen.getAllByRole('img').map((i) => i.getAttribute('src'));
                expect(srcs).toContain(NEW_ROW.url);
                expect(srcs).toContain(FEATURED_ROW.url);
            });
        });

        it('reports an error and keeps the old featured when setFeaturedMedia fails', async () => {
            mockListMedia.mockReturnValue(makeListOk([FEATURED_ROW]));
            mockAddMedia.mockReturnValue(makeAddOk());
            mockSetFeaturedMedia.mockReturnValue(makeError('featured op failed'));
            await renderHydrated();

            await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1));
            fireEvent.change(fileInputs().featured, { target: { files: [fileOfBytes(1024)] } });

            await waitFor(() => {
                expect(screen.getByRole('alert')).toHaveTextContent('featured op failed');
            });
            expect(mockAddToast).toHaveBeenCalledWith({
                type: 'error',
                message: 'featured op failed'
            });
            expect(screen.getAllByRole('img').map((i) => i.getAttribute('src'))).toEqual([
                FEATURED_ROW.url
            ]);
        });
    });

    // ── Moderation lock ─────────────────────────────────────────────────

    describe('moderation lock (disabled)', () => {
        it('disables every write affordance', async () => {
            mockListMedia.mockReturnValue(makeListOk([FEATURED_ROW, GALLERY_ROW_1]));
            await renderHydrated({ disabled: true });

            await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(2));

            for (const button of screen.getAllByLabelText('Eliminar')) {
                expect(button).toBeDisabled();
            }
            expect(screen.getByLabelText('Agregar foto')).toBeDisabled();
            const { featured, gallery } = fileInputs();
            expect(featured).toBeDisabled();
            expect(gallery).toBeDisabled();
        });

        it('does not call the API when a change slips through on a locked editor', async () => {
            mockListMedia.mockReturnValue(makeListEmpty());
            await renderHydrated({ disabled: true });

            // A disabled input cannot be changed by a user, but fireEvent can —
            // this asserts the affordance is the ONLY guard we rely on client
            // side, and documents that the server gate is what actually protects
            // the write (checkCanUpdatePost).
            fireEvent.change(fileInputs().gallery, { target: { files: [fileOfBytes(1024)] } });

            await waitFor(() => expect(mockListMedia).toHaveBeenCalled());
            expect(mockAddMedia).not.toHaveBeenCalled();
        });
    });
});
