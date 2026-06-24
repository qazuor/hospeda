/**
 * @file PhotoSection.test.tsx
 * @description Tests for the self-contained PhotoSection component (SPEC-204).
 *
 * Covers:
 * - On mount: hydrates from listMedia and splits featured vs gallery
 * - SSR initial* props shown as first-paint until listMedia resolves
 * - Adding a gallery photo calls addMedia and shows it in the grid
 * - Removing a gallery photo calls removeMedia and removes it from state
 * - Setting a new featured calls upload → addMedia → setFeaturedMedia,
 *   and the previous featured moves to the gallery
 * - An operation failure surfaces an inline error and does NOT mutate state
 * - Gallery cap enforcement: add button hidden + message shown at cap
 * - Section title / description always rendered
 */

import { PhotoSection } from '@/components/host/editor/PhotoSection.client';
import type { PhotoSectionProps } from '@/components/host/editor/PhotoSection.client';
import { ENTITY_GALLERY_CAPS } from '@repo/schemas';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks (vi.hoisted executes before vi.mock factories)
// ---------------------------------------------------------------------------

const {
    mockListMedia,
    mockAddMedia,
    mockRemoveMedia,
    mockSetFeaturedMedia,
    mockUploadEntityImage
} = vi.hoisted(() => ({
    mockListMedia: vi.fn(),
    mockAddMedia: vi.fn(),
    mockRemoveMedia: vi.fn(),
    mockSetFeaturedMedia: vi.fn(),
    mockUploadEntityImage: vi.fn()
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('@/components/host/editor/PhotoSection.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_t, prop) => String(prop)
    })
}));

vi.mock('@/lib/logger', () => ({
    webLogger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));

vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationMediaApi: {
        listMedia: mockListMedia,
        addMedia: mockAddMedia,
        removeMedia: mockRemoveMedia,
        setFeaturedMedia: mockSetFeaturedMedia
    },
    // protectedMediaApi kept for backward compat (not used by new PhotoSection)
    protectedMediaApi: {
        deleteMedia: vi.fn().mockResolvedValue({ ok: true })
    }
}));

// Mock the upload helper at its source module so PhotoSection picks up the mock
vi.mock('@/lib/media/upload-entity', () => ({
    uploadEntityImage: mockUploadEntityImage
}));

vi.mock('@repo/schemas', () => ({
    ENTITY_GALLERY_CAPS: { accommodation: 50 }
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACC_ID = 'acc-uuid-123';

const FEATURED_ROW = {
    id: 'media-uuid-featured',
    url: 'https://cdn.example.com/featured.jpg',
    publicId: 'hospeda/accommodations/abc/gallery/img-featured',
    isFeatured: true,
    sortOrder: 0,
    state: 'visible' as const,
    moderationState: 'APPROVED'
};

const GALLERY_ROW_1 = {
    id: 'media-uuid-g1',
    url: 'https://cdn.example.com/gallery1.jpg',
    publicId: 'hospeda/accommodations/abc/gallery/img-g1',
    isFeatured: false,
    sortOrder: 1,
    state: 'visible' as const,
    moderationState: 'APPROVED'
};

const GALLERY_ROW_2 = {
    id: 'media-uuid-g2',
    url: 'https://cdn.example.com/gallery2.jpg',
    publicId: 'hospeda/accommodations/abc/gallery/img-g2',
    isFeatured: false,
    sortOrder: 2,
    state: 'visible' as const,
    moderationState: 'APPROVED'
};

const NEW_ROW = {
    id: 'media-uuid-new',
    url: 'https://cdn.example.com/new.jpg',
    publicId: 'hospeda/accommodations/abc/gallery/img-new',
    isFeatured: false,
    sortOrder: 3,
    state: 'visible' as const,
    moderationState: 'APPROVED'
};

/** Default props — minimal, self-contained. */
const defaultProps: PhotoSectionProps = {
    locale: 'es',
    accommodationId: ACC_ID
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Make a resolved listMedia response with featured + gallery rows. */
function makeListOk(rows = [FEATURED_ROW, GALLERY_ROW_1]) {
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

function makeUploadOk(url = NEW_ROW.url, publicId = NEW_ROW.publicId) {
    return Promise.resolve({ url, publicId, width: 800, height: 600 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PhotoSection (SPEC-204 — self-contained)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: empty list (no media in DB)
        mockListMedia.mockReturnValue(makeListEmpty());
    });

    // ── Section structure ──────────────────────────────────────────────────

    describe('section structure', () => {
        it('renders section title', async () => {
            render(<PhotoSection {...defaultProps} />);
            await waitFor(() => expect(screen.getByText('Fotos')).toBeInTheDocument());
        });

        it('renders section description', async () => {
            render(<PhotoSection {...defaultProps} />);
            await waitFor(() => {
                expect(
                    screen.getByText('Subí fotos de tu propiedad para atraer más huéspedes')
                ).toBeInTheDocument();
            });
        });

        it('renders upload area when no featured image', async () => {
            render(<PhotoSection {...defaultProps} />);
            await waitFor(() => {
                expect(
                    screen.getByText('Arrastrá una imagen o hacé clic para seleccionar')
                ).toBeInTheDocument();
            });
        });

        it('renders gallery add (+) button when gallery is empty', async () => {
            render(<PhotoSection {...defaultProps} />);
            await waitFor(() => {
                expect(screen.getByText('+')).toBeInTheDocument();
            });
        });
    });

    // ── 1. Hydration from listMedia ────────────────────────────────────────

    describe('hydration from listMedia on mount', () => {
        it('calls listMedia with the accommodation id on mount', async () => {
            render(<PhotoSection {...defaultProps} />);
            await waitFor(() => {
                expect(mockListMedia).toHaveBeenCalledWith({ id: ACC_ID });
            });
        });

        it('splits the featured row into the portada slot', async () => {
            mockListMedia.mockReturnValue(makeListOk([FEATURED_ROW, GALLERY_ROW_1]));
            render(<PhotoSection {...defaultProps} />);

            await waitFor(() => {
                const img = screen.getByAltText('Imagen principal');
                expect(img).toHaveAttribute('src', FEATURED_ROW.url);
            });
        });

        it('splits non-featured rows into the gallery grid', async () => {
            mockListMedia.mockReturnValue(makeListOk([FEATURED_ROW, GALLERY_ROW_1, GALLERY_ROW_2]));
            render(<PhotoSection {...defaultProps} />);

            await waitFor(() => {
                // 1 featured + 2 gallery = 3 imgs total
                const imgs = screen.getAllByRole('img');
                expect(imgs).toHaveLength(3);
            });
        });

        it('uses SSR initialFeaturedImage for display before listMedia resolves', () => {
            // Keep listMedia pending forever
            mockListMedia.mockReturnValue(new Promise(() => {}));

            const initialFeaturedImage = {
                url: 'https://cdn.example.com/ssr-featured.jpg',
                publicId: 'ssr-featured',
                width: 1920,
                height: 1080
            };

            render(
                <PhotoSection
                    {...defaultProps}
                    initialFeaturedImage={initialFeaturedImage}
                />
            );

            // Rendered synchronously from initial state
            const img = screen.getByAltText('Imagen principal');
            expect(img).toHaveAttribute('src', initialFeaturedImage.url);
        });
    });

    // ── 2. Adding a gallery photo ──────────────────────────────────────────

    describe('adding a gallery photo', () => {
        it('calls addMedia after a successful upload and shows the new item', async () => {
            mockUploadEntityImage.mockReturnValue(makeUploadOk());
            mockAddMedia.mockReturnValue(makeAddOk());

            render(<PhotoSection {...defaultProps} />);

            // Wait for hydration
            await waitFor(() => expect(mockListMedia).toHaveBeenCalled());

            const galleryInput = document.querySelector('#gallery-image-input') as HTMLInputElement;
            const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
            fireEvent.change(galleryInput, { target: { files: [file] } });

            await waitFor(() => {
                expect(mockAddMedia).toHaveBeenCalledWith({
                    id: ACC_ID,
                    body: expect.objectContaining({
                        url: NEW_ROW.url,
                        publicId: NEW_ROW.publicId,
                        moderationState: 'APPROVED'
                    })
                });
            });

            // New gallery image appears
            await waitFor(() => {
                const imgs = screen.getAllByRole('img');
                const urls = imgs.map((i) => i.getAttribute('src'));
                expect(urls).toContain(NEW_ROW.url);
            });
        });

        it('does NOT mutate gallery state when addMedia fails', async () => {
            mockUploadEntityImage.mockReturnValue(makeUploadOk());
            mockAddMedia.mockReturnValue(makeError('quota exceeded'));

            render(<PhotoSection {...defaultProps} />);
            await waitFor(() => expect(mockListMedia).toHaveBeenCalled());

            const galleryInput = document.querySelector('#gallery-image-input') as HTMLInputElement;
            const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
            fireEvent.change(galleryInput, { target: { files: [file] } });

            await waitFor(() => {
                expect(screen.getByText('quota exceeded')).toBeInTheDocument();
            });

            // No gallery images should appear
            expect(screen.queryAllByRole('img')).toHaveLength(0);
        });
    });

    // ── 3. Removing a gallery photo ────────────────────────────────────────

    describe('removing a gallery photo', () => {
        it('calls removeMedia with the gallery item id and removes it from state', async () => {
            mockListMedia.mockReturnValue(makeListOk([GALLERY_ROW_1, GALLERY_ROW_2]));
            mockRemoveMedia.mockReturnValue(makeRemoveOk());

            render(<PhotoSection {...defaultProps} />);

            await waitFor(() => {
                const imgs = screen.getAllByRole('img');
                expect(imgs).toHaveLength(2);
            });

            const removeButtons = screen.getAllByLabelText('Eliminar');
            fireEvent.click(removeButtons[0]);

            await waitFor(() => {
                expect(mockRemoveMedia).toHaveBeenCalledWith({
                    id: ACC_ID,
                    mediaId: GALLERY_ROW_1.id
                });
            });

            await waitFor(() => {
                const imgs = screen.getAllByRole('img');
                expect(imgs).toHaveLength(1);
                expect(imgs[0]).toHaveAttribute('src', GALLERY_ROW_2.url);
            });
        });

        it('does NOT remove the item from state when removeMedia fails', async () => {
            mockListMedia.mockReturnValue(makeListOk([GALLERY_ROW_1]));
            mockRemoveMedia.mockReturnValue(makeError('remove failed'));

            render(<PhotoSection {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getAllByRole('img')).toHaveLength(1);
            });

            const removeButton = screen.getByLabelText('Eliminar');
            fireEvent.click(removeButton);

            await waitFor(() => {
                expect(screen.getByText('remove failed')).toBeInTheDocument();
            });

            // Image stays in state
            expect(screen.getAllByRole('img')).toHaveLength(1);
        });
    });

    // ── 4. Setting a new featured image ────────────────────────────────────

    describe('setting a new featured (portada)', () => {
        it('calls upload → addMedia → setFeaturedMedia and updates portada slot', async () => {
            // Start with no featured, one gallery
            mockListMedia.mockReturnValue(makeListOk([GALLERY_ROW_1]));
            mockUploadEntityImage.mockReturnValue(makeUploadOk());
            mockAddMedia.mockReturnValue(makeAddOk({ ...NEW_ROW, isFeatured: false }));
            const featuredRow = { ...NEW_ROW, isFeatured: true };
            mockSetFeaturedMedia.mockReturnValue(
                Promise.resolve({ ok: true as const, data: { media: featuredRow } })
            );

            render(<PhotoSection {...defaultProps} />);

            // Wait for hydration — no featured yet
            await waitFor(() => {
                expect(
                    screen.getByText('Arrastrá una imagen o hacé clic para seleccionar')
                ).toBeInTheDocument();
            });

            const featuredInput = document.querySelector(
                '#featured-image-input'
            ) as HTMLInputElement;
            const file = new File(['img'], 'portada.jpg', { type: 'image/jpeg' });
            fireEvent.change(featuredInput, { target: { files: [file] } });

            await waitFor(() => {
                expect(mockAddMedia).toHaveBeenCalledWith({
                    id: ACC_ID,
                    body: expect.objectContaining({ url: NEW_ROW.url })
                });
            });

            await waitFor(() => {
                expect(mockSetFeaturedMedia).toHaveBeenCalledWith({
                    id: ACC_ID,
                    mediaId: NEW_ROW.id
                });
            });

            // The portada slot now shows the new image
            await waitFor(() => {
                const img = screen.getByAltText('Imagen principal');
                expect(img).toHaveAttribute('src', featuredRow.url);
            });
        });

        it('moves the previous featured to the gallery when a new portada is set', async () => {
            // Start with a featured row already present
            mockListMedia.mockReturnValue(makeListOk([FEATURED_ROW]));
            mockUploadEntityImage.mockReturnValue(makeUploadOk());
            mockAddMedia.mockReturnValue(makeAddOk({ ...NEW_ROW, isFeatured: false }));
            const newFeaturedRow = { ...NEW_ROW, isFeatured: true };
            mockSetFeaturedMedia.mockReturnValue(
                Promise.resolve({ ok: true as const, data: { media: newFeaturedRow } })
            );

            render(<PhotoSection {...defaultProps} />);

            // Wait for featured to show (portada slot)
            await waitFor(() => {
                expect(screen.getByAltText('Imagen principal')).toHaveAttribute(
                    'src',
                    FEATURED_ROW.url
                );
            });

            const featuredInput = document.querySelector(
                '#featured-image-input'
            ) as HTMLInputElement;
            const file = new File(['img'], 'new-portada.jpg', { type: 'image/jpeg' });
            fireEvent.change(featuredInput, { target: { files: [file] } });

            // After the op completes: new portada is in featured slot
            await waitFor(() => {
                expect(screen.getByAltText('Imagen principal')).toHaveAttribute(
                    'src',
                    newFeaturedRow.url
                );
            });

            // Old featured moved to gallery grid — its url is now a gallery img
            await waitFor(() => {
                const imgs = screen.getAllByRole('img');
                const urls = imgs.map((i) => i.getAttribute('src'));
                expect(urls).toContain(FEATURED_ROW.url);
            });
        });

        it('surfaces an inline error and keeps state when setFeaturedMedia fails', async () => {
            mockListMedia.mockReturnValue(makeListOk([]));
            mockUploadEntityImage.mockReturnValue(makeUploadOk());
            mockAddMedia.mockReturnValue(makeAddOk({ ...NEW_ROW, isFeatured: false }));
            mockSetFeaturedMedia.mockReturnValue(makeError('featured op failed'));

            render(<PhotoSection {...defaultProps} />);
            await waitFor(() => expect(mockListMedia).toHaveBeenCalled());

            const featuredInput = document.querySelector(
                '#featured-image-input'
            ) as HTMLInputElement;
            const file = new File(['img'], 'portada.jpg', { type: 'image/jpeg' });
            fireEvent.change(featuredInput, { target: { files: [file] } });

            await waitFor(() => {
                expect(screen.getByText('featured op failed')).toBeInTheDocument();
            });

            // No featured image in slot
            expect(screen.queryByAltText('Imagen principal')).not.toBeInTheDocument();
        });
    });

    // ── 5. Gallery cap enforcement ─────────────────────────────────────────

    describe('gallery cap enforcement', () => {
        const GALLERY_CAP = ENTITY_GALLERY_CAPS.accommodation;

        it('hides the add (+) button when gallery is at the cap', async () => {
            const fullGallery = Array.from({ length: GALLERY_CAP }, (_, i) => ({
                ...GALLERY_ROW_1,
                id: `g-${i}`,
                url: `https://cdn.example.com/g${i}.jpg`,
                publicId: `gallery/g${i}`
            }));
            mockListMedia.mockReturnValue(makeListOk(fullGallery));

            render(<PhotoSection {...defaultProps} />);

            await waitFor(() => {
                expect(screen.queryByText('+')).not.toBeInTheDocument();
            });
        });

        it('shows a cap-reached message when gallery is full', async () => {
            const fullGallery = Array.from({ length: GALLERY_CAP }, (_, i) => ({
                ...GALLERY_ROW_1,
                id: `g-${i}`,
                url: `https://cdn.example.com/g${i}.jpg`,
                publicId: `gallery/g${i}`
            }));
            mockListMedia.mockReturnValue(makeListOk(fullGallery));

            render(<PhotoSection {...defaultProps} />);

            await waitFor(() => {
                expect(
                    screen.getByText((c) => c.includes('Límite de galería alcanzado'))
                ).toBeInTheDocument();
            });
        });

        it('shows the add (+) button when gallery is below the cap', async () => {
            mockListMedia.mockReturnValue(makeListEmpty());
            render(<PhotoSection {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('+')).toBeInTheDocument();
            });
        });
    });
});
