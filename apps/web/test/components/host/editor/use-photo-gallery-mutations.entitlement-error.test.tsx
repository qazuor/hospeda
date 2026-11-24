import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePhotoGalleryMutations } from '@/components/host/editor/use-photo-gallery-mutations';
import type { AccommodationMediaItem } from '@/lib/api/types';
import { createTranslations } from '@/lib/i18n';

// HOS-2429: removal now asks for confirmation. The dialog itself is covered by
// `show-confirmation-dialog.test.tsx`; here the user always confirms.
vi.mock('@/lib/forms/show-confirmation-dialog', () => ({
    showConfirmationDialog: vi.fn().mockResolvedValue(true)
}));

const { removeMediaMock } = vi.hoisted(() => ({ removeMediaMock: vi.fn() }));
vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationMediaApi: { removeMedia: removeMediaMock }
}));

const photo: AccommodationMediaItem = {
    id: 'photo-1',
    url: 'https://example.com/photo.jpg',
    publicId: 'photo-1',
    isFeatured: false,
    caption: undefined,
    description: undefined,
    attribution: undefined,
    alt: 'Texto'
};

function mount() {
    const setError = vi.fn();
    const { result } = renderHook(() =>
        usePhotoGalleryMutations({
            accommodationId: 'accommodation-1',
            t: createTranslations('es').t,
            featuredItem: null,
            galleryItems: [photo],
            isHydrated: true,
            setFeaturedItem: vi.fn(),
            setGalleryItems: vi.fn(),
            setError,
            setOpLoading: vi.fn(),
            reportUploadError: vi.fn(),
            confirmRemoval: vi.fn().mockResolvedValue(true)
        })
    );
    return { result, setError };
}

describe('HOS-2442 raw API errors never reach the photo editor', () => {
    beforeEach(() => {
        removeMediaMock.mockReset();
    });

    it('shows localized copy for ENTITLEMENT_REQUIRED instead of the raw English message', async () => {
        removeMediaMock.mockResolvedValue({
            ok: false,
            error: { code: 'ENTITLEMENT_REQUIRED', message: 'Entitlement required', status: 403 }
        });
        const { result, setError } = mount();
        await act(async () => {
            await result.current.handleGalleryRemove(photo);
        });
        const messages = setError.mock.calls.map((call) => call[0]).filter(Boolean);
        expect(messages).toHaveLength(1);
        expect(messages[0]).not.toContain('Entitlement required');
        expect(messages[0]).toContain('Tu plan no incluye');
    });
});
