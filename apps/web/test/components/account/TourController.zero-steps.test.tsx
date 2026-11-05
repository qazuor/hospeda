/**
 * @file TourController.zero-steps.test.tsx
 * @description HOS-1856: a tour whose every step lost its destination does not
 * start, and is not marked as seen.
 *
 * Isolated because it replaces the tour config; the companion
 * `TourController.test.tsx` exercises the real `web.venue.welcome` steps.
 */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TourController } from '@/components/account/TourController.client';

const { driverMock, markSeenMock, fakeTour } = vi.hoisted(() => ({
    driverMock: vi.fn(),
    markSeenMock: vi.fn(),
    // A STABLE object: `TourController` recomputes the pending tour on every
    // render, and a fresh identity would re-trigger its start effect forever.
    fakeTour: {
        id: 'web.venue.welcome',
        version: 1,
        roles: ['VENUE_OWNER'],
        trigger: 'auto-first-visit',
        steps: [
            {
                id: 'venue-qr',
                target: '[data-tour="venue-qr"]',
                title: 'account.welcomeTour.venueQr.title',
                body: 'account.welcomeTour.venueQr.body'
            }
        ]
    }
}));

vi.mock('@/lib/load-driver', () => ({ driver: driverMock }));

vi.mock('@/hooks/use-tour-state', () => ({
    useTourState: () => ({
        isLoading: false,
        error: null,
        hasSeen: () => false,
        markSeen: markSeenMock
    })
}));

vi.mock('@/config/tours', () => ({
    getNextPendingWelcomeTour: () => fakeTour
}));

describe('TourController — no step has a destination (HOS-1856)', () => {
    afterEach(() => {
        cleanup();
        document.body.innerHTML = '';
    });

    it('does not start driver.js and does not mark the tour as seen', async () => {
        document.body.innerHTML = '';

        render(
            <TourController
                locale="es"
                userRoles={['VENUE_OWNER']}
                page="comercio"
            />
        );

        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(driverMock).not.toHaveBeenCalled();
        expect(markSeenMock).not.toHaveBeenCalled();
    });
});
