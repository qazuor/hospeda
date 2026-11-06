import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useVideoSection } from '@/components/host/editor/use-video-section';

const { requestLeaveWarningMock, updateMock } = vi.hoisted(() => ({
    requestLeaveWarningMock: vi.fn<() => Promise<boolean>>(),
    updateMock: vi.fn()
}));

vi.mock('@/lib/forms/leave-warning-registry', () => ({
    requestLeaveWarning: requestLeaveWarningMock
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
        requestLeaveWarningMock.mockReset();
        updateMock.mockReset();
        updateMock.mockResolvedValue({ ok: true });
    });

    it('saves video edits with incomplete photos without showing the photo-alt dialog', async () => {
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

        expect(requestLeaveWarningMock).not.toHaveBeenCalled();
        expect(updateMock).toHaveBeenCalledTimes(1);
    });
});
