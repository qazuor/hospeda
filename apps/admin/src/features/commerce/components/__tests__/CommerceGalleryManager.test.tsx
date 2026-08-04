// @vitest-environment jsdom
/**
 * Component tests for CommerceGalleryManager (HOS-382).
 *
 * Mirrors the accommodation GalleryManager component tests. Tests:
 *  1. Splits list into featured (portada) slot and gallery grid
 *  2. Shows empty portada state when no featured row
 *  3. Shows portada image when a featured row exists
 *  4. Adding a gallery photo: upload → addMedia
 *  5. Removing a gallery photo calls removeMedia
 *  6. Removing portada calls removeMedia with the featured row's id
 *  7. Setting portada: upload → addMedia → setFeatured sequence
 *  8. Load error displays inline error alert
 *  9. entityType passed to uploadEntityImage matches the `vertical` prop
 *     (HOS-382-specific: this is the vertical-agnostic wiring the
 *     accommodation precedent doesn't need to cover)
 *
 * Mocking strategy: the four useCommerceMedia* hooks and useMediaUpload are
 * mocked at the module level so we can control their return values
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

vi.mock('@/features/commerce/hooks/useCommerceMedia', () => ({
    useCommerceMediaList: () => mockListData,
    useCommerceMediaAdd: () => ({
        mutateAsync: mockAddMutateAsync,
        isPending: false,
        isError: false
    }),
    useCommerceMediaRemove: () => ({
        mutateAsync: mockRemoveMutateAsync,
        isPending: false,
        isError: false,
        variables: undefined
    }),
    useCommerceMediaSetFeatured: () => ({
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
    ENTITY_GALLERY_CAPS: { gastronomy: 30, experience: 30 },
    ModerationStatusEnum: { APPROVED: 'APPROVED', PENDING: 'PENDING', REJECTED: 'REJECTED' }
}));

// ---------------------------------------------------------------------------
// Import component AFTER mocks
// ---------------------------------------------------------------------------

import { CommerceGalleryManager } from '../CommerceGalleryManager';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeFeaturedRow(id = 'featured-1') {
    return {
        id,
        gastronomyId: 'ent-1',
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
        gastronomyId: 'ent-1',
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
    return render(
        <CommerceGalleryManager
            vertical="gastronomy"
            entityId="ent-1"
        />
    );
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

describe('CommerceGalleryManager — split: featured vs gallery', () => {
    it('renders the portada empty state when no featured row', () => {
        mockListData.data = [makeGalleryRow('g1'), makeGalleryRow('g2', 2)];

        renderGalleryManager();

        expect(screen.getByText('admin-pages.gallery.portada.empty')).toBeDefined();
        const imgs = document.querySelectorAll('img');
        expect(imgs).toHaveLength(2);
    });

    it('shows the portada image when a featured row exists', () => {
        const featured = makeFeaturedRow('feat-1');
        const gallery = makeGalleryRow('g1');
        mockListData.data = [featured, gallery];

        renderGalleryManager();

        const portadaSection = screen.getByRole('region', {
            name: 'admin-pages.gallery.portada.title'
        });
        const portadaImg = portadaSection.querySelector('img');
        expect(portadaImg).not.toBeNull();
        expect((portadaImg as HTMLImageElement).src).toContain('feat-1');

        expect(screen.queryByText('admin-pages.gallery.portada.empty')).toBeNull();

        const allImgs = document.querySelectorAll('img');
        expect(allImgs).toHaveLength(2);
    });
});

describe('CommerceGalleryManager — add gallery photo', () => {
    it('calls upload then addMedia when a file is selected for the gallery, with entityType matching the vertical prop', async () => {
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
            expect(mockUploadEntityImageMutateAsync).toHaveBeenCalledWith(
                expect.objectContaining({
                    entityType: 'gastronomy',
                    entityId: 'ent-1',
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
        expect(mockSetFeaturedMutateAsync).not.toHaveBeenCalled();
    });
});

describe('CommerceGalleryManager — remove gallery photo', () => {
    it('calls removeMedia with the correct mediaId', async () => {
        const row = makeGalleryRow('g-del');
        mockListData.data = [row];
        mockRemoveMutateAsync.mockResolvedValue('g-del');

        renderGalleryManager();

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

describe('CommerceGalleryManager — remove portada', () => {
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

describe('CommerceGalleryManager — grid remove button uses its own accessible name', () => {
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

describe('CommerceGalleryManager — alt derived from entity name', () => {
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
            <CommerceGalleryManager
                vertical="gastronomy"
                entityId="ent-1"
                entityName="Parrilla El Fogón"
            />
        );

        const inputs = document.querySelectorAll('input[type="file"]');
        const galleryInput = inputs[1] as HTMLInputElement;

        fireEvent.change(galleryInput, { target: { files: [file] } });

        await waitFor(() => {
            expect(mockAddMutateAsync).toHaveBeenCalledWith(
                expect.objectContaining({ alt: 'Parrilla El Fogón' })
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

describe('CommerceGalleryManager — set portada (upload → add → setFeatured)', () => {
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
            <CommerceGalleryManager
                vertical="gastronomy"
                entityId="ent-1"
                entityName="Parrilla El Fogón"
            />
        );

        const inputs = document.querySelectorAll('input[type="file"]');
        const portadaInput = inputs[0] as HTMLInputElement;

        fireEvent.change(portadaInput, { target: { files: [file] } });

        await waitFor(() => {
            expect(mockAddMutateAsync).toHaveBeenCalledWith(
                expect.objectContaining({ alt: 'Parrilla El Fogón' })
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

describe('CommerceGalleryManager — gated on entity-detail loading too (race regression guard)', () => {
    it('keeps the loading skeleton (no upload controls) while isEntityLoading is true, even though the media query already settled', () => {
        // Reproduces the race: the media list resolves fast (few rows), while
        // the parallel entity-detail query (source of `entityName`, e.g.
        // useGastronomyQuery/useExperienceQuery) is still in flight. If the
        // gallery UI gated on the media query alone, the upload controls
        // would render here with `entityName` undefined — and since there is
        // no update-media endpoint, an upload started in this window would
        // be stuck with `alt=null` forever.
        mockListData.isLoading = false;
        mockListData.data = [];

        render(
            <CommerceGalleryManager
                vertical="gastronomy"
                entityId="ent-1"
                isEntityLoading={true}
            />
        );

        expect(document.querySelectorAll('input[type="file"]')).toHaveLength(0);
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
            <CommerceGalleryManager
                vertical="gastronomy"
                entityId="ent-1"
                entityName="Parrilla El Fogón"
                isEntityLoading={false}
            />
        );

        expect(document.querySelectorAll('input[type="file"]').length).toBeGreaterThan(0);
        expect(
            screen.getByRole('region', { name: 'admin-pages.gallery.portada.title' })
        ).toBeDefined();
    });
});

describe('CommerceGalleryManager — load error', () => {
    it('shows a load error alert when isError is true', () => {
        mockListData.isError = true;
        mockListData.data = [];

        renderGalleryManager();

        const alert = screen.getByRole('alert');
        expect(alert).toBeDefined();
        expect(alert.textContent).toContain('admin-pages.gallery.errors.loadFailed');
    });
});

describe('CommerceGalleryManager — vertical prop wiring', () => {
    it('passes entityType="experience" to the upload mutation when vertical="experience"', async () => {
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
            <CommerceGalleryManager
                vertical="experience"
                entityId="ent-2"
            />
        );

        const inputs = document.querySelectorAll('input[type="file"]');
        const galleryInput = inputs[1] as HTMLInputElement;

        fireEvent.change(galleryInput, { target: { files: [file] } });

        await waitFor(() => {
            expect(mockUploadEntityImageMutateAsync).toHaveBeenCalledWith(
                expect.objectContaining({
                    entityType: 'experience',
                    entityId: 'ent-2',
                    role: 'gallery'
                })
            );
        });
    });
});
