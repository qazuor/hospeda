// @vitest-environment jsdom
/**
 * useUserHeaderProps — role-read failure surfacing (HOS-296).
 *
 * What is worth pinning: a FAILED role read must be visually distinguishable
 * from a slow one and from a legitimate subtitle. It used to be reported only
 * as an unstyled `subtitle` string plus a `rolesFailed` boolean that no
 * consumer read — so on a 403 the header rendered what looked like an ordinary
 * subtitle, with no error styling anywhere.
 */

import type { UserRoleGrantsResponse } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchApi } from '@/lib/api/client';
import { useUserHeaderProps } from '../useUserHeaderProps';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));

const mockedFetchApi = vi.mocked(fetchApi);

const USER_ID = '22222222-2222-4222-8222-222222222222';

const TWO_HATS = {
    userId: USER_ID,
    roles: [
        {
            role: 'USER',
            grantedAt: new Date('2026-01-05T10:00:00.000Z'),
            grantedBy: null,
            grantedByName: null,
            grantReason: 'signup'
        },
        {
            role: 'HOST',
            grantedAt: new Date('2026-03-01T12:00:00.000Z'),
            grantedBy: null,
            grantedByName: null,
            grantReason: 'accommodation_activated'
        }
    ]
} as UserRoleGrantsResponse;

/** Renders the hook's output so the badge tree can be asserted on. */
function Probe() {
    const { subtitle, badges } = useUserHeaderProps({
        entity: { displayName: 'Ada Host', lifecycleState: 'ACTIVE' },
        userId: USER_ID
    });
    return (
        <div>
            <span data-testid="subtitle">{subtitle ?? ''}</span>
            <div data-testid="badges">{badges}</div>
        </div>
    );
}

const renderProbe = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } }
    });
    return render(
        <QueryClientProvider client={queryClient}>
            <Probe />
        </QueryClientProvider>
    );
};

afterEach(() => {
    vi.clearAllMocks();
});

describe('useUserHeaderProps (HOS-296)', () => {
    it('joins every held role into the subtitle when the read succeeds', async () => {
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: TWO_HATS }
        } as never);

        renderProbe();

        await waitFor(() => {
            expect(screen.getByTestId('subtitle').textContent).toBe(
                'admin-pages.access.roles.catalog.USER.name, admin-pages.access.roles.catalog.HOST.name'
            );
        });
        // No failure badge alongside a successful read.
        expect(screen.getByTestId('badges').textContent).not.toContain(
            'admin-pages.access.users.roles.loadFailedBadge'
        );
    });

    it('reports a failed read as a badge, NOT as a subtitle that reads like content', async () => {
        mockedFetchApi.mockRejectedValue(new Error('403'));

        renderProbe();

        await waitFor(() => {
            expect(screen.getByTestId('badges').textContent).toContain(
                'admin-pages.access.users.roles.loadFailedBadge'
            );
        });
        // The subtitle stays empty: an error string there is indistinguishable
        // from a legitimate role list.
        expect(screen.getByTestId('subtitle').textContent).toBe('');
    });
});
