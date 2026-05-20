/**
 * @file AuthedPreferenceSync.test.tsx
 * @description Tests the silent backend sync for authenticated preferences.
 */

import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthedPreferenceSync } from '../../../../src/components/shared/preferences/AuthedPreferenceSync.client';
import { AUTH_ME_CACHE_KEY } from '../../../../src/lib/auth-cache';
import { clearToasts, getToasts } from '../../../../src/store/toast-store';

vi.mock('../../../../src/lib/env', () => ({
    getApiUrl: () => 'https://api.test'
}));

function dispatch(detail: { kind: 'theme' | 'locale'; value: string }) {
    window.dispatchEvent(new CustomEvent('preferences:change', { detail }));
}

function setAuth({ authed, userId }: { authed: boolean; userId: string | null }) {
    document.documentElement.setAttribute('data-user-authenticated', authed ? 'true' : 'false');
    if (authed && userId) {
        sessionStorage.setItem(
            AUTH_ME_CACHE_KEY,
            JSON.stringify({
                isAuthenticated: true,
                user: { id: userId },
                permissions: [],
                cachedAt: Date.now()
            })
        );
    } else {
        sessionStorage.removeItem(AUTH_ME_CACHE_KEY);
    }
}

describe('AuthedPreferenceSync', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        clearToasts();
        sessionStorage.clear();
        fetchMock = vi.fn().mockResolvedValue({ ok: true });
        global.fetch = fetchMock as unknown as typeof fetch;
    });

    afterEach(() => {
        clearToasts();
        sessionStorage.clear();
        vi.restoreAllMocks();
    });

    it('renders nothing', () => {
        const { container } = render(<AuthedPreferenceSync />);
        expect(container.firstChild).toBeNull();
    });

    it('does not call fetch for guests', async () => {
        setAuth({ authed: false, userId: null });
        render(<AuthedPreferenceSync />);
        dispatch({ kind: 'theme', value: 'dark' });
        await Promise.resolve();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('does not call fetch when authenticated but no userId in cache', async () => {
        setAuth({ authed: true, userId: null });
        document.documentElement.setAttribute('data-user-authenticated', 'true');
        render(<AuthedPreferenceSync />);
        dispatch({ kind: 'theme', value: 'dark' });
        await Promise.resolve();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('PATCHes themeWeb when an authed user changes the theme', async () => {
        setAuth({ authed: true, userId: 'user-123' });
        render(<AuthedPreferenceSync />);
        dispatch({ kind: 'theme', value: 'dark' });
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('https://api.test/api/v1/protected/users/user-123');
        expect(init.method).toBe('PATCH');
        const body = JSON.parse(init.body as string);
        expect(body).toEqual({ settings: { themeWeb: 'dark' } });
    });

    it('PATCHes languageWeb when an authed user changes the locale', async () => {
        setAuth({ authed: true, userId: 'user-123' });
        render(<AuthedPreferenceSync />);
        dispatch({ kind: 'locale', value: 'pt' });
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

        const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
        const body = JSON.parse(init.body as string);
        expect(body).toEqual({ settings: { languageWeb: 'pt' } });
    });

    it('shows an error toast when the server responds with non-ok', async () => {
        setAuth({ authed: true, userId: 'user-123' });
        fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });

        render(<AuthedPreferenceSync />);
        dispatch({ kind: 'theme', value: 'dark' });

        await vi.waitFor(() => {
            const toasts = getToasts();
            expect(toasts).toHaveLength(1);
            expect(toasts[0]?.type).toBe('error');
        });
    });

    it('shows an error toast on network failure', async () => {
        setAuth({ authed: true, userId: 'user-123' });
        fetchMock.mockRejectedValueOnce(new Error('Network down'));

        render(<AuthedPreferenceSync />);
        dispatch({ kind: 'theme', value: 'dark' });

        await vi.waitFor(() => {
            const toasts = getToasts();
            expect(toasts).toHaveLength(1);
            expect(toasts[0]?.type).toBe('error');
        });
    });
});
