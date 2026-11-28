/**
 * @file EmailPreviewFrame.test.tsx
 * HOS-2685: the preview is the server-rendered HTML in a sandboxed iframe,
 * requested with a debounce and only when the body has content.
 */
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    EmailPreviewFrame,
    PREVIEW_DEBOUNCE_MS
} from '@/routes/_authed/direct-emails/-components/EmailPreviewFrame';

const preview = vi.hoisted(() => ({ mutateAsync: vi.fn() }));

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key, locale: 'es' })
}));
vi.mock('@/hooks/direct-email', () => ({
    usePreviewDirectEmail: () => ({ mutateAsync: preview.mutateAsync })
}));

const BODY = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hola' }] }]
} as const;

beforeEach(() => {
    vi.useFakeTimers();
    preview.mutateAsync.mockReset();
    preview.mutateAsync.mockResolvedValue({
        subject: 'S',
        html: '<html><body>RENDERED</body></html>'
    });
});
afterEach(() => vi.useRealTimers());

describe('EmailPreviewFrame', () => {
    it('does not call the API for an empty body', () => {
        render(
            <EmailPreviewFrame
                subject="S"
                bodyJson={null}
            />
        );

        act(() => vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS * 2));

        expect(preview.mutateAsync).not.toHaveBeenCalled();
        expect(screen.getByText('admin-direct-email.compose.previewEmpty')).toBeInTheDocument();
    });

    it('debounces and renders the returned HTML in a script-less sandboxed iframe', async () => {
        const { rerender } = render(
            <EmailPreviewFrame
                subject="S"
                bodyJson={BODY}
            />
        );
        rerender(
            <EmailPreviewFrame
                subject="S2"
                bodyJson={BODY}
            />
        );

        await act(async () => {
            await vi.advanceTimersByTimeAsync(PREVIEW_DEBOUNCE_MS + 10);
        });

        expect(preview.mutateAsync).toHaveBeenCalledTimes(1);
        expect(preview.mutateAsync).toHaveBeenCalledWith({ subject: 'S2', bodyJson: BODY });
        const frame = screen.getByTitle('admin-direct-email.compose.previewFrameTitle');
        expect(frame.getAttribute('srcdoc')).toContain('RENDERED');
        expect(frame.getAttribute('sandbox')).toBe('');
    });

    it('shows an error when the preview request fails', async () => {
        preview.mutateAsync.mockRejectedValue(new Error('boom'));
        render(
            <EmailPreviewFrame
                subject="S"
                bodyJson={BODY}
            />
        );

        await act(async () => {
            await vi.advanceTimersByTimeAsync(PREVIEW_DEBOUNCE_MS + 10);
        });

        expect(screen.getByRole('alert').textContent).toBe(
            'admin-direct-email.compose.previewError'
        );
    });
});
