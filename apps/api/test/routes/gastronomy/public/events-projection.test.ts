/**
 * Unit tests for the public venue-events projection gate (HOS-1042).
 *
 * The rule has TWO independent refusals — the owner's plan, and the owner's own
 * on/off switch — and the value of testing it here rather than through the route
 * is that the two can be varied one at a time.
 *
 * @module test/routes/gastronomy/public/events-projection
 */
import type { GastronomyEventPublic } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { applyGastronomyVenueEventsGate } from '../../../../src/routes/gastronomy/public/events-projection.js';

/**
 * Builds one agenda entry.
 *
 * @param overrides - Fields to override on the default weekly happy hour.
 * @returns A public agenda entry.
 */
function anEvent(overrides: Partial<GastronomyEventPublic> = {}): GastronomyEventPublic {
    return {
        id: '33333333-3333-4333-8333-333333333333',
        gastronomyId: '22222222-2222-4222-8222-222222222222',
        title: 'Happy hour',
        description: null,
        recurrence: 'weekly',
        date: null,
        weekday: 4,
        startTime: '18:00',
        endTime: '20:00',
        isActive: true,
        displayOrder: 0,
        createdAt: new Date('2026-09-01T00:00:00Z'),
        updatedAt: new Date('2026-09-01T00:00:00Z'),
        ...overrides
    };
}

describe('applyGastronomyVenueEventsGate (HOS-1042)', () => {
    it('publishes the active entries when the plan grants the agenda', () => {
        // Arrange
        const events = [anEvent(), anEvent({ id: '44444444-4444-4444-8444-444444444444' })];

        // Act
        const result = applyGastronomyVenueEventsGate({
            events,
            ownerGrantsVenueEvents: true
        });

        // Assert
        expect(result.venueEvents).toHaveLength(2);
    });

    it('withholds a NON-EMPTY agenda when the plan does not grant it', () => {
        // The case the gate exists for, and the one a fixture of an empty
        // agenda would make vacuously true: a downgraded owner's rows are NOT
        // deleted, so the read hands over real entries and the gate is the only
        // thing keeping them off the page.
        // Arrange
        const events = [anEvent()];

        // Act
        const result = applyGastronomyVenueEventsGate({
            events,
            ownerGrantsVenueEvents: false
        });

        // Assert
        expect(result.venueEvents).toBeUndefined();
    });

    it('drops the entries the owner switched off, keeping the rest', () => {
        // Arrange — the parked winter cena show alongside a live happy hour.
        const events = [
            anEvent({ id: '44444444-4444-4444-8444-444444444444', isActive: false }),
            anEvent()
        ];

        // Act
        const result = applyGastronomyVenueEventsGate({
            events,
            ownerGrantsVenueEvents: true
        });

        // Assert
        expect(result.venueEvents).toHaveLength(1);
        expect(result.venueEvents?.[0]?.id).toBe('33333333-3333-4333-8333-333333333333');
    });

    it('reports "not loaded" rather than "none" when everything is switched off', () => {
        // `undefined`, never `[]` — the convention `amenities` / `features` /
        // `menuSections` already follow on this schema, so a consumer cannot
        // tell an agenda that was withheld from one that was never read, and
        // renders nothing for either.
        // Arrange
        const events = [anEvent({ isActive: false })];

        // Act
        const result = applyGastronomyVenueEventsGate({
            events,
            ownerGrantsVenueEvents: true
        });

        // Assert
        expect(result.venueEvents).toBeUndefined();
    });
});
