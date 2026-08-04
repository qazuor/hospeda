// @vitest-environment jsdom
/**
 * Component tests for GalleryManager (SPEC-204).
 *
 * Tests:
 *  1. Splits list into featured (portada) slot and gallery grid
 *  2. Shows empty portada state when no featured row
 *  3. Shows portada image when a featured row exists
 *  4. Adding a gallery photo: upload → addMedia
 *  5. Removing a gallery photo calls removeMedia
 *  6. Removing portada calls removeMedia with the featured row's id
 *  7. Setting portada: upload → addMedia → setFeatured sequence
 *  8. Load error displays inline error alert
 *
 * Mocking strategy: the four useAccommodationMedia* hooks and useMediaUpload
 * are mocked at the module level so we can control their return values
 * (mutations and query state) without any network calls.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (declared before any import of the component under test)
// ---------------------------------------------------------------------------

const mockListData: {
    data: Array<Record<string, unknown>>;
    isLoading: boolean;
    isError: boolean;
} = {
    data: [],
    isLoading: false,
    isError: false
};

const mockAddMutateAsync = vi.fn();
const mockRemoveMutateAsync = vi.fn();
const mockSetFeaturedMutateAsync = vi.fn();
const mockUploadEntityImageMutateAsync = vi.fn();

vi.mock('@/features/accommodations/hooks/useAccommodationMedia', () => ({
    useAccommodationMediaList: () => mockListData,
    useAccommodationMediaAdd: () => ({
        mutateAsync: mockAddMutateAsync,
        isPending: false,
        isError: false
    }),
    useAccommodationMediaRemove: () => ({
        mutateAsync: mockRemoveMutateAsync,
        isPending: false,
        isError: false,
        variables: undefined
    }),
    useAccommodationMediaSetFeatured: () => ({
        mutateAsync: mockSetFeaturedMutateAsync,
        isPending: false,
        isError: false
    })
}));

vi.mock('@/hooks/use-media-upload', () => ({
    useMediaUpload: () => ({
        uploadEntityImage: {
            mutateAsync: mockUploadEntityImageMutateAsync,
            isPending: false,
            isError: false
        }
    })
}));

// @repo/schemas mock — provide ENTITY_GALLERY_CAPS + ModerationStatusEnum
vi.mock('@repo/schemas', () => ({
    ENTITY_GALLERY_CAPS: { accommodation: 50 },
    ModerationStatusEnum: { APPROVED: 'APPROVED', PENDING: 'PENDING', REJECTED: 'REJECTED' }
}));

// ---------------------------------------------------------------------------
// Import component AFTER mocks
// ---------------------------------------------------------------------------

import { GalleryManager } from '../GalleryManager';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeFeaturedRow(id = 'featured-1') {
    return {
        id,
        accommodationId: 'acc-1',
        url: `https://example.com/${id}.jpg`,
        isFeatured: true,
        state: 'visible',
        sortOrder: 0,
        moderationState: 'APPROVED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

function makeGalleryRow(id: string, sortOrder = 1) {
    return {
        id,
        accommodationId: 'acc-1',
        url: `https://example.com/${id}.jpg`,
        isFeatured: false,
        state: 'visible',
        sortOrder,
        moderationState: 'APPROVED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function renderGalleryManager() {
    return render(<GalleryManager accommodationId="acc-1" />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
    mockListData.data = [];
    mockListData.isLoading = false;
    mockListData.isError = false;
    mockAddMutateAsync.mockReset();
    mockRemoveMutateAsync.mockReset();
    mockSetFeaturedMutateAsync.mockReset();
    mockUploadEntityImageMutateAsync.mockReset();
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('GalleryManager — split: featured vs gallery', () => {
    it('renders the portada empty state when no featured row', () => {
        mockListData.data = [makeGalleryRow('g1'), makeGalleryRow('g2', 2)];

        renderGalleryManager();

        // Empty portada state
        expect(screen.getByText('admin-pages.gallery.portada.empty')).toBeDefined();
        // Gallery grid shows items (images with alt="" are role="presentation")
        const imgs = document.querySelectorAll('img');
        expect(imgs).toHaveLength(2);
    });

    it('shows the portada image when a featured row exists', () => {
        const featured = makeFeaturedRow('feat-1');
        const gallery = makeGalleryRow('g1');
        mockListData.data = [featured, gallery];

        renderGalleryManager();

        // Portada image is rendered inside the portada section
        const portadaSection = screen.getByRole('region', {
            name: 'admin-pages.gallery.portada.title'
        });
        const portadaImg = portadaSection.querySelector('img');
        expect(portadaImg).not.toBeNull();
        expect((portadaImg as HTMLImageElement).src).toContain('feat-1');

        // Empty state text must NOT be shown
        expect(screen.queryByText('admin-pages.gallery.portada.empty')).toBeNull();

        // Total images = portada + 1 gallery item
        const allImgs = document.querySelectorAll('img');
        expect(allImgs).toHaveLength(2);
    });
});

describe('GalleryManager — add gallery photo', () => {
    it('calls upload then addMedia when a file is selected for the gallery', async () => {
        const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
        mockUploadEntityImageMutateAsync.mockResolvedValue({
            url: 'https://cdn.example.com/new.jpg',
            publicId: 'hospeda/dev/new'
        });
        mockAddMutateAsync.mockResolvedValue({
            id: 'new-row',
            url: 'https://cdn.example.com/new.jpg',
            isFeatured: false
        });

        mockListData.data = [];
        renderGalleryManager();

        // Find the hidden gallery file input
        const inputs = document.querySelectorAll('input[type="file"]');
        // There are two: one for portada, one for gallery
        // The second one is the gallery input
        const galleryInput = inputs[1] as HTMLInputElement;

        fireEvent.change(galleryInput, { target: { files: [file] } });

        await waitFor(() => {
            expect(mockUploadEntityImageMutateAsync).toHaveBeenCalledWith(
                expect.objectContaining({
                    entityType: 'accommodation',
                    entityId: 'acc-1',
                    role: 'gallery'
                })
            );
            expect(mockAddMutateAsync).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: 'https://cdn.example.com/new.jpg',
                    publicId: 'hospeda/dev/new',
                    moderationState: 'APPROVED'
                })
            );
        });
        // setFeatured should NOT have been called for a regular gallery upload
        expect(mockSetFeaturedMutateAsync).not.toHaveBeenCalled();
    });
});

describe('GalleryManager — remove gallery photo', () => {
    it('calls removeMedia with the correct mediaId', async () => {
        const row = makeGalleryRow('g-del');
        mockListData.data = [row];
        mockRemoveMutateAsync.mockResolvedValue('g-del');

        renderGalleryManager();

        // Gallery section contains the remove button for each item.
        // The button is aria-label'd, so query by aria-label attribute directly
        // since it has opacity-0 (hover-only visibility) but is in the DOM.
        const gallerySection = screen.getByRole('region', {
            name: 'admin-pages.gallery.grid.title'
        });
        const removeBtn = gallerySection.querySelector(
            'button[aria-label="admin-pages.gallery.grid.actions.remove"]'
        );
        expect(removeBtn).not.toBeNull();

        fireEvent.click(removeBtn as Element);

        await waitFor(() => {
            expect(mockRemoveMutateAsync).toHaveBeenCalledWith({ mediaId: 'g-del' });
        });
    });
});

describe('GalleryManager — remove portada', () => {
    it('calls removeMedia with the featured row id', async () => {
        const featured = makeFeaturedRow('feat-del');
        mockListData.data = [featured];
        mockRemoveMutateAsync.mockResolvedValue('feat-del');

        renderGalleryManager();

        const portadaSection = screen.getByRole('region', {
            name: 'admin-pages.gallery.portada.title'
        });
        const removeBtn = portadaSection.querySelector(
            'button[aria-label="admin-pages.gallery.portada.actions.remove"]'
        );
        expect(removeBtn).not.toBeNull();

        fireEvent.click(removeBtn as Element);

        await waitFor(() => {
            expect(mockRemoveMutateAsync).toHaveBeenCalledWith({ mediaId: 'feat-del' });
        });
        expect(mockSetFeaturedMutateAsync).not.toHaveBeenCalled();
    });
});

describe('GalleryManager — grid remove button uses its own accessible name', () => {
    it('gives the grid remove button a DIFFERENT accessible name than the portada remove button', () => {
        const featured = makeFeaturedRow('feat-1');
        const gallery = makeGalleryRow('g1');
        mockListData.data = [featured, gallery];

        renderGalleryManager();

        // Regression guard: both buttons used to share the same i18n key,
        // so a screen reader announced "Quitar portada" on every gallery
        // photo — not just the actual cover. They must now resolve to
        // distinct, non-empty accessible names.
        const portadaRemoveBtn = screen.getByRole('button', {
            name: 'admin-pages.gallery.portada.actions.remove'
        });
        const gridRemoveBtn = screen.getByRole('button', {
            name: 'admin-pages.gallery.grid.actions.remove'
        });

        expect(portadaRemoveBtn.getAttribute('aria-label')).toBe(
            'admin-pages.gallery.portada.actions.remove'
        );
        expect(gridRemoveBtn.getAttribute('aria-label')).toBe(
            'admin-pages.gallery.grid.actions.remove'
        );
        expect(gridRemoveBtn.getAttribute('aria-label')).not.toBe(
            portadaRemoveBtn.getAttribute('aria-label')
        );
    });
});

describe('GalleryManager — alt derived from entity name', () => {
    it('sends a non-empty alt on addMedia when entityName is provided', async () => {
        const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
        mockUploadEntityImageMutateAsync.mockResolvedValue({
            url: 'https://cdn.example.com/new.jpg',
            publicId: 'hospeda/dev/new'
        });
        mockAddMutateAsync.mockResolvedValue({
            id: 'new-row',
            url: 'https://cdn.example.com/new.jpg',
            isFeatured: false
        });

        mockListData.data = [];
        render(
            <GalleryManager
                accommodationId="acc-1"
                entityName="Hotel Costanera"
            />
        );

        const inputs = document.querySelectorAll('input[type="file"]');
        const galleryInput = inputs[1] as HTMLInputElement;

        fireEvent.change(galleryInput, { target: { files: [file] } });

        await waitFor(() => {
            expect(mockAddMutateAsync).toHaveBeenCalledWith(
                expect.objectContaining({ alt: 'Hotel Costanera' })
            );
        });
    });

    it('does NOT send an alt key on addMedia when entityName is absent', async () => {
        const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
        mockUploadEntityImageMutateAsync.mockResolvedValue({
            url: 'https://cdn.example.com/new.jpg',
            publicId: 'hospeda/dev/new'
        });
        mockAddMutateAsync.mockResolvedValue({
            id: 'new-row',
            url: 'https://cdn.example.com/new.jpg',
            isFeatured: false
        });

        mockListData.data = [];
        renderGalleryManager();

        const inputs = document.querySelectorAll('input[type="file"]');
        const galleryInput = inputs[1] as HTMLInputElement;

        fireEvent.change(galleryInput, { target: { files: [file] } });

        await waitFor(() => {
            expect(mockAddMutateAsync).toHaveBeenCalled();
        });
        const call = mockAddMutateAsync.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(Object.hasOwn(call, 'alt')).toBe(false);
    });
});

describe('GalleryManager — set portada (upload → add → setFeatured)', () => {
    it('calls upload → addMedia → setFeatured in sequence for portada upload', async () => {
        const file = new File(['data'], 'portada.jpg', { type: 'image/jpeg' });
        mockUploadEntityImageMutateAsync.mockResolvedValue({
            url: 'https://cdn.example.com/portada.jpg',
            publicId: 'hospeda/dev/portada'
        });
        mockAddMutateAsync.mockResolvedValue({
            id: 'portada-row',
            url: 'https://cdn.example.com/portada.jpg',
            isFeatured: false
        });
        mockSetFeaturedMutateAsync.mockResolvedValue({
            id: 'portada-row',
            isFeatured: true
        });

        mockListData.data = [];
        renderGalleryManager();

        const inputs = document.querySelectorAll('input[type="file"]');
        const portadaInput = inputs[0] as HTMLInputElement;

        fireEvent.change(portadaInput, { target: { files: [file] } });

        await waitFor(() => {
            expect(mockUploadEntityImageMutateAsync).toHaveBeenCalledWith(
                expect.objectContaining({ role: 'gallery' })
            );
            expect(mockAddMutateAsync).toHaveBeenCalledWith(
                expect.objectContaining({ url: 'https://cdn.example.com/portada.jpg' })
            );
            expect(mockSetFeaturedMutateAsync).toHaveBeenCalledWith({ mediaId: 'portada-row' });
        });
    });

    // Regression guard: `handlePortadaFile` has its OWN `...(derivedAlt ? {
    // alt: derivedAlt } : {})` spread, separate from the gallery-grid
    // handler's. The grid-path tests above ("alt derived from entity name")
    // exercise a completely different code path and would stay green even
    // if this spread were removed from the portada handler alone.
    it('sends a non-empty alt on the portada addMedia call when entityName is provided', async () => {
        const file = new File(['data'], 'portada.jpg', { type: 'image/jpeg' });
        mockUploadEntityImageMutateAsync.mockResolvedValue({
            url: 'https://cdn.example.com/portada.jpg',
            publicId: 'hospeda/dev/portada'
        });
        mockAddMutateAsync.mockResolvedValue({
            id: 'portada-row',
            url: 'https://cdn.example.com/portada.jpg',
            isFeatured: false
        });
        mockSetFeaturedMutateAsync.mockResolvedValue({
            id: 'portada-row',
            isFeatured: true
        });

        mockListData.data = [];
        render(
            <GalleryManager
                accommodationId="acc-1"
                entityName="Hotel Costanera"
            />
        );

        const inputs = document.querySelectorAll('input[type="file"]');
        const portadaInput = inputs[0] as HTMLInputElement;

        fireEvent.change(portadaInput, { target: { files: [file] } });

        await waitFor(() => {
            expect(mockAddMutateAsync).toHaveBeenCalledWith(
                expect.objectContaining({ alt: 'Hotel Costanera' })
            );
        });
    });

    it('does NOT send an alt key on the portada addMedia call when entityName is absent', async () => {
        const file = new File(['data'], 'portada.jpg', { type: 'image/jpeg' });
        mockUploadEntityImageMutateAsync.mockResolvedValue({
            url: 'https://cdn.example.com/portada.jpg',
            publicId: 'hospeda/dev/portada'
        });
        mockAddMutateAsync.mockResolvedValue({
            id: 'portada-row',
            url: 'https://cdn.example.com/portada.jpg',
            isFeatured: false
        });
        mockSetFeaturedMutateAsync.mockResolvedValue({
            id: 'portada-row',
            isFeatured: true
        });

        mockListData.data = [];
        renderGalleryManager();

        const inputs = document.querySelectorAll('input[type="file"]');
        const portadaInput = inputs[0] as HTMLInputElement;

        fireEvent.change(portadaInput, { target: { files: [file] } });

        await waitFor(() => {
            expect(mockAddMutateAsync).toHaveBeenCalled();
        });
        const call = mockAddMutateAsync.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(Object.hasOwn(call, 'alt')).toBe(false);
    });
});

describe('GalleryManager — gated on entity-detail loading too (race regression guard)', () => {
    it('keeps the loading skeleton (no upload controls) while isEntityLoading is true, even though the media query already settled', () => {
        // Reproduces the race: media list resolves fast (few rows), while the
        // parallel entity-detail query (source of `entityName`) is still in
        // flight. If the gallery UI gated on the media query alone, the
        // upload controls would render here with `entityName` undefined —
        // and since there is no update-media endpoint, an upload started in
        // this window would be stuck with `alt=null` forever.
        mockListData.isLoading = false;
        mockListData.data = [];

        render(
            <GalleryManager
                accommodationId="acc-1"
                isEntityLoading={true}
            />
        );

        // No file inputs (portada or gallery) must be present while gated.
        expect(document.querySelectorAll('input[type="file"]')).toHaveLength(0);
        // The gallery "add" button and portada section must not be rendered.
        expect(
            screen.queryByRole('button', { name: 'admin-pages.gallery.grid.actions.add' })
        ).toBeNull();
        expect(
            screen.queryByRole('region', { name: 'admin-pages.gallery.portada.title' })
        ).toBeNull();
    });

    it('renders the upload controls once BOTH the media query and isEntityLoading have settled', () => {
        mockListData.isLoading = false;
        mockListData.data = [];

        render(
            <GalleryManager
                accommodationId="acc-1"
                entityName="Hotel Costanera"
                isEntityLoading={false}
            />
        );

        expect(document.querySelectorAll('input[type="file"]').length).toBeGreaterThan(0);
        expect(
            screen.getByRole('region', { name: 'admin-pages.gallery.portada.title' })
        ).toBeDefined();
    });
});

describe('GalleryManager — load error', () => {
    it('shows a load error alert when isError is true', () => {
        mockListData.isError = true;
        mockListData.data = [];

        renderGalleryManager();

        const alert = screen.getByRole('alert');
        expect(alert).toBeDefined();
        expect(alert.textContent).toContain('admin-pages.gallery.errors.loadFailed');
    });
});
