// @vitest-environment jsdom
import es from '@repo/i18n/locales/es/admin-billing.json';
import { PermissionEnum } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { isRedirect } from '@tanstack/react-router';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors';
import { TemporaryCourtesyScreen } from '../components/TemporaryCourtesyScreen';
import type { CourtesyGrantPreview } from '../hooks/useTemporaryCourtesy';

vi.mock('@tanstack/react-router', async (importOriginal) => importOriginal());
const fetchApi = vi.fn();
vi.mock('@/lib/api/client', () => ({ fetchApi: (...args: unknown[]) => fetchApi(...args) }));
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        locale: 'es',
        t: (key: string, params?: Record<string, unknown>) => {
            let value: unknown = es;
            for (const part of key.replace('admin-billing.', '').split('.'))
                value =
                    typeof value === 'object' && value !== null
                        ? (value as Record<string, unknown>)[part]
                        : undefined;
            return typeof value === 'string'
                ? Object.entries(params ?? {}).reduce(
                      (text, [name, item]) => text.replaceAll(`{${name}}`, String(item)),
                      value
                  )
                : key;
        }
    })
}));
vi.mock('@/hooks/use-user-permissions', () => ({
    useUserPermissions: () => [PermissionEnum.BILLING_GRANT_COMPLIMENTARY]
}));
vi.mock('@/hooks/use-auth-context', () => ({ useAuthContext: () => ({ isLoading: false }) }));
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const current = '2026-12-07T03:00:00.000Z';
const next = '2027-01-07T03:00:00.000Z';
const grantPreview: CourtesyGrantPreview = {
    subscriptionId: id,
    status: 'ACTIVE',
    cycle: 'monthly',
    offered: true,
    liveCourtesy: null,
    months: 1,
    endsAt: current
};
const liveCourtesy = { courtesyGrantId: id, endsAt: current, remainingMonths: 1 };
const revokePreview = {
    subscriptionId: id,
    status: 'PAUSED',
    inForce: true,
    courtesy: liveCourtesy,
    predictedNextChargeAt: '2026-11-17T03:00:00.000Z'
};
const inspection = { subject: { id, displayName: 'Cliente Uno' } };
function setup({
    grant = grantPreview,
    revokeResult
}: {
    grant?: CourtesyGrantPreview;
    revokeResult?: { readonly at: string };
} = {}) {
    fetchApi.mockImplementation(async (input?: { path: string; method?: string }) => {
        if (!input) return undefined;
        const { path, method } = input;
        if (path.endsWith('/courtesy/grant-preview?months=1')) return { data: { data: grant } };
        if (path.endsWith(`/billing-subscription/${id}`)) return { data: { data: inspection } };
        if (path.endsWith('/courtesy/revoke-preview')) return { data: { data: revokePreview } };
        if (path.endsWith('/courtesy/grant') && method === 'POST')
            return { data: { data: { outcome: 'GRANTED', courtesyGrantId: id, endsAt: current } } };
        if (path.endsWith('/courtesy/revoke') && method === 'POST')
            return {
                data: {
                    data: {
                        outcome: 'RESUMED',
                        nextCharge: revokeResult
                            ? { ...revokeResult, amountMinor: 100, currency: 'ARS' }
                            : null
                    }
                }
            };
        throw new Error(`Unexpected path ${path}`);
    });
    render(
        <QueryClientProvider
            client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
            <TemporaryCourtesyScreen subscriptionId={id} />
        </QueryClientProvider>
    );
}
async function reviewGrant() {
    await screen.findByLabelText(es.temporaryCourtesy.reason);
    fireEvent.change(screen.getByLabelText(es.temporaryCourtesy.reason), {
        target: { value: 'Atención comercial' }
    });
    fireEvent.click(screen.getByRole('button', { name: es.temporaryCourtesy.review }));
}
beforeEach(() => fetchApi.mockReset());
describe('AC:B9b:14 support for TEST:B9b:13 temporary courtesy screen', () => {
    it('explains annual refusal with both alternatives and offers only the revocation-free state', async () => {
        setup({
            grant: {
                ...grantPreview,
                cycle: 'annual',
                offered: false,
                reason: 'NOT_MONTHLY',
                alternatives: ['PERMANENT_GRANT', 'RENEWAL_PROMO']
            }
        });
        const refusal = await screen.findByTestId('courtesy-unavailable');
        expect(refusal).toHaveTextContent(
            'No disponible: el plan de Cliente Uno es annual, no mensual.'
        );
        expect(refusal).toHaveTextContent('Motivo: NOT_MONTHLY.');
        expect(refusal).toHaveTextContent(es.temporaryCourtesy.alternatives);
        expect(screen.queryByRole('button', { name: es.temporaryCourtesy.review })).toBeNull();
    });
    it('shows the new end for a first grant and posts explicit confirmation', async () => {
        setup();
        await reviewGrant();
        const confirmation = screen.getByTestId('courtesy-grant-confirmation');
        expect(confirmation).toHaveTextContent('La cortesía termina el 07/12/2026');
        expect(confirmation).toHaveTextContent('se pausa en Mercado Pago y el servicio sigue');
        fireEvent.click(screen.getByRole('button', { name: es.temporaryCourtesy.confirm }));
        await waitFor(() =>
            expect(fetchApi).toHaveBeenCalledWith({
                path: `/api/v1/admin/billing-subscription/${id}/courtesy/grant`,
                method: 'POST',
                body: {
                    expectedStatus: 'ACTIVE',
                    months: 1,
                    reason: 'Atención comercial',
                    confirmed: true
                }
            })
        );
    });
    it('shows both current and new end when months are added', async () => {
        setup({ grant: { ...grantPreview, status: 'PAUSED', liveCourtesy, endsAt: next } });
        await reviewGrant();
        expect(screen.getByTestId('courtesy-grant-confirmation')).toHaveTextContent(
            'hasta el 07/12/2026'
        );
        expect(screen.getByTestId('courtesy-grant-confirmation')).toHaveTextContent(
            'Se suman 1 meses: la fecha de fin nueva es el 07/01/2027'
        );
    });
    it('states remaining courtesy, no refund, ACTIVE and predicted charge date before revocation; displays confirmed charge after', async () => {
        setup({
            grant: { ...grantPreview, status: 'PAUSED', liveCourtesy, endsAt: next },
            revokeResult: { at: '2026-11-19T03:00:00.000Z' }
        });
        fireEvent.click(
            await screen.findByRole('button', { name: es.temporaryCourtesy.reviewRevoke })
        );
        const confirmation = screen.getByTestId('courtesy-revoke-confirmation');
        expect(confirmation).toHaveTextContent('1 meses, hasta el 07/12/2026');
        expect(confirmation).toHaveTextContent('sin reembolso');
        expect(confirmation).toHaveTextContent('vuelve a ACTIVE');
        expect(confirmation).toHaveTextContent('se le cobra el 17/11/2026');
        fireEvent.click(screen.getByRole('button', { name: es.temporaryCourtesy.confirm }));
        await waitFor(() =>
            expect(fetchApi).toHaveBeenCalledWith({
                path: `/api/v1/admin/billing-subscription/${id}/courtesy/revoke`,
                method: 'POST',
                body: { expectedStatus: 'PAUSED', confirmed: true }
            })
        );
        expect(await screen.findByTestId('courtesy-result')).toHaveTextContent('19/11/2026');
    });
    it('requires the complimentary billing permission on the direct route', async () => {
        const { Route } = await import(
            '@/routes/_authed/billing/subscriptions/$subscriptionId.courtesy'
        );
        expect(
            (Route.options.beforeLoad as (input: unknown) => unknown)({
                context: {
                    permissions: [
                        PermissionEnum.ACCESS_API_ADMIN,
                        PermissionEnum.BILLING_GRANT_COMPLIMENTARY
                    ]
                }
            })
        ).toBeUndefined();
        let rejection: unknown;
        try {
            (Route.options.beforeLoad as (input: unknown) => unknown)({
                context: {
                    permissions: [
                        PermissionEnum.ACCESS_API_ADMIN,
                        PermissionEnum.BILLING_PAUSE_SUBSCRIPTION
                    ]
                }
            });
        } catch (error) {
            rejection = error;
        }
        expect(isRedirect(rejection)).toBe(true);
    });
    it('explains a provider pause that was not applied', async () => {
        setup();
        await reviewGrant();
        fetchApi.mockImplementation(async (input?: { path: string; method?: string }) => {
            if (!input) return undefined;
            const { path, method } = input;
            if (path.endsWith('/courtesy/grant') && method === 'POST')
                throw new ApiError('Not applied', {
                    status: 409,
                    body: { error: { code: 'COURTESY_NOT_APPLIED' } }
                });
            if (path.endsWith('/courtesy/grant-preview?months=1'))
                return { data: { data: grantPreview } };
            if (path.endsWith(`/billing-subscription/${id}`)) return { data: { data: inspection } };
            throw new Error(`Unexpected path ${path}`);
        });
        fireEvent.click(screen.getByRole('button', { name: es.temporaryCourtesy.confirm }));
        expect(await screen.findByRole('alert')).toHaveTextContent(es.temporaryCourtesy.notApplied);
    });
});
