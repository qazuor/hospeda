// @vitest-environment jsdom
import es from '@repo/i18n/locales/es/admin-billing.json';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermanentGrantsScreen } from '../PermanentGrantsScreen';

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const grantId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const planId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const versionId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const preview = {
    stoppedCharges: [],
    endingCourtesies: [],
    closedDeferredBalances: [],
    convertedAddons: []
};
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
const grantAct = vi.fn();
const anchorAct = vi.fn();
const emptyQuery = { data: undefined, error: null, isLoading: false, isFetching: false };
vi.mock('../../hooks/usePermanentGrants', () => ({
    useLivePermanentGrant: (input: unknown) => live(input),
    usePermanentGrantPreview: ({ body }: { body: unknown }) =>
        body ? { ...emptyQuery, data: preview } : emptyQuery,
    usePermanentGrantAnchorPreview: ({ body }: { body: unknown }) =>
        body ? { ...emptyQuery, data: preview } : emptyQuery,
    usePermanentGrantRevocationPreview: () => emptyQuery,
    usePermanentGrant: () => ({ mutateAsync: grantAct, isPending: false }),
    usePermanentGrantAnchor: () => ({ mutateAsync: anchorAct, isPending: false })
}));
vi.mock('@/features/billing-plan-catalog/hooks/usePlanCatalog', () => ({
    useAdminPlanCatalog: () => ({
        data: { plans: [{ planId, name: 'Test plan', currentVersion: { versionId } }] },
        isError: false,
        isSuccess: true
    })
}));
beforeEach(() => {
    vi.clearAllMocks();
    live.mockReturnValue({ ...emptyQuery, data: { grant: null } });
    grantAct.mockResolvedValue({ permanentGrantId: grantId });
    anchorAct.mockResolvedValue({ anchorId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' });
});

describe('AC:B13a:6 — beneficiary screen (support for TEST:B13a:5)', () => {
    it.each(['grant', 'anchor'] as const)('%s acts only after confirmation', async (action) => {
        if (action === 'anchor') {
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
        }
        const user = userEvent.setup();
        render(
            <PermanentGrantsScreen
                initialUserId={userId}
                onSearch={() => undefined}
            />
        );
        await user.click(screen.getByTestId(`permanent-grant-${action}-action`));
        await user.selectOptions(screen.getByTestId('permanent-grant-plan'), planId);
        if (action === 'grant') {
            await user.type(screen.getByTestId('permanent-grant-reason'), '  Grant test  ');
        }
        fireEvent.submit(screen.getByTestId(`permanent-grant-${action}-form`));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.getByTestId('permanent-grant-confirm-submit')).toBeInTheDocument();
        expect(grantAct).not.toHaveBeenCalled();
        expect(anchorAct).not.toHaveBeenCalled();

        await user.click(screen.getByTestId('permanent-grant-confirm-submit'));
        const anchor = {
            vertical: 'accommodation',
            planId,
            floorPlanVersionId: versionId
        };
        const expected =
            action === 'grant'
                ? {
                      beneficiaryUserId: userId,
                      reason: 'Grant test',
                      includesAddons: false,
                      anchors: [anchor]
                  }
                : { permanentGrantId: grantId, userId, body: anchor };
        const act = action === 'grant' ? grantAct : anchorAct;
        await waitFor(() => expect(act).toHaveBeenCalledExactlyOnceWith(expected));
        expect(action === 'grant' ? anchorAct : grantAct).not.toHaveBeenCalled();
    });

    it.each([
        'grant',
        'anchor'
    ] as const)('canceling %s preview never performs the act', async (action) => {
        if (action === 'anchor') {
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
        }
        const user = userEvent.setup();
        render(
            <PermanentGrantsScreen
                initialUserId={userId}
                onSearch={() => undefined}
            />
        );
        await user.click(screen.getByTestId(`permanent-grant-${action}-action`));
        await user.selectOptions(screen.getByTestId('permanent-grant-plan'), planId);
        if (action === 'grant') {
            await user.type(screen.getByTestId('permanent-grant-reason'), 'Grant test');
        }
        fireEvent.submit(screen.getByTestId(`permanent-grant-${action}-form`));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.getByTestId('permanent-grant-confirm-submit')).toBeInTheDocument();
        await user.click(screen.getByText('Volver'));
        expect(screen.queryByTestId('permanent-grant-confirm-submit')).not.toBeInTheDocument();
        expect(grantAct).not.toHaveBeenCalled();
        expect(anchorAct).not.toHaveBeenCalled();
    });

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
