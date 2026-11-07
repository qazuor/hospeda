/**
 * @file VenueEventsManager.upsell.test.tsx
 * @description The catalog-plan wording of the venue agenda upsell (HOS-2050).
 *
 * The agenda's `locked` state and its runtime 403 used to name "Profesional"
 * from a hardcoded locale string and a matching inline fallback. HOS-2050 makes
 * the page resolve the cheapest catalog plan that unlocks
 * `manage_venue_events` and pass its localized name down, so these tests hold
 * the three outcomes that decision can produce:
 *
 * 1. A resolved plan name is named, and the `{{plan}}` placeholder never leaks.
 * 2. No plan (failed catalog read or no sellable plan) shows the neutral
 *    variant, which names no plan at all.
 * 3. The runtime 403 with the section `available` on load still names the plan.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VenueEventsManager } from '../../../src/components/venue/VenueEventsManager.client';

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string, params?: Record<string, string>) =>
            (fallback ?? key).replace(
                /\{\{(\w+)\}\}/g,
                (_match: string, name: string) => params?.[name] ?? `{{${name}}}`
            ),
        tPlural: (key: string) => key
    })
}));

vi.mock('../../../src/lib/api/client', () => ({
    apiClient: {
        get: vi.fn(),
        getProtected: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
    }
}));

import { apiClient } from '../../../src/lib/api/client';

const mockGet = vi.mocked(apiClient.getProtected);
const mockPut = vi.mocked(apiClient.put);

const LISTING_ID = '22222222-2222-4222-8222-222222222222';
const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const EMPTY_EVENTS = { ok: true as const, data: { events: [] } };

beforeEach(() => {
    vi.clearAllMocks();
});

describe('VenueEventsManager — the upsell names the catalog plan (AC:G:10, AC:G:11)', () => {
    it('names the catalog plan in the proactive locked upsell', async () => {
        // Arrange
        mockGet.mockResolvedValue(EMPTY_EVENTS);

        // Act
        render(
            <VenueEventsManager
                listingId={LISTING_ID}
                locale="es"
                weekdayLabels={WEEKDAYS}
                sectionState="locked"
                upsellPlanName="Plan X"
            />
        );

        // Assert
        const notice = await screen.findByTestId('venue-section-locked-notice');
        expect(notice).toHaveTextContent('Plan X');
        expect(notice).not.toHaveTextContent('{{plan}}');
        expect(notice).not.toHaveTextContent('Profesional');
    });

    it('uses the neutral variant when the catalog yields no plan', async () => {
        // Arrange
        mockGet.mockResolvedValue(EMPTY_EVENTS);

        // Act
        render(
            <VenueEventsManager
                listingId={LISTING_ID}
                locale="es"
                weekdayLabels={WEEKDAYS}
                sectionState="locked"
                upsellPlanName={null}
            />
        );

        // Assert
        const notice = await screen.findByTestId('venue-section-locked-notice');
        expect(notice).toHaveTextContent(
            'Mantener una agenda de eventos está disponible en un plan pago.'
        );
        expect(notice).not.toHaveTextContent('{{plan}}');
        expect(notice).not.toHaveTextContent('Profesional');
    });

    it('names the catalog plan in the runtime 403 upsell', async () => {
        // AC:G:10 with the section `available` on load: the upsell still has to
        // name the plan when the API refuses the save at runtime.
        // Arrange
        mockGet.mockResolvedValue(EMPTY_EVENTS);
        mockPut.mockResolvedValue({
            ok: false as const,
            error: { status: 403, message: 'forbidden' }
        });
        render(
            <VenueEventsManager
                listingId={LISTING_ID}
                locale="es"
                weekdayLabels={WEEKDAYS}
                upsellPlanName="Plan X"
            />
        );
        await screen.findByText('Guardar agenda');

        // Act
        fireEvent.click(screen.getByText('Guardar agenda'));

        // Assert
        expect(
            await screen.findByText(
                'Mantener una agenda de eventos está disponible desde el plan Plan X.'
            )
        ).toBeTruthy();
        expect(screen.queryByText(/\{\{plan\}\}/)).toBeNull();
    });
});
