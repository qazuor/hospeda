import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useVideoSection } from '@/components/listing/editor/use-video-section';

const { requestLeaveWarningMock, saveMock, toastMock } = vi.hoisted(() => ({
    requestLeaveWarningMock: vi.fn<() => Promise<boolean>>(),
    saveMock: vi.fn(),
    toastMock: vi.fn()
}));

vi.mock('@/lib/forms/leave-warning-registry', () => ({
    requestLeaveWarning: requestLeaveWarningMock
}));
vi.mock('@/lib/forms/use-unsaved-changes-guard', () => ({
    useUnsavedChangesGuard: vi.fn()
}));
vi.mock('@/store/toast-store', () => ({ addToast: toastMock }));
vi.mock('@/lib/i18n', () => ({
    createTranslations: () => ({ t: (_key: string, fallback?: string) => fallback ?? '' })
}));

const submit = () => ({ preventDefault: vi.fn() }) as never;

describe('useVideoSection', () => {
    beforeEach(() => {
        requestLeaveWarningMock.mockReset();
        saveMock.mockReset();
        toastMock.mockReset();
        saveMock.mockResolvedValue({ ok: true });
    });

    it('saves video edits with incomplete photos without showing the photo-alt dialog', async () => {
        const { result } = renderHook(() =>
            useVideoSection({
                locale: 'es',
                copyScope: 'accommodation',
                save: saveMock,
                initialVideos: [{ url: 'https://youtube.com/watch?v=abc', caption: 'Recorrido' }]
            })
        );

        act(() => result.current.setRowField(0, 'caption', 'Tour completo'));
        await act(async () => {
            await result.current.handleSubmit(submit());
        });

        expect(requestLeaveWarningMock).not.toHaveBeenCalled();
        expect(saveMock).toHaveBeenCalledWith([
            { url: 'https://youtube.com/watch?v=abc', caption: 'Tour completo' }
        ]);
    });

    it('omits an empty caption from the payload', async () => {
        const { result } = renderHook(() =>
            useVideoSection({
                locale: 'es',
                copyScope: 'listing',
                save: saveMock,
                initialVideos: []
            })
        );

        act(() => result.current.addRow());
        act(() => result.current.setRowField(0, 'url', 'https://youtu.be/abc123'));
        await act(async () => {
            await result.current.handleSubmit(submit());
        });

        expect(saveMock).toHaveBeenCalledWith([{ url: 'https://youtu.be/abc123' }]);
    });

    it('rejects an invalid url without calling save', async () => {
        const { result } = renderHook(() =>
            useVideoSection({
                locale: 'es',
                copyScope: 'listing',
                save: saveMock,
                initialVideos: []
            })
        );

        act(() => result.current.addRow());
        act(() => result.current.setRowField(0, 'url', 'not-a-url'));
        await act(async () => {
            await result.current.handleSubmit(submit());
        });

        expect(saveMock).not.toHaveBeenCalled();
        expect(result.current.formError).toBe('Ingresá una URL de video válida');
    });

    it('refuses more rows than the cap before calling save', async () => {
        const { result } = renderHook(() =>
            useVideoSection({
                locale: 'es',
                copyScope: 'listing',
                save: saveMock,
                maxVideos: 1,
                initialVideos: []
            })
        );

        act(() => result.current.addRow());
        act(() => result.current.addRow());
        act(() => result.current.setRowField(0, 'url', 'https://youtu.be/a'));
        act(() => result.current.setRowField(1, 'url', 'https://youtu.be/b'));
        await act(async () => {
            await result.current.handleSubmit(submit());
        });

        expect(saveMock).not.toHaveBeenCalled();
        expect(result.current.formError).toBe('Podés cargar hasta 6 videos.');
    });

    it('shows the plan message on a 403 and keeps the rows dirty (nothing was stored)', async () => {
        saveMock.mockResolvedValue({ ok: false, status: 403 });
        const { result } = renderHook(() =>
            useVideoSection({
                locale: 'es',
                copyScope: 'listing',
                save: saveMock,
                initialVideos: []
            })
        );

        act(() => result.current.addRow());
        act(() => result.current.setRowField(0, 'url', 'https://youtu.be/abc123'));
        await act(async () => {
            await result.current.handleSubmit(submit());
        });

        expect(result.current.formError).toBe('Tu plan no incluye videos. No se guardó nada.');
        expect(result.current.isDirty).toBe(true);
        expect(toastMock).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
    });
});
