/**
 * @file PlanEntitlementGate.test.tsx
 * @description Regression test (HOS-1809): the default locked state must show
 * upgrade copy that matches the gated entitlement, not always the
 * rich-description copy.
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanEntitlementGate } from '@/components/host/editor/PlanEntitlementGate.client';

const { mockHas } = vi.hoisted(() => ({ mockHas: vi.fn() }));

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (key: string) => key
    })
}));

vi.mock('@/hooks/useMyEntitlements', () => ({
    useMyEntitlements: () => ({
        has: mockHas,
        limit: () => -1,
        plan: null,
        isLoading: false,
        error: null
    })
}));

vi.mock('@/components/host/editor/PlanEntitlementGate.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

describe('PlanEntitlementGate default fallback copy', () => {
    beforeEach(() => {
        mockHas.mockReset();
        mockHas.mockReturnValue(false);
    });

    it('shows calendar upgrade copy for can_use_calendar', () => {
        // Arrange + Act
        render(
            <PlanEntitlementGate entitlementKey="can_use_calendar">
                <span>children</span>
            </PlanEntitlementGate>
        );

        // Assert
        expect(screen.getByText('host.properties.editor.entitlement.calendarNudge')).toBeTruthy();
        expect(
            screen.queryByText('host.properties.editor.entitlement.richDescriptionNudge')
        ).toBeNull();
    });

    it('keeps rich-description copy for can_use_rich_description', () => {
        render(
            <PlanEntitlementGate entitlementKey="can_use_rich_description">
                <span>children</span>
            </PlanEntitlementGate>
        );

        expect(
            screen.getByText('host.properties.editor.entitlement.richDescriptionNudge')
        ).toBeTruthy();
    });

    it('falls back to generic copy for an unmapped entitlement', () => {
        render(
            <PlanEntitlementGate entitlementKey="something_else">
                <span>children</span>
            </PlanEntitlementGate>
        );

        expect(screen.getByText('host.properties.editor.entitlement.genericNudge')).toBeTruthy();
    });

    it('renders children when the entitlement is present', () => {
        mockHas.mockReturnValue(true);

        render(
            <PlanEntitlementGate entitlementKey="can_use_calendar">
                <span>children</span>
            </PlanEntitlementGate>
        );

        expect(screen.getByText('children')).toBeTruthy();
    });
});
