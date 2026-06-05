/**
 * @file AccommodationViewTracker.test.tsx
 * @description Unit tests for AccommodationViewTracker (SPEC-159 T-012).
 *
 * Covers:
 *  - Fires `sendViewBeacon` once per mount with correct entityId.
 *  - Continues firing the PostHog `trackEvent` (additive — pre-existing
 *    SPEC-140 behaviour is unchanged).
 *  - Does not double-fire on prop identity (stable deps, re-render without
 *    unmount does not re-run effect).
 *  - Re-fires when accommodationId changes (new page navigation).
 */

import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Module mocks (must precede the import under test) ────────────────────────

const trackEventMock = vi.fn();
vi.mock('@/lib/analytics/posthog-client', () => ({
    trackEvent: (...args: unknown[]) => trackEventMock(...args)
}));

const sendViewBeaconMock = vi.fn();
vi.mock('@/lib/analytics/view-capture', () => ({
    sendViewBeacon: (...args: unknown[]) => sendViewBeaconMock(...args)
}));

// ─── Import under test (after mocks are registered) ──────────────────────────

import { AccommodationViewTracker } from '@/components/analytics/AccommodationViewTracker.client';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_PROPS = {
    slug: 'cabana-del-rio',
    accommodationId: '550e8400-e29b-41d4-a716-446655440000',
    locale: 'es' as const
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AccommodationViewTracker (SPEC-159 T-012)', () => {
    beforeEach(() => {
        trackEventMock.mockClear();
        sendViewBeaconMock.mockClear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ── Renders nothing ────────────────────────────────────────────────────

    it('renders null (no DOM output)', () => {
        // Arrange / Act
        const { container } = render(<AccommodationViewTracker {...DEFAULT_PROPS} />);

        // Assert
        expect(container).toBeEmptyDOMElement();
    });

    // ── Beacon fires once per mount ────────────────────────────────────────

    it('calls sendViewBeacon once on mount with entityType ACCOMMODATION and correct entityId', () => {
        // Arrange / Act
        render(<AccommodationViewTracker {...DEFAULT_PROPS} />);

        // Assert
        expect(sendViewBeaconMock).toHaveBeenCalledTimes(1);
        expect(sendViewBeaconMock).toHaveBeenCalledWith({
            entityType: 'ACCOMMODATION',
            entityId: DEFAULT_PROPS.accommodationId
        });
    });

    // ── PostHog event still fires (additive) ───────────────────────────────

    it('still calls trackEvent with accommodation_viewed and correct props', () => {
        // Arrange / Act
        render(<AccommodationViewTracker {...DEFAULT_PROPS} />);

        // Assert
        expect(trackEventMock).toHaveBeenCalledTimes(1);
        expect(trackEventMock).toHaveBeenCalledWith('accommodation_viewed', {
            slug: DEFAULT_PROPS.slug,
            accommodation_id: DEFAULT_PROPS.accommodationId,
            locale: DEFAULT_PROPS.locale
        });
    });

    // ── No double-fire on stable props re-render ───────────────────────────

    it('does not re-fire when the component re-renders with identical props', () => {
        // Arrange
        const { rerender } = render(<AccommodationViewTracker {...DEFAULT_PROPS} />);
        expect(sendViewBeaconMock).toHaveBeenCalledTimes(1);
        expect(trackEventMock).toHaveBeenCalledTimes(1);

        // Act — re-render with the same props (simulates parent state update
        // that does not change the tracker's props)
        act(() => {
            rerender(<AccommodationViewTracker {...DEFAULT_PROPS} />);
        });

        // Assert — still once only
        expect(sendViewBeaconMock).toHaveBeenCalledTimes(1);
        expect(trackEventMock).toHaveBeenCalledTimes(1);
    });

    // ── Re-fires on new entityId (navigation to different accommodation) ───

    it('fires again when accommodationId changes (View Transitions navigation)', () => {
        // Arrange
        const { rerender } = render(<AccommodationViewTracker {...DEFAULT_PROPS} />);
        expect(sendViewBeaconMock).toHaveBeenCalledTimes(1);

        // Act — new accommodation page (different entityId)
        const newId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
        act(() => {
            rerender(
                <AccommodationViewTracker
                    {...DEFAULT_PROPS}
                    accommodationId={newId}
                    slug="nueva-cabaña"
                />
            );
        });

        // Assert — fired again for the new entity
        expect(sendViewBeaconMock).toHaveBeenCalledTimes(2);
        expect(sendViewBeaconMock).toHaveBeenLastCalledWith({
            entityType: 'ACCOMMODATION',
            entityId: newId
        });
    });

    // ── Both beacon and PostHog fire together ──────────────────────────────

    it('fires both beacon and PostHog event on the same mount', () => {
        // Arrange / Act
        render(<AccommodationViewTracker {...DEFAULT_PROPS} />);

        // Assert — both happen in the same effect call
        expect(sendViewBeaconMock).toHaveBeenCalledTimes(1);
        expect(trackEventMock).toHaveBeenCalledTimes(1);
    });
});
