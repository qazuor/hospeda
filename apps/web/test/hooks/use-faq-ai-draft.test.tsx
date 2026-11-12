import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPostProtected, mockAddToast } = vi.hoisted(() => ({
    mockPostProtected: vi.fn(),
    mockAddToast: vi.fn()
}));

vi.mock('@/lib/api/client', () => ({ apiClient: { postProtected: mockPostProtected } }));
vi.mock('@/store/toast-store', () => ({ addToast: mockAddToast }));

import { useFaqAiDraft } from '@/hooks/use-faq-ai-draft';

describe('useFaqAiDraft', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('posts for the message and returns the generated draft to the form', async () => {
        mockPostProtected.mockResolvedValueOnce({
            ok: true,
            data: { hasData: true, draft: 'Hay cochera.' }
        });
        const { result } = renderHook(() => useFaqAiDraft({ locale: 'es' }));
        const onDraft = vi.fn();

        await act(async () => {
            await result.current.suggest({
                messageId: '22222222-2222-4222-8222-222222222222',
                onDraft
            });
        });

        expect(mockPostProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/ai/listing-questions/22222222-2222-4222-8222-222222222222/faq-draft'
        });
        expect(onDraft).toHaveBeenCalledWith('Hay cochera.');
        expect(result.current.feedback).toBeNull();
        expect(result.current.isLoading).toBe(false);
    });

    it('shows no-data feedback without filling the answer', async () => {
        mockPostProtected.mockResolvedValueOnce({
            ok: true,
            data: { hasData: false, draft: null }
        });
        const { result } = renderHook(() => useFaqAiDraft({ locale: 'es' }));
        const onDraft = vi.fn();

        await act(async () => {
            await result.current.suggest({ messageId: 'message-id', onDraft });
        });

        expect(result.current.feedback).toBe('noData');
        expect(onDraft).not.toHaveBeenCalled();
    });

    it('maps eligibility and quota failures to their UI states', async () => {
        const { result } = renderHook(() => useFaqAiDraft({ locale: 'es' }));
        mockPostProtected
            .mockResolvedValueOnce({
                ok: false,
                error: { status: 409, code: 'FAQ_DRAFT_NOT_ELIGIBLE' }
            })
            .mockResolvedValueOnce({
                ok: false,
                error: {
                    status: 403,
                    code: 'LIMIT_REACHED',
                    details: {
                        limitKey: 'max_ai_faq_draft_per_month',
                        currentCount: 50,
                        maxAllowed: 50
                    }
                }
            });

        await act(async () => {
            await result.current.suggest({ messageId: 'message-id', onDraft: vi.fn() });
        });
        expect(result.current.feedback).toBe('notEligible');

        await act(async () => {
            await result.current.suggest({ messageId: 'message-id', onDraft: vi.fn() });
        });
        expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
        expect(result.current.feedback).toBeNull();
    });

    it('maps provider failures to the generic error state', async () => {
        mockPostProtected.mockRejectedValueOnce(new Error('request failed'));
        const { result } = renderHook(() => useFaqAiDraft({ locale: 'es' }));

        await act(async () => {
            await result.current.suggest({ messageId: 'message-id', onDraft: vi.fn() });
        });

        expect(result.current.feedback).toBe('error');
        expect(result.current.isLoading).toBe(false);
    });
});
