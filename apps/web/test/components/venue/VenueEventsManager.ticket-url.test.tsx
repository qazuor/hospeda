/**
 * @file VenueEventsManager.ticket-url.test.tsx
 * @description HOS-2255: the agenda editor carries the optional ticket link,
 * sends it trimmed (or `null`), and refuses to save a link that is not https.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VenueEventsManager } from '../../../src/components/venue/VenueEventsManager.client';

vi.mock('../../../src/lib/i18n', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../../src/lib/i18n')>()),
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
const LABEL = 'Link de entradas (opcional)';

/** Loads one stored event carrying the given link. */
async function renderWithEvent(ticketUrl: string | null) {
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
                    ticketUrl,
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
    return (await screen.findByLabelText(LABEL)) as HTMLInputElement;
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('VenueEventsManager: ticket link (HOS-2255)', () => {
    it('loads the stored link and sends it back on save', async () => {
        // Arrange
        const input = await renderWithEvent('https://www.passline.com/e/x');
        expect(input.value).toBe('https://www.passline.com/e/x');

        // Act — the save bar shows on a dirty draft; the title's trailing
        // space is trimmed by the payload.
        fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Jueves de jazz ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        // Assert
        await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1));
        const body = mockPut.mock.calls[0]?.[0].body as { events: Array<Record<string, unknown>> };
        expect(body.events[0]?.ticketUrl).toBe('https://www.passline.com/e/x');
    });

    it('sends null when the field is empty', async () => {
        // Arrange
        await renderWithEvent(null);

        // Act
        fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Jueves de jazz ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        // Assert
        await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1));
        const body = mockPut.mock.calls[0]?.[0].body as { events: Array<Record<string, unknown>> };
        expect(body.events[0]?.ticketUrl).toBeNull();
    });

    it.each([
        'http://example.com/e',
        'https://user:pass@example.com/e',
        'passline'
    ])('flags %s and does not send the save', async (bad) => {
        // Arrange
        const input = await renderWithEvent(null);

        // Act
        fireEvent.change(input, { target: { value: bad } });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        // Assert
        expect(input.getAttribute('aria-invalid')).toBe('true');
        expect(screen.getAllByText(/tiene que empezar con https/).length).toBeGreaterThan(0);
        expect(mockPut).not.toHaveBeenCalled();
    });
});
