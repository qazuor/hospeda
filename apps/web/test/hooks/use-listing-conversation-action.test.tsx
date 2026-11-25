import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useListingConversationAction } from '@/hooks/use-listing-conversation-action';
import { resetAccommodationConversationStore } from '@/store/accommodation-conversation-store';

const { list, readCachedAuthMe } = vi.hoisted(() => ({ list: vi.fn(), readCachedAuthMe: vi.fn() }));
vi.mock('@/lib/api/endpoints-protected', () => ({ protectedConversationsApi: { list } }));
vi.mock('@/lib/auth-cache', () => ({
    readCachedAuthMe,
    fetchAuthMe: vi.fn(),
    writeCachedAuthMe: vi.fn()
}));

describe('useListingConversationAction', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        resetAccommodationConversationStore();
    });

    it('never fetches conversations for guests', async () => {
        readCachedAuthMe.mockReturnValue({ isAuthenticated: false });
        const { result } = renderHook(() =>
            useListingConversationAction({ accommodationId: 'acc-1', locale: 'en' })
        );
        await waitFor(() => expect(readCachedAuthMe).toHaveBeenCalled());
        expect(list).not.toHaveBeenCalled();
        expect(result.current.href).toBe('#contact');
    });

    it('shares one lookup between surfaces and resolves the thread', async () => {
        readCachedAuthMe.mockReturnValue({ isAuthenticated: true });
        list.mockResolvedValue({ ok: true, data: { items: [{ id: 'thread-1' }] } });
        const { result } = renderHook(() => ({
            sidebar: useListingConversationAction({ accommodationId: 'acc-1', locale: 'en' }),
            mobile: useListingConversationAction({ accommodationId: 'acc-1', locale: 'en' })
        }));
        await waitFor(() => expect(result.current.sidebar.hasConversation).toBe(true));
        expect(result.current.mobile).toEqual(result.current.sidebar);
        expect(result.current.mobile.href).toBe('/en/mi-cuenta/consultas/thread-1/');
        expect(list).toHaveBeenCalledTimes(1);
    });

    it('does not look up conversations on other verticals', () => {
        const { result } = renderHook(() =>
            useListingConversationAction({ locale: 'en', fallbackHref: '#venue-contact' })
        );
        expect(readCachedAuthMe).not.toHaveBeenCalled();
        expect(list).not.toHaveBeenCalled();
        expect(result.current.href).toBe('#venue-contact');
    });

    it('degrades to the inquiry anchor when the lookup fails', async () => {
        readCachedAuthMe.mockReturnValue({ isAuthenticated: true });
        list.mockRejectedValue(new Error('offline'));
        const { result } = renderHook(() =>
            useListingConversationAction({ accommodationId: 'acc-1', locale: 'en' })
        );
        await waitFor(() => expect(list).toHaveBeenCalled());
        expect(result.current.hasConversation).toBe(false);
        expect(result.current.href).toBe('#contact');
    });
});
