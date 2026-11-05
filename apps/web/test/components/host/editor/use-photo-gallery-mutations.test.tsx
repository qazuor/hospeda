import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePhotoAltWarningGuard } from '@/components/host/editor/use-photo-alt-warning-guard';
import { usePhotoGalleryMutations } from '@/components/host/editor/use-photo-gallery-mutations';
import type { AccommodationMediaItem } from '@/lib/api/types';
import { __resetLeaveWarningRegistry } from '@/lib/forms/leave-warning-registry';

const { updateMediaMock, showConfirmationDialogMock } = vi.hoisted(() => ({
    updateMediaMock: vi.fn(),
    showConfirmationDialogMock: vi.fn()
}));

vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationMediaApi: { updateMedia: updateMediaMock }
}));
vi.mock('@/lib/forms/show-confirmation-dialog', () => ({
    showConfirmationDialog: showConfirmationDialogMock
}));
vi.mock('@/lib/i18n', () => ({
    createTranslations: () => ({
        t: (_key: string, fallback?: string) => fallback ?? '',
        tPlural: (_key: string, count: number) => `${count} fotos sin texto alternativo`
    })
}));

const photo: AccommodationMediaItem = {
    id: 'photo-1',
    url: 'https://example.com/photo.jpg',
    publicId: 'photo-1',
    isFeatured: false,
    alt: 'Texto existente'
};

describe('photo text saves and the HOS-1018 warning registry', () => {
    beforeEach(() => {
        updateMediaMock.mockReset();
        updateMediaMock.mockResolvedValue({ ok: false, error: { message: 'save failed' } });
        showConfirmationDialogMock.mockReset();
        showConfirmationDialogMock.mockResolvedValue(false);
        __resetLeaveWarningRegistry();
    });

    it('asks before saving photo texts when another photo has incomplete alt text', async () => {
        const { result } = renderHook(() => {
            usePhotoAltWarningGuard({
                locale: 'es',
                accommodationId: 'accommodation-1',
                featuredItem: null,
                galleryItems: [{ ...photo, alt: '' }]
            });
            return usePhotoGalleryMutations({
                accommodationId: 'accommodation-1',
                t: (_key, fallback) => fallback ?? '',
                featuredItem: null,
                galleryItems: [{ ...photo, alt: '' }],
                isHydrated: true,
                setFeaturedItem: vi.fn(),
                setGalleryItems: vi.fn(),
                setError: vi.fn(),
                setOpLoading: vi.fn(),
                reportUploadError: vi.fn()
            });
        });

        await act(async () => {
            expect(await result.current.handleUpdateMediaText(photo, { alt: 'Updated' })).toBe(
                false
            );
        });

        expect(showConfirmationDialogMock).toHaveBeenCalledTimes(1);
        expect(showConfirmationDialogMock).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Fotos sin texto alternativo',
                confirmLabel: 'Seguir igual',
                cancelLabel: 'Completar ahora'
            })
        );
        expect(updateMediaMock).not.toHaveBeenCalled();
    });

    it('does not warn about the photo being completed with the submitted alt value', async () => {
        const incompletePhoto = { ...photo, alt: '' };
        const { result } = renderHook(() => {
            usePhotoAltWarningGuard({
                locale: 'es',
                accommodationId: 'accommodation-1',
                featuredItem: null,
                galleryItems: [incompletePhoto]
            });
            return usePhotoGalleryMutations({
                accommodationId: 'accommodation-1',
                t: (_key, fallback) => fallback ?? '',
                featuredItem: null,
                galleryItems: [incompletePhoto],
                isHydrated: true,
                setFeaturedItem: vi.fn(),
                setGalleryItems: vi.fn(),
                setError: vi.fn(),
                setOpLoading: vi.fn(),
                reportUploadError: vi.fn()
            });
        });

        await act(async () => {
            await result.current.handleUpdateMediaText(incompletePhoto, { alt: 'Completed alt' });
        });

        expect(showConfirmationDialogMock).not.toHaveBeenCalled();
        expect(updateMediaMock).toHaveBeenCalledTimes(1);
    });
});
