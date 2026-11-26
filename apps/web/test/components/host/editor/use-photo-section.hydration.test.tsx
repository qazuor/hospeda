/**
 * @file use-photo-section.hydration.test.tsx
 * @description `opsReady` (controls) and `mediaLoadSucceeded` (alt warning) are
 * deliberately separate: a failed `listMedia` must not leave the controls
 * disabled forever, but it must keep the alt-text warning off (HOS-2032).
 */

import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePhotoSection } from '@/components/host/editor/use-photo-section';
import { createListingPhotoApi } from '@/lib/api/listing-photo-api';
import { allowanceFailed, allowanceOk } from './photo-allowance-fixture';

const { mockListMedia, mockGetAllowance } = vi.hoisted(() => ({
    mockListMedia: vi.fn(),
    mockGetAllowance: vi.fn()
}));

vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationMediaApi: {
        listMedia: mockListMedia,
        addMedia: vi.fn(),
        addFeaturedMedia: vi.fn(),
        removeMedia: vi.fn(),
        setFeaturedMedia: vi.fn(),
        reorderMedia: vi.fn(),
        updateMedia: vi.fn()
    },
    listingPhotoAllowanceApi: { getAllowance: mockGetAllowance }
}));
vi.mock('@/lib/logger', () => ({
    webLogger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));
vi.mock('@/lib/media/upload-entity', () => ({ uploadEntityImage: vi.fn() }));
vi.mock('@/store/toast-store', () => ({ addToast: vi.fn() }));

const params = {
    locale: 'es' as const,
    api: createListingPhotoApi({ vertical: 'accommodation' }),
    listingId: 'acc-1',
    confirmRemoval: () => Promise.resolve(true)
};

describe('usePhotoSection hydration flags', () => {
    beforeEach(() => {
        mockListMedia.mockReset();
        mockGetAllowance.mockReset();
        mockGetAllowance.mockImplementation(() => allowanceOk({ cap: 10 }));
    });

    it('enables controls but not the alt warning when listMedia answers an error', async () => {
        mockListMedia.mockResolvedValue({ ok: false, error: { message: 'boom' } });
        const { result } = renderHook(() => usePhotoSection(params));

        await waitFor(() => expect(result.current.opsReady).toBe(true));
        expect(result.current.mediaLoadSucceeded).toBe(false);
    });

    it('enables controls but not the alt warning when listMedia throws', async () => {
        mockListMedia.mockRejectedValue(new Error('network'));
        const { result } = renderHook(() => usePhotoSection(params));

        await waitFor(() => expect(result.current.opsReady).toBe(true));
        expect(result.current.mediaLoadSucceeded).toBe(false);
    });

    it('turns both on once media loaded', async () => {
        mockListMedia.mockResolvedValue({ ok: true, data: { media: [] } });
        const { result } = renderHook(() => usePhotoSection(params));

        await waitFor(() => expect(result.current.opsReady).toBe(true));
        expect(result.current.mediaLoadSucceeded).toBe(true);
    });
});

describe('usePhotoSection allowance (HOS-2495)', () => {
    beforeEach(() => {
        mockListMedia.mockReset();
        mockListMedia.mockResolvedValue({ ok: true, data: { media: [] } });
        mockGetAllowance.mockReset();
    });

    it('resolves a LIMITED allowance into the limited cap view and opens uploads', async () => {
        mockGetAllowance.mockImplementation(() => allowanceOk({ cap: 10 }));
        const { result } = renderHook(() => usePhotoSection(params));

        await waitFor(() => expect(result.current.capView).toEqual({ kind: 'limited', cap: 10 }));
        expect(result.current.isGalleryUploadOpen).toBe(true);
        expect(result.current.isCoverUploadOpen).toBe(true);
        expect(mockGetAllowance).toHaveBeenCalledWith({ vertical: 'accommodation', id: 'acc-1' });
    });

    it('keeps uploads closed while the allowance is in flight', () => {
        mockGetAllowance.mockImplementation(() => new Promise(() => {}));
        const { result } = renderHook(() => usePhotoSection(params));

        expect(result.current.capView).toEqual({ kind: 'loading', cap: null });
        expect(result.current.isGalleryUploadOpen).toBe(false);
        expect(result.current.isCoverUploadOpen).toBe(false);
    });

    it('moves to the failed view on a failed read and keeps uploads closed', async () => {
        mockGetAllowance.mockImplementation(() => allowanceFailed());
        const { result } = renderHook(() => usePhotoSection(params));

        await waitFor(() => expect(result.current.capView).toEqual({ kind: 'failed', cap: null }));
        expect(result.current.isGalleryUploadOpen).toBe(false);
        expect(result.current.isCoverUploadOpen).toBe(false);
    });

    it('closes only the cover upload when a LIMITED allowance says no cover is allowed (AC-19)', async () => {
        mockGetAllowance.mockImplementation(() => allowanceOk({ cap: 15, coverAllowed: false }));
        const { result } = renderHook(() => usePhotoSection(params));

        await waitFor(() => expect(result.current.capView).toEqual({ kind: 'limited', cap: 15 }));
        expect(result.current.isGalleryUploadOpen).toBe(true);
        expect(result.current.isCoverUploadOpen).toBe(false);
    });

    it('closes the cover upload when the allowance says no cover is allowed (AC-19)', async () => {
        mockGetAllowance.mockImplementation(() => allowanceOk({ cap: 'none' }));
        const { result } = renderHook(() => usePhotoSection(params));

        await waitFor(() => expect(result.current.capView).toEqual({ kind: 'none', cap: 0 }));
        expect(result.current.isCoverUploadOpen).toBe(false);
        expect(result.current.isGalleryUploadOpen).toBe(false);
    });
});
