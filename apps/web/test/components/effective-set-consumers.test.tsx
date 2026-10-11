import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CalendarSyncLauncher } from '@/components/host/editor/CalendarSyncLauncher.client';
import { PlanEntitlementGate } from '@/components/host/editor/PlanEntitlementGate.client';
import {
    MAX_PHOTOS_LIMIT_KEY,
    resolveEffectiveGalleryCap
} from '@/components/host/editor/photo-section-helpers';
import { evaluateCompareAdd, useCompareGuard } from '@/hooks/useCompareGuard';
import { useMyEntitlements } from '@/hooks/useMyEntitlements';
import { clearCompare } from '@/store/compare-store';

const state = vi.hoisted(() => ({
    response: {
        entitlements: {} as Record<string, number>,
        limits: {} as Record<string, number>,
        hasLiveNonTrialTitle: false,
        failed: false
    },
    session: { data: { user: { id: 'owner-1' } }, isPending: false }
}));

vi.mock('@/lib/auth-client', () => ({ useSession: () => state.session }));
vi.mock('@/lib/entitlements-cache', () => ({
    getEntitlementsCached: vi.fn(async () => state.response),
    clearEntitlementsCache: vi.fn()
}));
vi.mock('@/lib/i18n', () => ({
    createTranslations: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key })
}));
vi.mock('@/components/host/editor/CalendarSyncPanel.client', () => ({
    CalendarSyncPanel: () => <div data-testid="sync-panel">panel</div>
}));

const effectiveSet = (entitlements: Record<string, number>, limits: Record<string, number>) => ({
    entitlements,
    limits,
    hasLiveNonTrialTitle: true,
    failed: false
});

describe('TEST:B13a:25 effective-set consumers', () => {
    beforeEach(() => {
        state.response = effectiveSet({}, {});
        state.session = { data: { user: { id: 'owner-1' } }, isPending: false };
        act(() => clearCompare());
    });

    it('PlanEntitlementGate opens and closes from distinct effective keys', async () => {
        state.response = effectiveSet({ rich_description: 1 }, {});
        const first = render(
            <PlanEntitlementGate
                entitlementKey="rich_description"
                fallback={<span>upgrade</span>}
            >
                <span>paid feature</span>
            </PlanEntitlementGate>
        );
        expect(await screen.findByText('paid feature')).toBeInTheDocument();
        first.unmount();
        state.response = effectiveSet({}, {});
        const second = render(
            <PlanEntitlementGate
                entitlementKey="rich_description"
                fallback={<span>upgrade</span>}
            >
                <span>paid feature</span>
            </PlanEntitlementGate>
        );
        await waitFor(() => expect(screen.queryByText('paid feature')).not.toBeInTheDocument());
        expect(screen.getByText('upgrade')).toBeInTheDocument();
        second.unmount();
        state.response = { ...effectiveSet({}, {}), failed: true };
        render(
            <PlanEntitlementGate
                entitlementKey="rich_description"
                fallback={<span>upgrade after failure</span>}
            >
                <span>paid feature after failure</span>
            </PlanEntitlementGate>
        );
        expect(await screen.findByText('upgrade after failure')).toBeInTheDocument();
        expect(screen.queryByText('paid feature after failure')).not.toBeInTheDocument();
    });

    it('CalendarSyncLauncher opens only with the key and upsells when absent or failed', async () => {
        const user = (await import('@testing-library/user-event')).default.setup();
        state.response = effectiveSet({ can_sync_external_calendar: 1 }, {});
        const first = render(
            <CalendarSyncLauncher
                locale="es"
                accommodationId="acc-1"
            />
        );
        await user.click(screen.getByRole('button', { name: /Conectar calendarios externos/ }));
        expect(await screen.findByTestId('sync-panel')).toBeInTheDocument();
        first.unmount();
        state.response = effectiveSet({}, {});
        const second = render(
            <CalendarSyncLauncher
                locale="es"
                accommodationId="acc-1"
            />
        );
        await user.click(screen.getByRole('button', { name: /Conectar calendarios externos/ }));
        expect(await screen.findByText('Función premium')).toBeInTheDocument();
        expect(screen.queryByTestId('sync-panel')).not.toBeInTheDocument();
        second.unmount();
        state.response = { ...effectiveSet({}, {}), failed: true };
        render(
            <CalendarSyncLauncher
                locale="es"
                accommodationId="acc-1"
            />
        );
        await user.click(screen.getByRole('button', { name: /Conectar calendarios externos/ }));
        expect(await screen.findByText('Función premium')).toBeInTheDocument();
        expect(screen.queryByTestId('sync-panel')).not.toBeInTheDocument();
    });

    it('PhotoSection resolves catalog caps 5 and 15, but not a failed read', async () => {
        const createResult = () =>
            renderHook(() => {
                const entitlements = useMyEntitlements({ vertical: 'accommodation' });
                return resolveEffectiveGalleryCap({
                    planLimit: entitlements.limit(MAX_PHOTOS_LIMIT_KEY),
                    isEntitlementsLoading: entitlements.isLoading
                });
            });
        state.response = effectiveSet({}, { [MAX_PHOTOS_LIMIT_KEY]: 5 });
        let { result, unmount } = createResult();
        await waitFor(() => expect(result.current).toEqual({ cap: 5, isResolved: true }));
        unmount();
        state.response = effectiveSet({}, { [MAX_PHOTOS_LIMIT_KEY]: 15 });
        ({ result, unmount } = createResult());
        await waitFor(() => expect(result.current).toEqual({ cap: 15, isResolved: true }));
        unmount();
        state.response = { ...effectiveSet({}, {}), failed: true };
        ({ result } = createResult());
        await waitFor(() => expect(result.current.isResolved).toBe(false));
    });

    it('useCompareGuard applies effective entitlement and limits 3 and 5; failed reads upsell', async () => {
        state.response = effectiveSet({ can_compare_accommodations: 1 }, { max_compare_items: 3 });
        let { result, unmount } = renderHook(() => useCompareGuard());
        await waitFor(() => expect(result.current.maxItems).toBe(3));
        expect(
            evaluateCompareAdd({
                canCompare: result.current.canCompare,
                maxItems: result.current.maxItems,
                currentCount: 2
            })
        ).toEqual({ allowed: true, reason: null });
        unmount();
        state.response = effectiveSet({ can_compare_accommodations: 1 }, { max_compare_items: 5 });
        ({ result, unmount } = renderHook(() => useCompareGuard()));
        await waitFor(() => expect(result.current.maxItems).toBe(5));
        expect(
            evaluateCompareAdd({
                canCompare: result.current.canCompare,
                maxItems: result.current.maxItems,
                currentCount: 4
            })
        ).toEqual({ allowed: true, reason: null });
        unmount();
        state.response = { ...effectiveSet({}, {}), failed: true };
        ({ result } = renderHook(() => useCompareGuard()));
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(
            evaluateCompareAdd({
                canCompare: result.current.canCompare,
                maxItems: result.current.maxItems,
                currentCount: 0
            })
        ).toEqual({ allowed: false, reason: 'upsell' });
    });
});
