/**
 * @file HostPlanStatCard.test.tsx
 * @description The host dashboard's «Plan» KPI card (HOS-2664, D13): plan name
 * from the catalog map, ONE next-step line from the real subscription/trial
 * reads, and «—» plus retry (never a fabricated value) when the read fails.
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const getStats = vi.fn();
const trialSummary = vi.fn();
const listMine = vi.fn();

vi.mock('@/lib/api/endpoints-protected', () => ({
    get userApi() {
        return { getStats };
    },
    get publishApi() {
        return { trialSummary };
    },
    get billingSubscriptionApi() {
        return { listMine };
    }
}));

import { HostPlanStatCard } from '../../../../src/components/account/dashboard/HostPlanStatCard.client';

const card = (container: HTMLElement) =>
    container.querySelector('[data-widget="hostPlan"]') as HTMLElement;

afterEach(() => {
    vi.clearAllMocks();
});

describe('HostPlanStatCard (HOS-2664)', () => {
    it('names the plan from the catalog map and links to the subscription', async () => {
        getStats.mockResolvedValue({
            ok: true,
            data: {
                bookmarkCount: 0,
                plan: { slug: 'owner-pro', name: 'owner-pro', status: 'ACTIVE' },
                activeSubscriptionsCount: 1
            }
        });
        listMine.mockResolvedValue({
            ok: true,
            data: {
                subscriptions: [
                    {
                        vertical: 'accommodation',
                        status: 'ACTIVE',
                        serviceEndsAt: null,
                        graceEndsAt: null,
                        nextCharge: {
                            at: new Date(Date.now() + 3 * 86_400_000 - 60_000).toISOString(),
                            amount: 1,
                            currency: 'ARS'
                        }
                    }
                ]
            }
        });
        const { container } = render(
            <HostPlanStatCard
                locale="es"
                planNames={{ 'owner-pro': 'Plan Fixture Pro' }}
            />
        );
        await waitFor(() => expect(card(container)).toHaveAttribute('data-state', 'ready'));
        expect(within(card(container)).getByText('Plan Fixture Pro')).toBeInTheDocument();
        expect(card(container).querySelector('a[href*="mi-cuenta/suscripcion"]')).not.toBeNull();
        expect(trialSummary).not.toHaveBeenCalled();
        expect(card(container).textContent ?? '').toContain('Tu próximo cobro es en 3 días.');
    });

    it('keeps the plan line when the subscription rows cannot be read', async () => {
        getStats.mockResolvedValue({
            ok: true,
            data: {
                bookmarkCount: 0,
                plan: { slug: 'owner-pro', name: 'owner-pro', status: 'ACTIVE' },
                activeSubscriptionsCount: 1
            }
        });
        listMine.mockRejectedValue(new Error('boom'));
        const { container } = render(
            <HostPlanStatCard
                locale="es"
                planNames={{ 'owner-pro': 'Plan Fixture Pro' }}
            />
        );
        await waitFor(() => expect(card(container)).toHaveAttribute('data-state', 'ready'));
        expect(within(card(container)).getByText('Plan Fixture Pro')).toBeInTheDocument();
    });

    it('counts the trial days left from the real trial summary when there is no paid plan', async () => {
        getStats.mockResolvedValue({
            ok: true,
            data: { bookmarkCount: 0, plan: null, activeSubscriptionsCount: 0 }
        });
        const endsAt = new Date(Date.now() + 5 * 86_400_000 - 60_000).toISOString();
        trialSummary.mockImplementation(({ vertical }: { vertical: string }) =>
            Promise.resolve(
                vertical === 'accommodation'
                    ? {
                          ok: true,
                          data: {
                              status: 'TRIAL_ACTIVE',
                              startedAt: null,
                              endsAt,
                              totalDays: 14,
                              origins: { base: 14, promo: 0, support: 0 }
                          }
                      }
                    : { ok: false }
            )
        );
        const { container } = render(
            <HostPlanStatCard
                locale="es"
                planNames={{}}
            />
        );
        await waitFor(() => expect(card(container)).toHaveAttribute('data-state', 'ready'));
        expect(trialSummary).toHaveBeenCalled();
        expect(card(container).textContent ?? '').toContain('Tu prueba termina en 5 días.');
    });

    it('shows the error state with retry, never a value, when the read fails', async () => {
        getStats.mockResolvedValue({ ok: false });
        const { container } = render(
            <HostPlanStatCard
                locale="es"
                planNames={{}}
            />
        );
        await screen.findByRole('button', { name: /reintentar/i });
        expect(card(container)).toHaveAttribute('data-state', 'error');
    });
});
