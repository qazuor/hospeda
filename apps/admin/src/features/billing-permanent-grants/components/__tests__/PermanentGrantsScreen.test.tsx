// @vitest-environment jsdom
import es from '@repo/i18n/locales/es/admin-billing.json';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermanentGrantsScreen } from '../PermanentGrantsScreen';

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const grantId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function translate(key: string, params?: Record<string, unknown>) {
    let node: unknown = es;
    for (const part of key.replace('admin-billing.', '').split('.'))
        node =
            typeof node === 'object' && node ? (node as Record<string, unknown>)[part] : undefined;
    if (typeof node !== 'string') return key;
    return Object.entries(params ?? {}).reduce(
        (value, [name, replacement]) =>
            value
                .replaceAll(`{{${name}}}`, String(replacement))
                .replaceAll(`{${name}}`, String(replacement)),
        node
    );
}
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: translate, locale: 'es' })
}));

const live = vi.fn();
const emptyQuery = { data: undefined, error: null, isLoading: false, isFetching: false };
vi.mock('../../hooks/usePermanentGrants', () => ({
    useLivePermanentGrant: (input: unknown) => live(input),
    usePermanentGrantPreview: () => emptyQuery,
    usePermanentGrantAnchorPreview: () => emptyQuery,
    usePermanentGrantRevocationPreview: () => emptyQuery,
    usePermanentGrant: () => ({ mutateAsync: vi.fn(), isPending: false }),
    usePermanentGrantAnchor: () => ({ mutateAsync: vi.fn(), isPending: false })
}));
vi.mock('@/features/billing-plan-catalog/hooks/usePlanCatalog', () => ({
    useAdminPlanCatalog: () => ({ data: { plans: [] }, isError: false, isSuccess: true })
}));
beforeEach(() => {
    vi.clearAllMocks();
    live.mockReturnValue({ ...emptyQuery, data: { grant: null } });
});

describe('AC:B13a:6 — beneficiary screen (support for TEST:B13a:5)', () => {
    it('rejects an invalid UUID without requesting a grant', async () => {
        const user = userEvent.setup();
        const onSearch = vi.fn();
        render(<PermanentGrantsScreen onSearch={onSearch} />);
        await user.type(screen.getByTestId('permanent-grant-beneficiary-id'), 'bad-id');
        fireEvent.submit(screen.getByTestId('permanent-grant-search').closest('form')!);
        expect(screen.getByRole('alert')).toHaveTextContent('UUID válido');
        expect(onSearch).not.toHaveBeenCalled();
        expect(live).toHaveBeenCalledWith({ userId: '', enabled: false });
    });

    it('offers grant only when there is no live grant', () => {
        render(
            <PermanentGrantsScreen
                initialUserId={userId}
                onSearch={() => undefined}
            />
        );
        expect(screen.getByTestId('permanent-grant-live')).toHaveTextContent('Sin grant vivo');
        expect(screen.getByTestId('permanent-grant-grant-action')).toBeInTheDocument();
        expect(screen.queryByTestId('permanent-grant-revoke-action')).toBeNull();
    });

    it('offers anchor and revoke only with a live grant', () => {
        live.mockReturnValue({
            ...emptyQuery,
            data: {
                grant: {
                    permanentGrantId: grantId,
                    anchors: [],
                    includesAddons: false,
                    createdAt: '2026-10-01T00:00:00.000Z'
                }
            }
        });
        render(
            <PermanentGrantsScreen
                initialUserId={userId}
                onSearch={() => undefined}
            />
        );
        expect(screen.getByTestId('permanent-grant-live')).toHaveTextContent(grantId);
        expect(screen.getByTestId('permanent-grant-anchor-action')).toBeInTheDocument();
        expect(screen.getByTestId('permanent-grant-revoke-action')).toBeInTheDocument();
        expect(screen.queryByTestId('permanent-grant-grant-action')).toBeNull();
    });
});
