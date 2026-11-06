/**
 * @file use-photo-section.hydration.test.tsx
 * @description `opsReady` (controls) and `mediaLoadSucceeded` (alt warning) are
 * deliberately separate: a failed `listMedia` must not leave the controls
 * disabled forever, but it must keep the alt-text warning off (HOS-2032).
 */

import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePhotoSection } from '@/components/host/editor/use-photo-section';

const { mockListMedia } = vi.hoisted(() => ({ mockListMedia: vi.fn() }));

vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationMediaApi: {
        listMedia: mockListMedia,
        addMedia: vi.fn(),
        addFeaturedMedia: vi.fn(),
        removeMedia: vi.fn(),
        setFeaturedMedia: vi.fn(),
        reorderMedia: vi.fn(),
        updateMedia: vi.fn()
    }
}));
vi.mock('@/lib/logger', () => ({
    webLogger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));
vi.mock('@/lib/media/upload-entity', () => ({ uploadEntityImage: vi.fn() }));
vi.mock('@/store/toast-store', () => ({ addToast: vi.fn() }));

const params = { locale: 'es' as const, accommodationId: 'acc-1', galleryCap: 10 };

describe('usePhotoSection hydration flags', () => {
    beforeEach(() => {
        mockListMedia.mockReset();
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
