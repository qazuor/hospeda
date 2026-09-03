/**
 * Unit tests for the public experience directions gate (HOS-1049).
 *
 * `applyExperienceDirectionsGate` is the ONE place that decides whether
 * `meetingPointDirections` leaves the API, and whether the ficha is told to
 * draw the meeting-point map. Tested directly rather than through the
 * `getBySlug` route + `ExperiencePublicSchema` validation, because building a
 * schema-valid fixture for a whole listing would exercise Zod, not this
 * withholding rule.
 *
 * AAA pattern throughout. Every assertion is mutation-sensitive: the withheld
 * cases are compared against a NON-empty source, so a mutation that always
 * answers "withheld" (or always "granted") fails at least one case, and the
 * flag is asserted separately from the payload so a gate that withheld the
 * text but left the map on cannot pass.
 *
 * ## `not.toHaveProperty`, never `toBeUndefined`
 *
 * `toBeUndefined` cannot tell "the key was never copied" from "the key was
 * copied AS undefined", and the second is a real bug that `JSON.stringify`
 * hides on the wire (measured on HOS-1045). This gate promises the key is
 * GONE, so that is what these assert.
 */
import { describe, expect, it } from 'vitest';
import {
    applyExperienceDirectionsGate,
    withholdExperienceDirectionsFromList
} from '../../../../src/routes/experience/public/directions-projection';

const DIRECTIONS = [
    'Estacioná en la bajada municipal, sobre la costanera.',
    'El colectivo 4 te deja en la rotonda; son 300 m por camino de ripio.'
] as const;

describe('applyExperienceDirectionsGate', () => {
    it('withholds the instructions and disables the map when the provider is not entitled', () => {
        // Arrange — a listing that HAS instructions stored. Withholding an
        // already-empty list would pass under any mutation.
        const experience = { meetingPointDirections: [...DIRECTIONS] };

        // Act
        const result = applyExperienceDirectionsGate({
            experience,
            ownerGrantsDirections: false
        });

        // Assert
        expect(result).not.toHaveProperty('meetingPointDirections');
        expect(result.meetingPointDirectionsEnabled).toBe(false);
    });

    it('publishes the instructions when the provider is entitled', () => {
        // Arrange
        const experience = { meetingPointDirections: [...DIRECTIONS] };

        // Act
        const result = applyExperienceDirectionsGate({
            experience,
            ownerGrantsDirections: true
        });

        // Assert
        expect(result.meetingPointDirections).toEqual([...DIRECTIONS]);
        expect(result.meetingPointDirectionsEnabled).toBe(true);
    });

    it('enables the map for an entitled provider who wrote no instructions', () => {
        // The two halves of the entitlement are filled in independently: a
        // provider who pinned the spot but typed nothing must still get their
        // map. This is the case a "render the map when there are directions"
        // shortcut would break.
        // Arrange
        const experience = { meetingPointDirections: [] };

        // Act
        const result = applyExperienceDirectionsGate({
            experience,
            ownerGrantsDirections: true
        });

        // Assert
        expect(result).not.toHaveProperty('meetingPointDirections');
        expect(result.meetingPointDirectionsEnabled).toBe(true);
    });

    it('treats a null/absent column as no instructions rather than throwing', () => {
        // Arrange — rows written before migration 0107 read back as null on a
        // database that has not been migrated yet.
        // Act
        const nullish = applyExperienceDirectionsGate({
            experience: { meetingPointDirections: null },
            ownerGrantsDirections: true
        });
        const absent = applyExperienceDirectionsGate({
            experience: {},
            ownerGrantsDirections: true
        });

        // Assert
        expect(nullish).not.toHaveProperty('meetingPointDirections');
        expect(nullish.meetingPointDirectionsEnabled).toBe(true);
        expect(absent).not.toHaveProperty('meetingPointDirections');
        expect(absent.meetingPointDirectionsEnabled).toBe(true);
    });
});

describe('withholdExperienceDirectionsFromList', () => {
    it('strips stored instructions off every card and never enables the map', () => {
        // Arrange — two cards, both carrying stored instructions, so a mutation
        // that only handled the first item fails here.
        const items = [
            { id: 'a', meetingPointDirections: [...DIRECTIONS] },
            { id: 'b', meetingPointDirections: ['Bajás en la parada del muelle.'] }
        ];

        // Act
        const result = withholdExperienceDirectionsFromList(items);

        // Assert
        expect(result).toHaveLength(2);
        for (const card of result) {
            expect(card).not.toHaveProperty('meetingPointDirections');
            expect(card.meetingPointDirectionsEnabled).toBe(false);
        }
    });

    it('leaves every other field on the card untouched', () => {
        // The gate must not become a general-purpose projection: a card that
        // lost its name or its coordinates would break the listing page while
        // still satisfying the assertions above.
        // Arrange
        const items = [
            {
                id: 'a',
                name: 'Kayak al atardecer',
                meetingPoint: 'Muelle 3 del puerto',
                meetingPointLat: -32.48,
                meetingPointLong: -58.23,
                meetingPointDirections: [...DIRECTIONS]
            }
        ];

        // Act
        const [card] = withholdExperienceDirectionsFromList(items);

        // Assert — the ficha data HOS-1048 made free is still on the card.
        expect(card?.name).toBe('Kayak al atardecer');
        expect(card?.meetingPoint).toBe('Muelle 3 del puerto');
        expect(card?.meetingPointLat).toBe(-32.48);
        expect(card?.meetingPointLong).toBe(-58.23);
    });

    it('returns an empty array for an empty page', () => {
        expect(withholdExperienceDirectionsFromList([])).toEqual([]);
    });
});
