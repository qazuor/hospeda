/**
 * @file EntityViewTracker.test.tsx
 * @description Unit tests for EntityViewTracker (SPEC-159 T-013).
 *
 * Covers:
 *  - Renders null (no DOM output) for both POST and EVENT types.
 *  - Fires `sendViewBeacon` once per mount with the correct EntityTypeEnum
 *    member (POST / EVENT) and the entity UUID.
 *  - Fires the correct typed PostHog event (`post_viewed` / `event_viewed`)
 *    with slug, entity id, and locale.
 *  - Does not double-fire on re-render with identical props.
 *  - Re-fires when entityId changes (View Transitions navigation).
 *  - Both beacon and PostHog event fire together on the same mount.
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

import { EntityViewTracker } from '@/components/analytics/EntityViewTracker.client';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const POST_PROPS = {
    entityType: 'POST' as const,
    slug: 'viaje-al-litoral',
    entityId: '550e8400-e29b-41d4-a716-446655440001',
    locale: 'es' as const
};

const EVENT_PROPS = {
    entityType: 'EVENT' as const,
    slug: 'festival-de-verano',
    entityId: '550e8400-e29b-41d4-a716-446655440002',
    locale: 'es' as const
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EntityViewTracker — POST (SPEC-159 T-013)', () => {
    beforeEach(() => {
        trackEventMock.mockClear();
        sendViewBeaconMock.mockClear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders null (no DOM output)', () => {
        // Arrange / Act
        const { container } = render(<EntityViewTracker {...POST_PROPS} />);

        // Assert
        expect(container).toBeEmptyDOMElement();
    });

    it('calls sendViewBeacon once on mount with entityType POST and correct entityId', () => {
        // Arrange / Act
        render(<EntityViewTracker {...POST_PROPS} />);

        // Assert
        expect(sendViewBeaconMock).toHaveBeenCalledTimes(1);
        expect(sendViewBeaconMock).toHaveBeenCalledWith({
            entityType: 'POST',
            entityId: POST_PROPS.entityId
        });
    });

    it('calls trackEvent with post_viewed and correct typed payload', () => {
        // Arrange / Act
        render(<EntityViewTracker {...POST_PROPS} />);

        // Assert
        expect(trackEventMock).toHaveBeenCalledTimes(1);
        expect(trackEventMock).toHaveBeenCalledWith('post_viewed', {
            slug: POST_PROPS.slug,
            post_id: POST_PROPS.entityId,
            locale: POST_PROPS.locale
        });
    });

    it('does not re-fire when the component re-renders with identical props', () => {
        // Arrange
        const { rerender } = render(<EntityViewTracker {...POST_PROPS} />);
        expect(sendViewBeaconMock).toHaveBeenCalledTimes(1);
        expect(trackEventMock).toHaveBeenCalledTimes(1);

        // Act — re-render with the same props
        act(() => {
            rerender(<EntityViewTracker {...POST_PROPS} />);
        });

        // Assert — still once only
        expect(sendViewBeaconMock).toHaveBeenCalledTimes(1);
        expect(trackEventMock).toHaveBeenCalledTimes(1);
    });

    it('fires again when entityId changes (View Transitions navigation)', () => {
        // Arrange
        const { rerender } = render(<EntityViewTracker {...POST_PROPS} />);
        expect(sendViewBeaconMock).toHaveBeenCalledTimes(1);

        // Act — new post page
        const newId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
        act(() => {
            rerender(
                <EntityViewTracker
                    {...POST_PROPS}
                    entityId={newId}
                    slug="nueva-publicacion"
                />
            );
        });

        // Assert — fired again for the new entity
        expect(sendViewBeaconMock).toHaveBeenCalledTimes(2);
        expect(sendViewBeaconMock).toHaveBeenLastCalledWith({
            entityType: 'POST',
            entityId: newId
        });
    });

    it('fires both beacon and PostHog event on the same mount', () => {
        // Arrange / Act
        render(<EntityViewTracker {...POST_PROPS} />);

        // Assert — both happen in the same effect call
        expect(sendViewBeaconMock).toHaveBeenCalledTimes(1);
        expect(trackEventMock).toHaveBeenCalledTimes(1);
    });
});

describe('EntityViewTracker — EVENT (SPEC-159 T-013)', () => {
    beforeEach(() => {
        trackEventMock.mockClear();
        sendViewBeaconMock.mockClear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders null (no DOM output)', () => {
        // Arrange / Act
        const { container } = render(<EntityViewTracker {...EVENT_PROPS} />);

        // Assert
        expect(container).toBeEmptyDOMElement();
    });

    it('calls sendViewBeacon once on mount with entityType EVENT and correct entityId', () => {
        // Arrange / Act
        render(<EntityViewTracker {...EVENT_PROPS} />);

        // Assert
        expect(sendViewBeaconMock).toHaveBeenCalledTimes(1);
        expect(sendViewBeaconMock).toHaveBeenCalledWith({
            entityType: 'EVENT',
            entityId: EVENT_PROPS.entityId
        });
    });

    it('calls trackEvent with event_viewed and correct typed payload', () => {
        // Arrange / Act
        render(<EntityViewTracker {...EVENT_PROPS} />);

        // Assert
        expect(trackEventMock).toHaveBeenCalledTimes(1);
        expect(trackEventMock).toHaveBeenCalledWith('event_viewed', {
            slug: EVENT_PROPS.slug,
            event_id: EVENT_PROPS.entityId,
            locale: EVENT_PROPS.locale
        });
    });

    it('does not re-fire when the component re-renders with identical props', () => {
        // Arrange
        const { rerender } = render(<EntityViewTracker {...EVENT_PROPS} />);
        expect(sendViewBeaconMock).toHaveBeenCalledTimes(1);
        expect(trackEventMock).toHaveBeenCalledTimes(1);

        // Act — re-render with the same props
        act(() => {
            rerender(<EntityViewTracker {...EVENT_PROPS} />);
        });

        // Assert — still once only
        expect(sendViewBeaconMock).toHaveBeenCalledTimes(1);
        expect(trackEventMock).toHaveBeenCalledTimes(1);
    });

    it('fires again when entityId changes (View Transitions navigation)', () => {
        // Arrange
        const { rerender } = render(<EntityViewTracker {...EVENT_PROPS} />);
        expect(sendViewBeaconMock).toHaveBeenCalledTimes(1);

        // Act — new event page
        const newId = 'ffffffff-0000-1111-2222-333333333333';
        act(() => {
            rerender(
                <EntityViewTracker
                    {...EVENT_PROPS}
                    entityId={newId}
                    slug="nuevo-festival"
                />
            );
        });

        // Assert — fired again for the new entity
        expect(sendViewBeaconMock).toHaveBeenCalledTimes(2);
        expect(sendViewBeaconMock).toHaveBeenLastCalledWith({
            entityType: 'EVENT',
            entityId: newId
        });
    });

    it('fires both beacon and PostHog event on the same mount', () => {
        // Arrange / Act
        render(<EntityViewTracker {...EVENT_PROPS} />);

        // Assert — both happen in the same effect call
        expect(sendViewBeaconMock).toHaveBeenCalledTimes(1);
        expect(trackEventMock).toHaveBeenCalledTimes(1);
    });
});
