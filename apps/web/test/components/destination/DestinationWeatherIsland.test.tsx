/**
 * @file DestinationWeatherIsland.test.tsx
 * @description SPEC-215 US-3 graceful degradation: the live weather island must
 * degrade to a neutral "unavailable" line on fetch error, non-200, null payload,
 * or empty forecast — never throwing or breaking layout — and render the current
 * badge + forecast when data is present.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DestinationWeatherIsland } from '../../../src/components/destination/DestinationWeatherIsland.client';

vi.mock('../../../src/components/destination/DestinationWeatherIsland.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, p) => String(p) })
}));

vi.mock('../../../src/lib/i18n', () => {
    const t = (key: string, fallback?: string): string => fallback ?? key;
    return { createTranslations: () => ({ t }) };
});

const UNAVAILABLE = 'Clima no disponible por el momento';

const validPayload = {
    current: {
        temperatureC: 21.4,
        apparentTemperatureC: 20.1,
        weatherCode: 61,
        condition: 'rain',
        windSpeedKmh: 12.5,
        humidityPct: 72,
        isDay: true
    },
    daily: [
        {
            date: '2026-06-15',
            tempMinC: 14,
            tempMaxC: 25,
            weatherCode: 3,
            condition: 'overcast',
            precipMm: 1.2
        }
    ],
    fetchedAt: '2026-06-15T12:00:00.000Z'
};

const renderIsland = () =>
    render(
        <DestinationWeatherIsland
            locale="es"
            destinationId="d1"
            apiUrl="http://api.test"
        />
    );

describe('DestinationWeatherIsland (US-3 graceful degradation)', () => {
    beforeEach(() => {
        global.fetch = vi.fn() as unknown as typeof fetch;
    });
    afterEach(() => vi.restoreAllMocks());

    it('shows the neutral unavailable line when the fetch rejects', async () => {
        (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network'));
        renderIsland();
        await waitFor(() => expect(screen.getByText(UNAVAILABLE)).toBeInTheDocument());
    });

    it('shows unavailable on a non-200 response', async () => {
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => ({})
        });
        renderIsland();
        await waitFor(() => expect(screen.getByText(UNAVAILABLE)).toBeInTheDocument());
    });

    it('shows unavailable when the payload is null (no coordinates / uncached)', async () => {
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => null
        });
        renderIsland();
        await waitFor(() => expect(screen.getByText(UNAVAILABLE)).toBeInTheDocument());
    });

    it('shows unavailable when the daily forecast is empty', async () => {
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ ...validPayload, daily: [] })
        });
        renderIsland();
        await waitFor(() => expect(screen.getByText(UNAVAILABLE)).toBeInTheDocument());
    });

    it('renders the current temperature and forecast when data is present', async () => {
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => validPayload
        });
        renderIsland();
        await waitFor(() => expect(screen.getByText(/21°C/)).toBeInTheDocument());
        expect(screen.queryByText(UNAVAILABLE)).not.toBeInTheDocument();
    });
});
