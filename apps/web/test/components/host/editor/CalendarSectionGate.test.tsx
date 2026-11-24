/**
 * @file CalendarSectionGate.test.tsx
 * @description The calendar page island (HOS-2503): the calendar renders when
 * the plan grants `can_use_calendar`; otherwise the kit `LockedState` names the
 * catalog plan that unlocks it, or a kit info `Alert` when the catalog names
 * none. The shared `PlanEntitlementGate` decides; only the locked look changed.
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    CALENDAR_ENTITLEMENT,
    CalendarSectionGate
} from '@/components/host/editor/CalendarSectionGate.client';

const { mockHas, mockState } = vi.hoisted(() => ({
    mockHas: vi.fn(),
    mockState: { isLoading: false, error: null as Error | null }
}));

vi.mock('@/hooks/useMyEntitlements', () => ({
    useMyEntitlements: () => ({
        has: mockHas,
        limit: () => -1,
        plan: null,
        isLoading: mockState.isLoading,
        error: mockState.error
    })
}));

// The calendar has its own suite; here it only has to prove it rendered.
vi.mock('@/components/host/editor/CalendarSection.client', () => ({
    CalendarSection: ({ accommodationId }: { accommodationId: string }) => (
        <div data-testid="calendar-section">{accommodationId}</div>
    )
}));

const PLANS_HREF = '/es/planes/anfitriones/precios/';

function renderGate(upsellPlanName: string | null = 'Plan Pro') {
    return render(
        <CalendarSectionGate
            locale="es"
            accommodationId="acc-1"
            upsellPlanName={upsellPlanName}
            plansHref={PLANS_HREF}
        />
    );
}

describe('CalendarSectionGate', () => {
    beforeEach(() => {
        mockHas.mockReset();
        mockState.isLoading = false;
        mockState.error = null;
    });

    it('gates on the calendar entitlement', () => {
        // Arrange
        mockHas.mockReturnValue(true);

        // Act
        renderGate();

        // Assert
        expect(CALENDAR_ENTITLEMENT).toBe('can_use_calendar');
        expect(mockHas).toHaveBeenCalledWith('can_use_calendar');
        expect(screen.getByTestId('calendar-section')).toHaveTextContent('acc-1');
    });

    it('renders the kit locked state, naming the unlocking plan, when the plan lacks the calendar', () => {
        // Arrange
        mockHas.mockReturnValue(false);

        // Act
        const { container } = renderGate('Plan Pro');

        // Assert
        expect(screen.queryByTestId('calendar-section')).not.toBeInTheDocument();
        expect(container.querySelector('[data-reason="plan"]')).not.toBeNull();
        expect(screen.getByText('Plan Pro')).toBeInTheDocument();
        expect(
            screen.getByText('Actualizá tu plan para usar el calendario de disponibilidad.')
        ).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Ver planes' })).toHaveAttribute(
            'href',
            PLANS_HREF
        );
        const section = container.querySelector('[data-kit-section]');
        expect(section?.getAttribute('data-help')).toBe('section:accommodation.calendario');
    });

    it('falls back to an info alert when no catalog plan grants the calendar', () => {
        // Arrange
        mockHas.mockReturnValue(false);

        // Act
        const { container } = renderGate(null);

        // Assert
        expect(container.querySelector('[data-reason="plan"]')).toBeNull();
        expect(screen.getByRole('status')).toHaveTextContent(
            'Actualizá tu plan para usar el calendario de disponibilidad.'
        );
    });

    it('fails safe to the locked state when entitlements fail to load', () => {
        // Arrange
        mockState.error = new Error('boom');
        mockHas.mockReturnValue(true);

        // Act
        const { container } = renderGate();

        // Assert
        expect(screen.queryByTestId('calendar-section')).not.toBeInTheDocument();
        expect(container.querySelector('[data-reason="plan"]')).not.toBeNull();
    });
});
