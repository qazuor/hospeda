/**
 * @file TourController.consent.test.tsx
 * @description Regression for HOS-2448: on a first visit the welcome tour and the
 * cookie banner overlapped. The tour must wait for the cookie decision.
 */

import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TourController } from '@/components/account/TourController.client';
import { CONSENT_CHANGED_EVENT } from '@/lib/cookie-consent';

const { driverMock } = vi.hoisted(() => {
    const driver = vi.fn((_config: { readonly progressText?: string }) => ({
        drive: vi.fn(),
        destroy: vi.fn(),
        hasNextStep: vi.fn(() => true)
    }));
    return { driverMock: driver };
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

function renderController() {
    return render(
        <TourController
            locale="es"
            userRoles={['SPONSOR']}
            page="dashboard"
        />
    );
}

describe('TourController — waits for the cookie decision (HOS-2448)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.cookie = 'cookie-consent=; Max-Age=0; path=/';
    });

    afterEach(() => {
        cleanup();
    });

    it('does not start while the cookie banner is awaiting an answer', async () => {
        renderController();

        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(driverMock).not.toHaveBeenCalled();
    });

    it('starts once the visitor answers the banner, with a translated counter', async () => {
        renderController();

        act(() => {
            window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT));
        });

        await waitFor(() => expect(driverMock).toHaveBeenCalledTimes(1));
        expect(driverMock.mock.calls[0]?.[0].progressText).toBe('Paso {{current}} de {{total}}');
    });
});
