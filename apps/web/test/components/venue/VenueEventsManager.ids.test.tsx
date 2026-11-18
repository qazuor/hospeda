/**
 * @file VenueEventsManager.ids.test.tsx
 * @description HOS-2291: the agenda editor sends back the id of every stored
 * event it loaded, and sends none for an entry added in the session, so a save
 * keeps each event's identity instead of recreating it.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VenueEventsManager } from '../../../src/components/venue/VenueEventsManager.client';

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
        tPlural: (key: string) => key
    })
}));

vi.mock('../../../src/lib/api/client', () => ({
    apiClient: { get: vi.fn(), getProtected: vi.fn(), put: vi.fn(), delete: vi.fn() }
}));

import { apiClient } from '../../../src/lib/api/client';

const mockGet = vi.mocked(apiClient.getProtected);
const mockPut = vi.mocked(apiClient.put);

const STORED_ID = '33333333-3333-4333-8333-333333333333';
const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

beforeEach(() => {
    vi.clearAllMocks();
});

describe('VenueEventsManager: stable event ids (HOS-2291)', () => {
    it('sends the stored id back on save', async () => {
        // Arrange
        mockGet.mockResolvedValue({
            ok: true as const,
            data: {
                events: [
                    {
                        id: STORED_ID,
                        title: 'Jueves de jazz',
                        description: null,
                        recurrence: 'weekly',
                        date: null,
                        weekday: 4,
                        startTime: '21:00',
                        endTime: null,
                        isActive: true
                    }
                ]
            }
        });
        mockPut.mockResolvedValue({ ok: true as const, data: { events: [] } });
        render(
            <VenueEventsManager
                listingId="22222222-2222-4222-8222-222222222222"
                locale="es"
                weekdayLabels={WEEKDAYS}
                sectionState="available"
            />
        );

        // Act
        const save = await screen.findByText('Guardar agenda');
        fireEvent.click(save);

        // Assert
        await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1));
        const body = mockPut.mock.calls[0]?.[0].body as { events: Array<Record<string, unknown>> };
        expect(body.events).toHaveLength(1);
        expect(body.events[0]?.id).toBe(STORED_ID);
    });
});
