// @vitest-environment jsdom
/** TEST:B13a:19 (component level) — the MP4 confirmation of fila 10-bis (HOS-1640). */

import es from '@repo/i18n/locales/es/admin-billing.json';
import { PermissionEnum } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors';
import { LateManualPaymentSection } from '../LateManualPaymentSection';

const state = vi.hoisted(() => ({
    permissions: [] as string[],
    fetchApi: vi.fn()
}));

vi.mock('@/hooks/use-user-permissions', () => ({
    useUserPermissions: () => state.permissions,
    useHasPermission: (permission: string) => state.permissions.includes(permission)
}));
vi.mock('@/hooks/use-auth-context', () => ({ useAuthContext: () => ({ isLoading: false }) }));
vi.mock('@/lib/api/client', () => ({ fetchApi: state.fetchApi }));
vi.mock('@/lib/format-helpers', () => ({
    formatDateWithTime: ({ date }: { date: string }) => date.slice(0, 10)
}));
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        locale: 'es',
        t: (key: string, params?: Record<string, unknown>) => {
            let value: unknown = es;
            for (const part of key.replace('admin-billing.', '').split('.')) {
                value =
                    typeof value === 'object' && value !== null
                        ? (value as Record<string, unknown>)[part]
                        : undefined;
            }
            return typeof value === 'string'
                ? Object.entries(params ?? {}).reduce(
                      (text, [name, item]) => text.replaceAll(`{${name}}`, String(item)),
                      value
                  )
                : key;
        }
    })
}));

const L = es.subscriptionAdmin.lateManualPayment;
const SUB = '11111111-1111-4111-8111-111111111111';
const DECLARED = '22222222-2222-4222-8222-222222222222';
const AWAITING = '33333333-3333-4333-8333-333333333333';
const LIST_PATH = `/api/v1/admin/billing-subscription/${SUB}/manual-payments`;
const MP4_PATH = `${LIST_PATH}/${DECLARED}/register-late`;

const noEffects = {
    complements: { resumed: [], skipped: [] },
    touristVip: { cancels: false, subscriptionIds: [] },
    scheduledChange: null
};
const basePreview = {
    subscriptionId: SUB,
    manualPaymentId: DECLARED,
    periodStart: '2026-08-03T12:00:00.000Z',
    reimputedPeriodStart: null,
    nextChargeAt: '2026-09-03T12:00:00.000Z',
    effect: 'S7',
    periodCase: 'WITHIN_PERIOD',
    nextChargeOverdue: false,
    vertical: 'accommodation',
    presence: { kind: 'NONE', vertical: 'tourist' },
    s7Effects: noEffects
};

function arrangeApi(preview: Record<string, unknown>) {
    state.fetchApi.mockImplementation(
        async ({ path, method }: { path: string; method?: string }) => {
            if (path === LIST_PATH)
                return {
                    data: {
                        data: [
                            {
                                id: DECLARED,
                                periodStart: '2026-08-03T12:00:00.000Z',
                                status: 'DECLARED_UNPAID',
                                registeredBy: null,
                                registeredAt: null,
                                proofRef: null
                            },
                            {
                                id: AWAITING,
                                periodStart: '2026-09-03T12:00:00.000Z',
                                status: 'AWAITING',
                                registeredBy: null,
                                registeredAt: null,
                                proofRef: null
                            }
                        ]
                    }
                };
            if (path === MP4_PATH && method === 'POST')
                return {
                    data: {
                        data: {
                            effect: preview.effect,
                            nextChargeAt: '2026-09-03T12:00:00.000Z',
                            periodStart: '2026-08-03T12:00:00.000Z',
                            reimputedFrom: null,
                            receiptId: null
                        }
                    }
                };
            if (path === MP4_PATH) return { data: { data: preview } };
            throw new Error(`unexpected ${path}`);
        }
    );
}

function renderSection(paymentMethod: 'CARD' | 'MANUAL' | null = 'MANUAL') {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <LateManualPaymentSection
                subscriptionId={SUB}
                paymentMethod={paymentMethod}
            />
        </QueryClientProvider>
    );
}

async function openReview() {
    const review = await screen.findByRole('button', { name: L.review });
    fireEvent.click(review);
    return screen.findByTestId('late-manual-payment-preview');
}

beforeEach(() => {
    state.permissions = [
        PermissionEnum.BILLING_SUBSCRIPTION_INSPECT,
        PermissionEnum.BILLING_REGISTER_MANUAL_PAYMENT
    ];
    state.fetchApi.mockReset();
});

describe('HOS-1640 manual installments section', () => {
    it('is not rendered for a card subscription', () => {
        // Arrange
        arrangeApi(basePreview);

        // Act
        renderSection('CARD');

        // Assert
        expect(screen.queryByTestId('late-manual-payment-section')).toBeNull();
        expect(state.fetchApi).not.toHaveBeenCalled();
    });

    it.each([
        [[]],
        [[PermissionEnum.BILLING_REGISTER_MANUAL_PAYMENT]],
        [[PermissionEnum.BILLING_SUBSCRIPTION_INSPECT]]
    ])('N7: is not rendered unless both inspect and MP4 are granted (%o)', (granted) => {
        // Arrange
        state.permissions = granted;
        arrangeApi(basePreview);

        // Act
        renderSection();

        // Assert
        expect(screen.queryByTestId('late-manual-payment-section')).toBeNull();
        expect(state.fetchApi).not.toHaveBeenCalled();
    });

    it('lists only the installments declared unpaid', async () => {
        // Arrange
        arrangeApi(basePreview);

        // Act
        renderSection();

        // Assert
        expect(await screen.findAllByRole('button', { name: L.review })).toHaveLength(1);
        expect(screen.getByText(L.installment.replace('{date}', '2026-08-03'))).toBeTruthy();
    });

    it('reviews before confirming, then registers with the proof reference', async () => {
        // Arrange
        arrangeApi(basePreview);
        renderSection();

        // Act
        await openReview();
        fireEvent.change(screen.getByLabelText(L.proofRef), { target: { value: 'transfer-77' } });
        fireEvent.click(screen.getByRole('button', { name: L.confirm }));

        // Assert
        expect(
            await screen.findByText(L.resultS7.replace('{nextChargeAt}', '2026-09-03'))
        ).toBeTruthy();
        expect(state.fetchApi).toHaveBeenCalledWith({
            path: MP4_PATH,
            method: 'POST',
            body: { proofRef: 'transfer-77' }
        });
    });
});

describe('TEST:B13a:19 the confirmation says what period it pays', () => {
    it('WITHIN_PERIOD: pays the own period and names the next installment', async () => {
        // Arrange
        arrangeApi(basePreview);
        renderSection();

        // Act
        await openReview();

        // Assert
        expect(screen.getByTestId('late-manual-payment-period').textContent).toBe(
            L.periodCases.WITHIN_PERIOD.replace('{periodStart}', '2026-08-03').replace(
                '{nextChargeAt}',
                '2026-09-03'
            )
        );
        expect(screen.queryByRole('note')).toBeNull();
    });

    it('REIMPUTED: pays the period starting today and the next opens in one cycle', async () => {
        // Arrange
        arrangeApi({
            ...basePreview,
            periodCase: 'REIMPUTED',
            reimputedPeriodStart: '2026-10-10T12:00:00.000Z',
            nextChargeAt: '2026-11-10T12:00:00.000Z'
        });
        renderSection();

        // Act
        await openReview();

        // Assert
        const text = screen.getByTestId('late-manual-payment-period').textContent ?? '';
        expect(text).toContain('2026-10-10');
        expect(text).toContain('2026-11-10');
    });

    it('C5_FALLBACK: goes back to the original period and warns the next one is overdue', async () => {
        // Arrange
        arrangeApi({ ...basePreview, periodCase: 'C5_FALLBACK', nextChargeOverdue: true });
        renderSection();

        // Act
        await openReview();

        // Assert
        expect(screen.getByTestId('late-manual-payment-period').textContent).toContain(
            L.periodCases.C5_FALLBACK.slice(0, 40)
        );
        expect(screen.getByRole('note').textContent).toBe(L.nextChargeOverdue);
    });

    it('S19: says the payment does not reactivate, covers the original period, and shows no S7 effects', async () => {
        // Arrange
        arrangeApi({
            ...basePreview,
            effect: 'S19',
            periodCase: 'ORIGINAL_PERIOD',
            nextChargeOverdue: true,
            presence: null,
            s7Effects: null
        });
        renderSection();

        // Act
        await openReview();

        // Assert
        expect(screen.getByTestId('late-manual-payment-s19').textContent).toContain(L.s19Body);
        expect(screen.getByTestId('late-manual-payment-period').textContent).toBe(
            L.periodCases.ORIGINAL_PERIOD.replace('{periodStart}', '2026-08-03').replaceAll(
                '{nextChargeAt}',
                '2026-09-03'
            )
        );
        expect(screen.getByTestId('late-manual-payment-period').textContent).not.toContain(
            'todavía no terminó'
        );
        expect(screen.getByRole('note').textContent).toBe(L.nextChargeOverdue);
        expect(screen.queryByTestId('late-manual-payment-effects')).toBeNull();
        expect(screen.queryByText(L.serviceReturns)).toBeNull();
    });
});

describe('TEST:B13a:19 the confirmation says what comes back and what does not', () => {
    it('a listing vertical: which listing returns and which does not, and why', async () => {
        // Arrange
        const listings = [
            ['RETURNS', 'Casa del Río'],
            ['ARCHIVED_DRAFT', 'Borrador viejo'],
            ['PURGED', 'Cabaña purgada'],
            ['NO_SLOT', 'Sin cupo'],
            ['LOWERED_BY_SURPLUS', 'Sobrante']
        ].map(([outcome, name], index) => ({
            id: `4444444${index}-4444-4444-8444-444444444444`,
            name,
            publicationStatus: 'ARCHIVED',
            outcome
        }));
        arrangeApi({
            ...basePreview,
            presence: { kind: 'LISTINGS', vertical: 'accommodation', limit: 1, listings }
        });
        renderSection();

        // Act
        await openReview();

        // Assert
        const presence = screen.getByTestId('late-manual-payment-presence');
        expect(within(presence).getByText(L.limit.replace('{limit}', '1'))).toBeTruthy();
        for (const listing of listings) {
            const item = presence.querySelector(`[data-outcome="${listing.outcome}"]`);
            expect(item?.textContent).toContain(listing.name);
            expect(item?.textContent).toContain(
                L.listingOutcomes[listing.outcome as keyof typeof L.listingOutcomes]
            );
        }
    });

    it('Partner: the gold page returns', async () => {
        // Arrange
        arrangeApi({
            ...basePreview,
            vertical: 'partner',
            presence: {
                kind: 'PARTNER',
                partner: { name: 'Bodega Sur', slug: 'bodega-sur' },
                outcome: 'GOLD_PAGE_RETURNS'
            }
        });
        renderSection();

        // Act
        await openReview();

        // Assert
        expect(screen.getByTestId('late-manual-payment-presence').textContent).toBe(
            L.partnerOutcomes.GOLD_PAGE_RETURNS.replace('{name}', 'Bodega Sur')
        );
    });

    it('Partner: a revoked partner does not return (410)', async () => {
        // Arrange
        arrangeApi({
            ...basePreview,
            vertical: 'partner',
            presence: {
                kind: 'PARTNER',
                partner: { name: 'Bodega Sur', slug: 'bodega-sur' },
                outcome: 'REVOKED'
            }
        });
        renderSection();

        // Act
        await openReview();

        // Assert
        expect(screen.getByTestId('late-manual-payment-presence').textContent).toBe(
            L.partnerOutcomes.REVOKED.replace('{name}', 'Bodega Sur')
        );
    });

    it('S7: states the three other effects when they apply', async () => {
        // Arrange
        arrangeApi({
            ...basePreview,
            s7Effects: {
                complements: {
                    resumed: ['55555555-5555-4555-8555-555555555555'],
                    skipped: ['66666666-6666-4666-8666-666666666666']
                },
                touristVip: {
                    cancels: true,
                    subscriptionIds: ['77777777-7777-4777-8777-777777777777']
                },
                scheduledChange: { effectiveAt: '2026-09-01T00:00:00.000Z' }
            }
        });
        renderSection();

        // Act
        await openReview();

        // Assert
        const effects = screen.getByTestId('late-manual-payment-effects');
        expect(effects.querySelector('[data-effect="complements"]')?.textContent).toBe(
            L.effects.complementsResumed.replace('{count}', '1')
        );
        expect(effects.querySelector('[data-effect="complements-skipped"]')?.textContent).toBe(
            L.effects.complementsSkipped.replace('{count}', '1')
        );
        expect(effects.querySelector('[data-effect="tourist-vip"]')?.textContent).toBe(
            L.effects.touristVipCancels
        );
        expect(effects.querySelector('[data-effect="scheduled-change"]')?.textContent).toBe(
            L.effects.scheduledChange.replace('{date}', '2026-09-01')
        );
    });

    it('S7: says so when none of the three effects applies', async () => {
        // Arrange
        arrangeApi(basePreview);
        renderSection();

        // Act
        await openReview();

        // Assert
        const effects = screen.getByTestId('late-manual-payment-effects');
        expect(effects.textContent).toContain(L.effects.noComplements);
        expect(effects.textContent).toContain(L.effects.noTouristVip);
        expect(effects.textContent).toContain(L.effects.noScheduledChange);
        expect(effects.querySelector('[data-effect="complements-skipped"]')).toBeNull();
    });
});

describe('HOS-1640 MP4 rejections', () => {
    it('shows the localized reason when the registration is rejected', async () => {
        // Arrange
        arrangeApi(basePreview);
        const original = state.fetchApi.getMockImplementation();
        state.fetchApi.mockImplementation(async (input: { path: string; method?: string }) => {
            if (input.method === 'POST')
                throw new ApiError('conflict', {
                    status: 409,
                    body: { error: { reason: 'LOST_RACE' } }
                });
            return original?.(input);
        });
        renderSection();

        // Act
        await openReview();
        fireEvent.click(screen.getByRole('button', { name: L.confirm }));

        // Assert
        await waitFor(() =>
            expect(screen.getByRole('alert').textContent).toBe(L.rejections.LOST_RACE)
        );
    });

    it.each([
        'LOST_RACE',
        'MANUAL_PAYMENT_NOT_DECLARED_UNPAID'
    ])('N5: a stale %s refetches the installments and the confirmation', async (reason) => {
        // Arrange
        arrangeApi(basePreview);
        const original = state.fetchApi.getMockImplementation();
        state.fetchApi.mockImplementation(async (input: { path: string; method?: string }) => {
            if (input.method === 'POST')
                throw new ApiError('conflict', { status: 409, body: { error: { reason } } });
            return original?.(input);
        });
        renderSection();
        await openReview();
        const reads = (path: string) =>
            state.fetchApi.mock.calls.filter(
                ([call]) =>
                    (call as { path: string; method?: string }).path === path &&
                    !(call as { method?: string }).method
            ).length;
        const listBefore = reads(LIST_PATH);
        const previewBefore = reads(MP4_PATH);

        // Act
        fireEvent.click(screen.getByRole('button', { name: L.confirm }));

        // Assert
        await waitFor(() => expect(reads(LIST_PATH)).toBeGreaterThan(listBefore));
        await waitFor(() => expect(reads(MP4_PATH)).toBeGreaterThan(previewBefore));
    });

    it('N4: Confirm stays disabled when the confirmation could not be read', async () => {
        // Arrange
        arrangeApi(basePreview);
        const original = state.fetchApi.getMockImplementation();
        state.fetchApi.mockImplementation(async (input: { path: string; method?: string }) => {
            if (input.path === MP4_PATH && !input.method)
                throw new ApiError('conflict', {
                    status: 409,
                    body: { error: { reason: 'MANUAL_PAYMENT_NOT_DECLARED_UNPAID' } }
                });
            return original?.(input);
        });
        renderSection();

        // Act
        fireEvent.click(await screen.findByRole('button', { name: L.review }));

        // Assert
        expect(await screen.findByRole('alert')).toBeTruthy();
        expect(
            (screen.getByRole('button', { name: L.confirm }) as HTMLButtonElement).disabled
        ).toBe(true);
    });
});
