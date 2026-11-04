import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useVideoSection } from '@/components/host/editor/use-video-section';

const { requestPhotoTextWarningMock, updateMock } = vi.hoisted(() => ({
    requestPhotoTextWarningMock: vi.fn<() => Promise<boolean>>(),
    updateMock: vi.fn()
}));

vi.mock('@/lib/forms/leave-warning-registry', () => ({
    requestPhotoTextWarning: requestPhotoTextWarningMock
}));
vi.mock('@/lib/forms/use-unsaved-changes-guard', () => ({
    useUnsavedChangesGuard: vi.fn()
}));
vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationEditApi: { update: updateMock }
}));
vi.mock('@/store/toast-store', () => ({ addToast: vi.fn() }));
vi.mock('@/lib/i18n', () => ({
    createTranslations: () => ({ t: (_key: string, fallback?: string) => fallback ?? '' })
}));

describe('useVideoSection', () => {
    beforeEach(() => {
        requestPhotoTextWarningMock.mockReset();
        updateMock.mockReset();
        updateMock.mockResolvedValue({ ok: true });
    });

    it('cancels saving when the host chooses to complete missing photo text', async () => {
        requestPhotoTextWarningMock.mockResolvedValue(false);
        const { result } = renderHook(() =>
            useVideoSection({
                locale: 'es',
                accommodationId: 'acc-1',
                initialVideos: [{ url: 'https://youtube.com/watch?v=abc', caption: 'Recorrido' }]
            })
        );

        act(() => result.current.setRowField(0, 'caption', 'Tour completo'));
        await act(async () => {
            await result.current.handleSubmit({ preventDefault: vi.fn() } as never);
        });

        expect(requestPhotoTextWarningMock).toHaveBeenCalledWith('photo-alt');
        expect(updateMock).not.toHaveBeenCalled();
    });

    it('saves after the host chooses to continue with incomplete photo text', async () => {
        requestPhotoTextWarningMock.mockResolvedValue(true);
        const { result } = renderHook(() =>
            useVideoSection({
                locale: 'es',
                accommodationId: 'acc-1',
                initialVideos: [{ url: 'https://youtube.com/watch?v=abc', caption: 'Recorrido' }]
            })
        );

        act(() => result.current.setRowField(0, 'caption', 'Tour completo'));
        await act(async () => {
            await result.current.handleSubmit({ preventDefault: vi.fn() } as never);
        });

        expect(requestPhotoTextWarningMock).toHaveBeenCalledWith('photo-alt');
        expect(updateMock).toHaveBeenCalledTimes(1);
    });
});
