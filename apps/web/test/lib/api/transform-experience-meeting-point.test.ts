/**
 * @file transform-experience-meeting-point.test.ts
 * @description The read side of the meeting point (HOS-1048), tested where it
 * actually executes.
 *
 * ## What this file proves, and what it does not
 *
 * `toExperienceDetailPageProps` is the only place the public payload's
 * `meetingPoint` becomes something the detail page can render, so this is where
 * "nothing declared" is decided. Vitest cannot render `.astro` in this repo, so
 * the .astro component's own branch is NOT covered here — what is covered is the
 * VALUE that branch is handed, which is where every one of the three "no meeting
 * point" inputs has to converge on `null`. If they did not, the section would
 * paint a heading over an empty line and no test anywhere would see it.
 *
 * The tier projection that decides whether the field reaches this transform at
 * all is covered separately, by a full `ExperiencePublicSchema` parse in
 * `packages/schemas/src/entities/experience/__tests__/experience.access.schema.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import { toExperienceDetailPageProps } from '@/lib/api/transforms';

const MEETING_POINT = 'Muelle 3 del puerto, frente a la caseta azul';

/** A minimal raw public payload; only the meeting-point keys vary per test. */
function buildRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        slug: 'excursion-a-colon',
        name: 'Excursión a Colón',
        type: 'EXCURSION',
        summary: 'Visitá la ciudad vecina de Colón con guía incluido.',
        description: 'Una excursión completa a la ciudad de Colón.',
        priceFrom: 1500000,
        priceUnit: 'per_person',
        isPriceOnRequest: false,
        averageRating: 4.5,
        reviewsCount: 12,
        ...overrides
    };
}

describe('toExperienceDetailPageProps — meeting point (HOS-1048)', () => {
    it('carries the owner text through to the detail props', () => {
        // Arrange
        const raw = buildRaw({ meetingPoint: MEETING_POINT });

        // Act
        const props = toExperienceDetailPageProps({ item: raw, locale: 'es' });

        // Assert
        expect(props.meetingPoint).toBe(MEETING_POINT);
    });

    it('trims surrounding whitespace instead of rendering it', () => {
        const props = toExperienceDetailPageProps({
            item: buildRaw({ meetingPoint: `  ${MEETING_POINT}  ` }),
            locale: 'es'
        });

        expect(props.meetingPoint).toBe(MEETING_POINT);
    });

    it.each([
        ['the key is absent', {}],
        ['the column is null', { meetingPoint: null }],
        ['the string is empty', { meetingPoint: '' }],
        ['the string is only whitespace', { meetingPoint: '   ' }]
    ])('collapses to null when %s', (_case, overrides) => {
        // All four mean "the owner has not said where to meet" and must reach
        // the view as ONE value — the view's guard is a presence check, and `''`
        // is a string, so a blank would render the heading over nothing.
        const props = toExperienceDetailPageProps({ item: buildRaw(overrides), locale: 'es' });

        expect(props.meetingPoint).toBeNull();
    });

    it('passes the coordinates through as numbers', () => {
        const props = toExperienceDetailPageProps({
            item: buildRaw({
                meetingPoint: MEETING_POINT,
                meetingPointLat: -32.4825,
                meetingPointLong: -58.2333
            }),
            locale: 'es'
        });

        expect(props.meetingPointLat).toBe(-32.4825);
        expect(props.meetingPointLong).toBe(-58.2333);
    });

    it('keeps a coordinate of 0 rather than treating it as absent', () => {
        // 0/0 is a real point in the Gulf of Guinea. `Number(x) || null` would
        // erase it, which is why the transform tests the TYPE, not truthiness.
        const props = toExperienceDetailPageProps({
            item: buildRaw({ meetingPointLat: 0, meetingPointLong: 0 }),
            locale: 'es'
        });

        expect(props.meetingPointLat).toBe(0);
        expect(props.meetingPointLong).toBe(0);
    });

    it('reports null coordinates when the owner never pinned the spot', () => {
        // A landmark with no pin is a valid listing, not a broken one.
        const props = toExperienceDetailPageProps({
            item: buildRaw({ meetingPoint: MEETING_POINT }),
            locale: 'es'
        });

        expect(props.meetingPointLat).toBeNull();
        expect(props.meetingPointLong).toBeNull();
    });
});
