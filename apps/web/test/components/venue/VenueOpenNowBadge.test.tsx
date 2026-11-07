/**
 * @file VenueOpenNowBadge.test.tsx
 * @description Tests for the venue-card "open now" island (HOS-1787 leaf 6.3,
 * AC:6:7).
 *
 * The listing HTML is edge-cached, so the island must render NOTHING during SSR
 * and paint the badge only after mounting, from the browser clock (in the
 * venue's zone). Both halves are asserted here: `renderToString` must be empty,
 * and a mounted instance must resolve the label for the faked system time.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VenueOpenNowBadge } from '../../../src/components/venue/VenueOpenNowBadge.client';
import type { VenueOpeningHoursEntry } from '../../../src/data/types';

/** Every day, one shift that covers all but the last minute. */
const ALWAYS_OPEN: Record<string, VenueOpeningHoursEntry> = {
    sunday: { isOpen: true, shifts: [{ open: '00:00', close: '23:59' }] },
    monday: { isOpen: true, shifts: [{ open: '00:00', close: '23:59' }] },
    tuesday: { isOpen: true, shifts: [{ open: '00:00', close: '23:59' }] },
    wednesday: { isOpen: true, shifts: [{ open: '00:00', close: '23:59' }] },
    thursday: { isOpen: true, shifts: [{ open: '00:00', close: '23:59' }] },
    friday: { isOpen: true, shifts: [{ open: '00:00', close: '23:59' }] },
    saturday: { isOpen: true, shifts: [{ open: '00:00', close: '23:59' }] }
};

/** Friday 09:00-18:00 in Buenos Aires (UTC-3). */
const FRIDAY_HOURS: Record<string, VenueOpeningHoursEntry> = {
    friday: { isOpen: true, shifts: [{ open: '09:00', close: '18:00' }] }
};

/** Friday 12:00 ART. */
const FRIDAY_NOON = new Date('2024-01-05T15:00:00.000Z');
/** Friday 07:00 ART — before opening. */
const FRIDAY_EARLY = new Date('2024-01-05T10:00:00.000Z');
/** Friday 20:00 ART — after closing. */
const FRIDAY_NIGHT = new Date('2024-01-05T23:00:00.000Z');

afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

describe('VenueOpenNowBadge', () => {
    describe('AC:6:7 the cached HTML carries no badge', () => {
        it('renders nothing during SSR even with hours that are open right now', () => {
            expect(
                renderToString(
                    <VenueOpenNowBadge
                        locale="es"
                        openingHours={ALWAYS_OPEN}
                    />
                )
            ).toBe('');
        });
    });

    describe('after mounting', () => {
        it('renders the Spanish open label from the browser clock', () => {
            vi.useFakeTimers();
            vi.setSystemTime(FRIDAY_NOON);

            render(
                <VenueOpenNowBadge
                    locale="es"
                    openingHours={FRIDAY_HOURS}
                />
            );

            expect(screen.getByText('Abierto ahora')).toBeInTheDocument();
        });

        it('renders the English open label', () => {
            vi.useFakeTimers();
            vi.setSystemTime(FRIDAY_NOON);

            render(
                <VenueOpenNowBadge
                    locale="en"
                    openingHours={FRIDAY_HOURS}
                />
            );

            expect(screen.getByText('Open now')).toBeInTheDocument();
        });

        it('renders the Portuguese open label', () => {
            vi.useFakeTimers();
            vi.setSystemTime(FRIDAY_NOON);

            render(
                <VenueOpenNowBadge
                    locale="pt"
                    openingHours={FRIDAY_HOURS}
                />
            );

            expect(screen.getByText('Aberto agora')).toBeInTheDocument();
        });

        it('renders the closed label outside a shift', () => {
            vi.useFakeTimers();
            vi.setSystemTime(FRIDAY_EARLY);

            render(
                <VenueOpenNowBadge
                    locale="es"
                    openingHours={FRIDAY_HOURS}
                />
            );

            expect(screen.getByText('Cerrado ahora')).toBeInTheDocument();
        });

        it('renders nothing when there is no entry for the venue day', () => {
            vi.useFakeTimers();
            vi.setSystemTime(FRIDAY_NOON);

            const { container } = render(
                <VenueOpenNowBadge
                    locale="es"
                    openingHours={{
                        monday: { isOpen: true, shifts: [{ open: '09:00', close: '18:00' }] }
                    }}
                />
            );

            expect(container).toBeEmptyDOMElement();
        });

        it('recomputes from the same hours when the browser clock moves', () => {
            vi.useFakeTimers();
            vi.setSystemTime(FRIDAY_NOON);

            const first = render(
                <VenueOpenNowBadge
                    locale="es"
                    openingHours={FRIDAY_HOURS}
                />
            );
            expect(screen.getByText('Abierto ahora')).toBeInTheDocument();
            first.unmount();

            vi.setSystemTime(FRIDAY_NIGHT);
            render(
                <VenueOpenNowBadge
                    locale="es"
                    openingHours={FRIDAY_HOURS}
                />
            );

            expect(screen.getByText('Cerrado ahora')).toBeInTheDocument();
        });
    });
});
