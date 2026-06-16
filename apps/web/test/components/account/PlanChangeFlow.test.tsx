/**
 * @file PlanChangeFlow.test.tsx
 * @description Tests for the SPEC-203 plan-change flow components:
 *   - PlanPicker (T-005)
 *   - DowngradePreviewPanel (T-007)
 *   - PlanChangeFlow (T-008, orchestrator)
 *   - SubscriptionDashboard "Change plan" button wiring (T-009)
 *
 * These tests cover:
 * - PlanPicker renders plans with current/upgrade/downgrade badges
 * - PlanPicker emits correct selection on button click
 * - DowngradePreviewPanel renders excess dimensions and default selections
 * - DowngradePreviewPanel builds KeepSelections and emits on confirm
 * - PlanChangeFlow: upgrade path → skips preview → calls changePlan
 * - PlanChangeFlow: downgrade with excess → calls previewDowngrade → shows preview
 * - PlanChangeFlow: downgrade without excess → skips preview → calls changePlan
 * - PlanChangeFlow handles `status: 'scheduled'` response → shows result step
 * - PlanChangeFlow handles `status: 'active'` response → shows result step
 * - PlanChangeFlow handles `status: 'pending_payment'` → redirects
 * - PlanChangeFlow handles API errors gracefully
 * - SubscriptionDashboard with plans prop shows "Change plan" button
 * - SubscriptionDashboard without plans prop shows upgrade link
 */

import type { DowngradePreview } from '@repo/schemas';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DowngradePreviewPanel } from '../../../src/components/account/DowngradePreviewPanel.client';
import { PlanChangeFlow } from '../../../src/components/account/PlanChangeFlow.client';
import { PlanPicker } from '../../../src/components/account/PlanPicker.client';
import {
    SubscriptionDashboard,
    type SubscriptionDashboardUser
} from '../../../src/components/account/SubscriptionDashboard.client';
import type { PublicPlanData } from '../../../src/lib/billing/fetch-plans';

// ─── CSS Module mocks ─────────────────────────────────────────────────────────

vi.mock('../../../src/components/account/PlanPicker.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, p) => String(p) })
}));

vi.mock('../../../src/components/account/DowngradePreviewPanel.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, p) => String(p) })
}));

vi.mock('../../../src/components/account/PlanChangeFlow.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, p) => String(p) })
}));

vi.mock('../../../src/components/account/SubscriptionDashboard.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, p) => String(p) })
}));

// ─── Icon mocks ───────────────────────────────────────────────────────────────

vi.mock('@repo/icons', () => ({
    CheckIcon: () => <span data-testid="icon-check" />,
    ArrowRightIcon: () => <span data-testid="icon-arrow-right" />,
    DownloadIcon: () => <span data-testid="icon-download" />,
    CancelIcon: () => <span data-testid="icon-cancel" />,
    PlayIcon: () => <span data-testid="icon-play" />,
    PowerOffIcon: () => <span data-testid="icon-power-off" />
}));

// ─── Env mocks ────────────────────────────────────────────────────────────────

vi.mock('../../../src/lib/env', () => ({
    getAdminUrl: vi.fn().mockReturnValue('http://localhost:3000'),
    getApiUrl: vi.fn().mockReturnValue('http://localhost:3001')
}));

vi.mock('@/lib/env', () => ({
    getAdminUrl: vi.fn().mockReturnValue('http://localhost:3000'),
    getApiUrl: vi.fn().mockReturnValue('http://localhost:3001')
}));

// ─── API mocks ────────────────────────────────────────────────────────────────

const mockGetSubscription = vi.fn();
const mockChangePlan = vi.fn();
const mockPreviewDowngrade = vi.fn();
const mockListInvoices = vi.fn();
const mockCancelSubscription = vi.fn();
const mockPauseSubscription = vi.fn();
const mockResumeSubscription = vi.fn();

vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    userApi: { getSubscription: () => mockGetSubscription() },
    billingApi: {
        listInvoices: () => mockListInvoices(),
        cancelSubscription: (...args: unknown[]) => mockCancelSubscription(...args),
        pauseSubscription: () => mockPauseSubscription(),
        resumeSubscription: () => mockResumeSubscription(),
        changePlan: (...args: unknown[]) => mockChangePlan(...args),
        previewDowngrade: (...args: unknown[]) => mockPreviewDowngrade(...args)
    }
}));

vi.mock('@/lib/api/endpoints-protected', () => ({
    userApi: { getSubscription: () => mockGetSubscription() },
    billingApi: {
        listInvoices: () => mockListInvoices(),
        cancelSubscription: (...args: unknown[]) => mockCancelSubscription(...args),
        pauseSubscription: () => mockPauseSubscription(),
        resumeSubscription: () => mockResumeSubscription(),
        changePlan: (...args: unknown[]) => mockChangePlan(...args),
        previewDowngrade: (...args: unknown[]) => mockPreviewDowngrade(...args)
    }
}));

// ─── Toast mock ───────────────────────────────────────────────────────────────

vi.mock('../../../src/store/toast-store', () => ({
    addToast: vi.fn()
}));

vi.mock('@/store/toast-store', () => ({
    addToast: vi.fn()
}));

// ─── format-utils mock ────────────────────────────────────────────────────────

vi.mock('../../../src/lib/format-utils', () => ({
    formatDate: ({ date }: { date: string }) => `date:${date.slice(0, 10)}`
}));

vi.mock('@/lib/format-utils', () => ({
    formatDate: ({ date }: { date: string }) => `date:${date.slice(0, 10)}`
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASIC_PLAN: PublicPlanData = {
    id: 'plan-basic-id',
    slug: 'owner-basico',
    name: 'Básico',
    description: 'Plan básico',
    category: 'owner',
    monthlyPriceArs: 100000,
    annualPriceArs: null,
    monthlyPriceUsdRef: 10,
    hasTrial: false,
    trialDays: 0,
    isDefault: false,
    sortOrder: 1,
    isActive: true,
    entitlements: ['CAN_PUBLISH_ACCOMMODATION'],
    limits: { MAX_ACCOMMODATIONS: 1 },
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z'
};

const PRO_PLAN: PublicPlanData = {
    id: 'plan-pro-id',
    slug: 'owner-pro',
    name: 'Pro',
    description: 'Plan profesional',
    category: 'owner',
    monthlyPriceArs: 300000,
    annualPriceArs: 3000000,
    monthlyPriceUsdRef: 30,
    hasTrial: false,
    trialDays: 0,
    isDefault: false,
    sortOrder: 3,
    isActive: true,
    entitlements: ['CAN_PUBLISH_ACCOMMODATION', 'CAN_USE_RICH_DESCRIPTION'],
    limits: { MAX_ACCOMMODATIONS: 10 },
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z'
};

const PLANS: readonly PublicPlanData[] = [BASIC_PLAN, PRO_PLAN];

const EMPTY_DOWNGRADE_PREVIEW: DowngradePreview = {
    accommodations: { cap: 1, activeCount: 1, excessCount: 0, items: [] },
    promotions: { cap: 0, activeCount: 0, excessCount: 0, items: [] },
    photos: [],
    grandfatherFlags: [],
    hasExcess: false
};

const EXCESS_DOWNGRADE_PREVIEW: DowngradePreview = {
    accommodations: {
        cap: 1,
        activeCount: 3,
        excessCount: 2,
        items: [
            {
                id: 'acc-1',
                name: 'Casa en la playa',
                updatedAt: '2025-06-01T00:00:00Z',
                viewCount: 100,
                keepByDefault: true
            },
            {
                id: 'acc-2',
                name: 'Cabaña del lago',
                updatedAt: '2025-05-01T00:00:00Z',
                viewCount: 50,
                keepByDefault: false
            },
            {
                id: 'acc-3',
                name: 'Departamento céntrico',
                updatedAt: '2025-04-01T00:00:00Z',
                viewCount: 10,
                keepByDefault: false
            }
        ]
    },
    promotions: { cap: 0, activeCount: 0, excessCount: 0, items: [] },
    photos: [],
    grandfatherFlags: [],
    hasExcess: true
};

const ACTIVE_SUBSCRIPTION = {
    id: 'sub-uuid-1',
    planSlug: 'owner-pro',
    planName: 'Plan Pro',
    status: 'active' as const,
    currentPeriodStart: '2026-04-01T00:00:00Z',
    currentPeriodEnd: '2026-05-01T00:00:00Z',
    cancelAtPeriodEnd: false,
    trialEndsAt: null,
    monthlyPriceArs: 300000,
    paymentMethod: null
};

const USER: SubscriptionDashboardUser = { id: 'user-1', role: 'HOST' };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockDashboardSubscriptionSuccess() {
    mockGetSubscription.mockResolvedValue({
        ok: true,
        data: { subscription: ACTIVE_SUBSCRIPTION }
    });
    mockListInvoices.mockResolvedValue({
        ok: true,
        data: { items: [], pagination: { page: 1, pageSize: 1, total: 0, totalPages: 0 } }
    });
}

// ─── PlanPicker tests ─────────────────────────────────────────────────────────

describe('PlanPicker', () => {
    const onSelect = vi.fn();
    const onDismiss = vi.fn();

    beforeEach(() => {
        onSelect.mockClear();
        onDismiss.mockClear();
    });

    it('renders all plans in the list', () => {
        render(
            <PlanPicker
                plans={PLANS}
                currentPlanSlug="owner-pro"
                locale="es"
                onSelect={onSelect}
                onDismiss={onDismiss}
            />
        );
        expect(screen.getByText('Básico')).toBeInTheDocument();
        expect(screen.getByText('Pro')).toBeInTheDocument();
    });

    it('marks the current plan with a "current" badge', () => {
        render(
            <PlanPicker
                plans={PLANS}
                currentPlanSlug="owner-pro"
                locale="es"
                onSelect={onSelect}
                onDismiss={onDismiss}
            />
        );
        expect(screen.getByText('Plan actual')).toBeInTheDocument();
    });

    it('shows "Reducción" badge for a lower-tier plan', () => {
        render(
            <PlanPicker
                plans={PLANS}
                currentPlanSlug="owner-pro"
                locale="es"
                onSelect={onSelect}
                onDismiss={onDismiss}
            />
        );
        expect(screen.getByText('Reducción')).toBeInTheDocument();
    });

    it('shows "Mejora" badge for a higher-tier plan', () => {
        render(
            <PlanPicker
                plans={PLANS}
                currentPlanSlug="owner-basico"
                locale="es"
                onSelect={onSelect}
                onDismiss={onDismiss}
            />
        );
        expect(screen.getByText('Mejora')).toBeInTheDocument();
    });

    it('does not render action buttons for the current plan', () => {
        render(
            <PlanPicker
                plans={PLANS}
                currentPlanSlug="owner-pro"
                locale="es"
                onSelect={onSelect}
                onDismiss={onDismiss}
            />
        );
        // There should only be one "Mensual" button (for Básico), not two
        const mensualBtns = screen.getAllByRole('button', { name: /mensual/i });
        expect(mensualBtns).toHaveLength(1);
    });

    it('calls onSelect with monthly interval when "Mensual" clicked', () => {
        render(
            <PlanPicker
                plans={PLANS}
                currentPlanSlug="owner-pro"
                locale="es"
                onSelect={onSelect}
                onDismiss={onDismiss}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /mensual/i }));
        expect(onSelect).toHaveBeenCalledWith(
            expect.objectContaining({
                planId: 'plan-basic-id',
                billingInterval: 'monthly',
                direction: 'downgrade'
            })
        );
    });

    it('shows annual button only for plans with annual price', () => {
        render(
            <PlanPicker
                plans={PLANS}
                currentPlanSlug="owner-pro"
                locale="es"
                onSelect={onSelect}
                onDismiss={onDismiss}
            />
        );
        // Básico has no annual price → no "Anual" button should appear
        const annualBtns = screen.queryAllByRole('button', { name: /anual/i });
        expect(annualBtns).toHaveLength(0);
    });

    it('shows annual button for plans with annual price', () => {
        // Pro has annual price; but Pro is the current plan here so it has no buttons
        // Give Básico an annual price and make it the upgrade
        const basicWithAnnual: PublicPlanData = {
            ...BASIC_PLAN,
            annualPriceArs: 1000000
        };
        render(
            <PlanPicker
                plans={[basicWithAnnual, PRO_PLAN]}
                currentPlanSlug="owner-pro"
                locale="es"
                onSelect={onSelect}
                onDismiss={onDismiss}
            />
        );
        // Básico is downgrade — has annual price → "Anual" button
        expect(screen.getByRole('button', { name: /anual/i })).toBeInTheDocument();
    });

    it('calls onSelect with annual interval when "Anual" clicked', () => {
        const basicWithAnnual: PublicPlanData = {
            ...BASIC_PLAN,
            annualPriceArs: 1000000
        };
        render(
            <PlanPicker
                plans={[basicWithAnnual, PRO_PLAN]}
                currentPlanSlug="owner-pro"
                locale="es"
                onSelect={onSelect}
                onDismiss={onDismiss}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /anual/i }));
        expect(onSelect).toHaveBeenCalledWith(
            expect.objectContaining({
                planId: 'plan-basic-id',
                billingInterval: 'annual',
                direction: 'downgrade'
            })
        );
    });

    it('calls onDismiss when cancel button is clicked', () => {
        render(
            <PlanPicker
                plans={PLANS}
                currentPlanSlug="owner-pro"
                locale="es"
                onSelect={onSelect}
                onDismiss={onDismiss}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('renders with dialog role for accessibility', () => {
        render(
            <PlanPicker
                plans={PLANS}
                currentPlanSlug="owner-pro"
                locale="es"
                onSelect={onSelect}
                onDismiss={onDismiss}
            />
        );
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
});

// ─── DowngradePreviewPanel tests ──────────────────────────────────────────────

describe('DowngradePreviewPanel', () => {
    const onConfirm = vi.fn();
    const onBack = vi.fn();

    beforeEach(() => {
        onConfirm.mockClear();
        onBack.mockClear();
    });

    it('renders accommodation excess section when excessCount > 0', () => {
        render(
            <DowngradePreviewPanel
                preview={EXCESS_DOWNGRADE_PREVIEW}
                targetPlanName="Básico"
                locale="es"
                onConfirm={onConfirm}
                onBack={onBack}
                isPending={false}
            />
        );
        expect(screen.getByText('Casa en la playa')).toBeInTheDocument();
        expect(screen.getByText('Cabaña del lago')).toBeInTheDocument();
    });

    it('defaults keepByDefault items as checked', () => {
        render(
            <DowngradePreviewPanel
                preview={EXCESS_DOWNGRADE_PREVIEW}
                targetPlanName="Básico"
                locale="es"
                onConfirm={onConfirm}
                onBack={onBack}
                isPending={false}
            />
        );
        // "Casa en la playa" has keepByDefault: true → checked
        const checkboxes = screen.getAllByRole('checkbox');
        // First item (Casa en la playa) should be checked
        expect(checkboxes[0]).toBeChecked();
        // Second item (Cabaña del lago) should NOT be checked
        expect(checkboxes[1]).not.toBeChecked();
    });

    it('toggling a checkbox changes selection', () => {
        render(
            <DowngradePreviewPanel
                preview={EXCESS_DOWNGRADE_PREVIEW}
                targetPlanName="Básico"
                locale="es"
                onConfirm={onConfirm}
                onBack={onBack}
                isPending={false}
            />
        );
        const checkboxes = screen.getAllByRole('checkbox');
        // Click the second checkbox (Cabaña del lago — currently unchecked)
        fireEvent.click(checkboxes[1]);
        expect(checkboxes[1]).toBeChecked();
    });

    it('shows over-cap warning when more than cap items are selected', () => {
        render(
            <DowngradePreviewPanel
                preview={EXCESS_DOWNGRADE_PREVIEW}
                targetPlanName="Básico"
                locale="es"
                onConfirm={onConfirm}
                onBack={onBack}
                isPending={false}
            />
        );
        const checkboxes = screen.getAllByRole('checkbox');
        // Select 2nd and 3rd items (cap is 1, so selecting 2 total triggers warning)
        fireEvent.click(checkboxes[1]); // now 2 selected
        // Over-cap warning should appear (role=alert)
        expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    });

    it('confirm button is disabled when over cap', () => {
        render(
            <DowngradePreviewPanel
                preview={EXCESS_DOWNGRADE_PREVIEW}
                targetPlanName="Básico"
                locale="es"
                onConfirm={onConfirm}
                onBack={onBack}
                isPending={false}
            />
        );
        const checkboxes = screen.getAllByRole('checkbox');
        fireEvent.click(checkboxes[1]); // now 2 selected, cap is 1
        const confirmBtn = screen.getByRole('button', { name: /continuar/i });
        expect(confirmBtn).toBeDisabled();
    });

    it('calls onConfirm with accommodationIds in keepSelections', () => {
        render(
            <DowngradePreviewPanel
                preview={EXCESS_DOWNGRADE_PREVIEW}
                targetPlanName="Básico"
                locale="es"
                onConfirm={onConfirm}
                onBack={onBack}
                isPending={false}
            />
        );
        // Default: acc-1 is checked (keepByDefault)
        fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
        expect(onConfirm).toHaveBeenCalledWith(
            expect.objectContaining({
                accommodationIds: expect.arrayContaining(['acc-1'])
            })
        );
    });

    it('calls onBack when back button is clicked', () => {
        render(
            <DowngradePreviewPanel
                preview={EXCESS_DOWNGRADE_PREVIEW}
                targetPlanName="Básico"
                locale="es"
                onConfirm={onConfirm}
                onBack={onBack}
                isPending={false}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /volver/i }));
        expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('disables buttons when isPending is true', () => {
        render(
            <DowngradePreviewPanel
                preview={EXCESS_DOWNGRADE_PREVIEW}
                targetPlanName="Básico"
                locale="es"
                onConfirm={onConfirm}
                onBack={onBack}
                isPending={true}
            />
        );
        expect(screen.getByRole('button', { name: /volver/i })).toBeDisabled();
    });

    it('shows "Sugerido" badge next to keepByDefault items', () => {
        render(
            <DowngradePreviewPanel
                preview={EXCESS_DOWNGRADE_PREVIEW}
                targetPlanName="Básico"
                locale="es"
                onConfirm={onConfirm}
                onBack={onBack}
                isPending={false}
            />
        );
        expect(screen.getByText('Sugerido')).toBeInTheDocument();
    });
});

// ─── PlanChangeFlow tests ─────────────────────────────────────────────────────

describe('PlanChangeFlow', () => {
    const onChanged = vi.fn();
    const onDismiss = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        onChanged.mockClear();
        onDismiss.mockClear();
    });

    function renderFlow({ currentSlug = 'owner-pro' } = {}) {
        return render(
            <PlanChangeFlow
                plans={PLANS}
                currentPlanSlug={currentSlug}
                locale="es"
                onChanged={onChanged}
                onDismiss={onDismiss}
            />
        );
    }

    it('opens with the plan picker step', () => {
        renderFlow();
        expect(screen.getByRole('dialog', { name: /cambiar plan/i })).toBeInTheDocument();
        expect(screen.getByText('Básico')).toBeInTheDocument();
    });

    it('upgrade path: calls changePlan directly (skips preview)', async () => {
        mockChangePlan.mockResolvedValue({
            ok: true,
            data: {
                status: 'active',
                subscriptionId: 'sub-1',
                previousPlanId: 'plan-basic-id',
                newPlanId: 'plan-pro-id',
                effectiveAt: '2026-05-01T00:00:00Z'
            }
        });

        renderFlow({ currentSlug: 'owner-basico' });

        // Click "Mensual" for Pro plan (upgrade)
        fireEvent.click(screen.getByRole('button', { name: /mensual/i }));

        await waitFor(() => {
            expect(mockChangePlan).toHaveBeenCalledWith(
                expect.objectContaining({ newPlanId: 'plan-pro-id', billingInterval: 'monthly' })
            );
        });

        // Should NOT call previewDowngrade for upgrades
        expect(mockPreviewDowngrade).not.toHaveBeenCalled();
    });

    it('downgrade with excess: calls previewDowngrade and shows preview step', async () => {
        mockPreviewDowngrade.mockResolvedValue({
            ok: true,
            data: EXCESS_DOWNGRADE_PREVIEW
        });

        renderFlow({ currentSlug: 'owner-pro' });

        // Click "Mensual" for Básico (downgrade)
        fireEvent.click(screen.getByRole('button', { name: /mensual/i }));

        await waitFor(() => {
            expect(mockPreviewDowngrade).toHaveBeenCalledWith(
                expect.objectContaining({ targetPlan: 'owner-basico' })
            );
        });

        // Should show downgrade preview step
        await waitFor(() => {
            expect(
                screen.getByRole('dialog', {
                    name: /revisá los cambios/i
                })
            ).toBeInTheDocument();
        });
    });

    it('downgrade without excess: skips preview and calls changePlan directly', async () => {
        mockPreviewDowngrade.mockResolvedValue({
            ok: true,
            data: EMPTY_DOWNGRADE_PREVIEW
        });
        mockChangePlan.mockResolvedValue({
            ok: true,
            data: {
                status: 'scheduled',
                subscriptionId: 'sub-1',
                previousPlanId: 'plan-pro-id',
                newPlanId: 'plan-basic-id',
                effectiveAt: '2026-05-01T00:00:00Z'
            }
        });

        renderFlow({ currentSlug: 'owner-pro' });

        fireEvent.click(screen.getByRole('button', { name: /mensual/i }));

        await waitFor(() => {
            expect(mockChangePlan).toHaveBeenCalled();
        });

        // Should not show preview step (no excess)
        expect(
            screen.queryByRole('dialog', { name: /revisá los cambios/i })
        ).not.toBeInTheDocument();
    });

    it('handles status: scheduled — shows success result step', async () => {
        mockPreviewDowngrade.mockResolvedValue({
            ok: true,
            data: EMPTY_DOWNGRADE_PREVIEW
        });
        mockChangePlan.mockResolvedValue({
            ok: true,
            data: {
                status: 'scheduled',
                subscriptionId: 'sub-1',
                previousPlanId: 'plan-pro-id',
                newPlanId: 'plan-basic-id',
                effectiveAt: '2026-05-01T00:00:00Z'
            }
        });

        renderFlow({ currentSlug: 'owner-pro' });
        fireEvent.click(screen.getByRole('button', { name: /mensual/i }));

        await waitFor(() => {
            expect(screen.getByText(/cambio programado/i)).toBeInTheDocument();
        });
    });

    it('handles status: active — shows "plan actualizado" result', async () => {
        mockChangePlan.mockResolvedValue({
            ok: true,
            data: {
                status: 'active',
                subscriptionId: 'sub-1',
                previousPlanId: 'plan-basic-id',
                newPlanId: 'plan-pro-id',
                effectiveAt: '2026-05-01T00:00:00Z'
            }
        });

        renderFlow({ currentSlug: 'owner-basico' });
        fireEvent.click(screen.getByRole('button', { name: /mensual/i }));

        await waitFor(() => {
            expect(screen.getByText(/plan actualizado/i)).toBeInTheDocument();
        });
    });

    it('handles status: pending_payment — redirects to checkoutUrl', async () => {
        const originalLocation = window.location;
        const win = window as unknown as Record<string, unknown>;
        win.location = undefined;
        window.location = { ...originalLocation, href: '' };

        mockChangePlan.mockResolvedValue({
            ok: true,
            data: {
                status: 'pending_payment',
                checkoutUrl: 'https://mp.example.com/checkout/123',
                localSubscriptionId: 'sub-1',
                expiresAt: '2026-06-01T00:00:00Z',
                newPlanId: 'plan-pro-id',
                deltaCentavos: 200000
            }
        });

        renderFlow({ currentSlug: 'owner-basico' });
        fireEvent.click(screen.getByRole('button', { name: /mensual/i }));

        await waitFor(() => {
            expect(window.location.href).toBe('https://mp.example.com/checkout/123');
        });

        window.location = originalLocation;
    });

    it('shows error message and retry on changePlan API failure', async () => {
        mockChangePlan.mockResolvedValue({
            ok: false,
            error: { status: 500, message: 'Server error' }
        });

        renderFlow({ currentSlug: 'owner-basico' });
        fireEvent.click(screen.getByRole('button', { name: /mensual/i }));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });

        expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
    });

    it('shows error and retry when previewDowngrade API fails', async () => {
        mockPreviewDowngrade.mockResolvedValue({
            ok: false,
            error: { status: 500, message: 'Server error' }
        });

        renderFlow({ currentSlug: 'owner-pro' });
        fireEvent.click(screen.getByRole('button', { name: /mensual/i }));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
    });

    it('calls onChanged after a successful active/scheduled change', async () => {
        mockChangePlan.mockResolvedValue({
            ok: true,
            data: {
                status: 'active',
                subscriptionId: 'sub-1',
                previousPlanId: 'plan-basic-id',
                newPlanId: 'plan-pro-id',
                effectiveAt: '2026-05-01T00:00:00Z'
            }
        });

        renderFlow({ currentSlug: 'owner-basico' });
        fireEvent.click(screen.getByRole('button', { name: /mensual/i }));

        await waitFor(() => {
            expect(onChanged).toHaveBeenCalledTimes(1);
        });
    });

    it('dismisses on Escape key press', async () => {
        renderFlow();
        fireEvent.keyDown(document, { key: 'Escape' });
        await waitFor(() => {
            expect(onDismiss).toHaveBeenCalledTimes(1);
        });
    });

    it('goes back from preview step to picker step', async () => {
        mockPreviewDowngrade.mockResolvedValue({
            ok: true,
            data: EXCESS_DOWNGRADE_PREVIEW
        });

        renderFlow({ currentSlug: 'owner-pro' });
        fireEvent.click(screen.getByRole('button', { name: /mensual/i }));

        await waitFor(() => {
            expect(screen.getByText('Casa en la playa')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /volver/i }));

        await waitFor(() => {
            expect(screen.getByText('Básico')).toBeInTheDocument();
        });
    });
});

// ─── SubscriptionDashboard T-009 wiring tests ─────────────────────────────────

describe('SubscriptionDashboard — plan-change flow wiring (T-009)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCancelSubscription.mockResolvedValue({ ok: true, data: {} });
        mockPauseSubscription.mockResolvedValue({ ok: true, data: {} });
        mockResumeSubscription.mockResolvedValue({ ok: true, data: {} });
    });

    it('shows "Cambiar plan" button when plans prop is provided', async () => {
        mockDashboardSubscriptionSuccess();

        render(
            <SubscriptionDashboard
                locale="es"
                user={USER}
                plans={PLANS}
            />
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /cambiar plan/i })).toBeInTheDocument();
        });
    });

    it('shows plain upgrade link when plans prop is absent', async () => {
        mockDashboardSubscriptionSuccess();

        render(
            <SubscriptionDashboard
                locale="es"
                user={USER}
            />
        );

        await waitFor(() => {
            expect(
                screen.getByRole('link', { name: /ver planes disponibles/i })
            ).toBeInTheDocument();
        });

        expect(screen.queryByRole('button', { name: /cambiar plan/i })).not.toBeInTheDocument();
    });

    it('opens PlanChangeFlow modal when "Cambiar plan" is clicked', async () => {
        mockDashboardSubscriptionSuccess();

        render(
            <SubscriptionDashboard
                locale="es"
                user={USER}
                plans={PLANS}
            />
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /cambiar plan/i })).toBeInTheDocument();
        });

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /cambiar plan/i }));
        });

        // PlanChangeFlow renders a dialog with plan names
        await waitFor(() => {
            expect(screen.getByText('Básico')).toBeInTheDocument();
        });
    });

    it('re-fetches subscription after successful plan change (onChanged callback)', async () => {
        mockDashboardSubscriptionSuccess();
        mockChangePlan.mockResolvedValue({
            ok: true,
            data: {
                status: 'active',
                subscriptionId: 'sub-uuid-1',
                previousPlanId: 'plan-pro-id',
                newPlanId: 'plan-basic-id',
                effectiveAt: '2026-05-01T00:00:00Z'
            }
        });

        render(
            <SubscriptionDashboard
                locale="es"
                user={USER}
                plans={PLANS}
            />
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /cambiar plan/i })).toBeInTheDocument();
        });

        const callsBefore = mockGetSubscription.mock.calls.length;

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /cambiar plan/i }));
        });

        // Click upgrade (Pro → Básico — but current is owner-pro, so Básico is downgrade)
        // Wait for the picker to appear
        await waitFor(() => {
            expect(screen.getByText('Básico')).toBeInTheDocument();
        });

        // Need preview to have no excess (so it goes straight to changePlan)
        mockPreviewDowngrade.mockResolvedValue({
            ok: true,
            data: EMPTY_DOWNGRADE_PREVIEW
        });

        await act(async () => {
            fireEvent.click(screen.getAllByRole('button', { name: /mensual/i })[0]);
        });

        await waitFor(() => {
            expect(mockGetSubscription.mock.calls.length).toBeGreaterThan(callsBefore);
        });
    });
});
