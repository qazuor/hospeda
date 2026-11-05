/**
 * @file TourController.test.tsx
 * @description TEST:5.4:2 — `TourController` drops steps whose target is not in
 * the DOM (HOS-1856, AC:5:3).
 *
 * The assertion is on the steps driver.js actually receives. A test that only
 * checked "no exception" would pass even with the bug: driver.js silently
 * floats a popover in the centre when `element` does not resolve.
 */

import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TourController } from '@/components/account/TourController.client';

const { driverMock, hasNextStepMock } = vi.hoisted(() => {
    const drive = vi.fn();
    const destroy = vi.fn();
    const hasNextStep = vi.fn(() => true);
    const driver = vi.fn((_config: { readonly steps?: readonly unknown[] }) => ({
        drive,
        destroy,
        hasNextStep
    }));

    return { driverMock: driver, hasNextStepMock: hasNextStep };
});

vi.mock('@/lib/load-driver', () => ({ driver: driverMock }));

vi.mock('@/hooks/use-tour-state', () => ({
    useTourState: () => ({
        isLoading: false,
        error: null,
        hasSeen: () => false,
        markSeen: vi.fn()
    })
}));

/** Renders every venue-tour target except the menu QR anchor. */
function mountAnchors({ withVenueQr }: { readonly withVenueQr: boolean }): void {
    document.body.innerHTML = `
        <a data-tour="comercio-listings"></a>
        <div data-tour="listings"></div>
        <div data-tour="listing-views"></div>
        ${withVenueQr ? '<div data-tour="venue-qr"></div>' : ''}
    `;
}

/** The `element` selectors of the steps handed to driver.js. */
function driverStepElements(): readonly unknown[] {
    const config = driverMock.mock.calls[0]?.[0] as
        | { readonly steps?: readonly { readonly element?: unknown }[] }
        | undefined;
    return (config?.steps ?? []).map((step) => step.element);
}

describe('TourController — steps without a destination (HOS-1856)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        hasNextStepMock.mockReturnValue(true);
    });

    afterEach(() => {
        cleanup();
        document.body.innerHTML = '';
    });

    it('omits the venue-qr step when its anchor is not in the DOM', async () => {
        mountAnchors({ withVenueQr: false });

        render(
            <TourController
                locale="es"
                userRoles={['VENUE_OWNER']}
                page="comercio"
            />
        );

        await waitFor(() => expect(driverMock).toHaveBeenCalledTimes(1));

        const elements = driverStepElements();
        expect(elements).not.toContain('[data-tour="venue-qr"]');
        expect(elements).toContain('[data-tour="comercio-listings"]');
        expect(elements).toContain('[data-tour="listings"]');
        expect(elements).toContain('[data-tour="listing-views"]');
    });

    it('keeps the venue-qr step when its anchor is in the DOM', async () => {
        mountAnchors({ withVenueQr: true });

        render(
            <TourController
                locale="es"
                userRoles={['VENUE_OWNER']}
                page="comercio"
            />
        );

        await waitFor(() => expect(driverMock).toHaveBeenCalledTimes(1));

        expect(driverStepElements()).toContain('[data-tour="venue-qr"]');
    });

    it('keeps centre steps, which have no destination by design', async () => {
        document.body.innerHTML = '';

        render(
            <TourController
                locale="es"
                userRoles={['SPONSOR']}
                page="dashboard"
            />
        );

        // The sponsor tour has a single `center` greeting, so it still runs.
        await waitFor(() => expect(driverMock).toHaveBeenCalledTimes(1));
        expect(driverStepElements()).toEqual([undefined]);
    });
});
