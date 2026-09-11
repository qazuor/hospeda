/**
 * Unit tests for the menú del día's public projection gate (HOS-1041).
 *
 * The gate answers ONE of the two independent reasons a special is not on the
 * public page — the owner's plan no longer granting it. The other reason, the
 * validity window, is applied upstream in SQL and is NOT this function's job;
 * these tests pin that separation by feeding the gate specials it must withhold
 * for the entitlement reason alone.
 */

import { describe, expect, it } from 'vitest';
import { applyGastronomyDailySpecialsGate } from '../../../src/routes/gastronomy/public/daily-specials-projection';

/** A stored special as the read hands it over — already window-filtered. */
const special = (title: string) => ({
    id: '11111111-1111-4111-8111-111111111111',
    gastronomyId: '22222222-2222-4222-8222-222222222222',
    title,
    description: null,
    priceCents: 1_850_000,
    validFrom: '2026-09-03',
    validUntil: '2026-09-03',
    displayOrder: 0,
    createdAt: new Date('2026-09-03T10:00:00Z'),
    updatedAt: new Date('2026-09-03T10:00:00Z')
});

describe('applyGastronomyDailySpecialsGate', () => {
    it('passes the specials through when the owner s plan grants the key', () => {
        // Arrange
        const specials = [special('Milanesa napolitana')];

        // Act
        const result = applyGastronomyDailySpecialsGate({
            dailySpecials: specials,
            ownerGrantsDailySpecial: true
        });

        // Assert
        expect(result.dailySpecials).toHaveLength(1);
        expect(result.dailySpecials?.[0]?.title).toBe('Milanesa napolitana');
    });

    it('withholds specials that EXIST when the plan no longer grants the key', () => {
        // The load-bearing case: a downgraded owner's rows are not deleted, so
        // the gate is the only thing standing between them and a `-basico`
        // venue getting the paid presentation for free. A gate that only ever
        // saw empty input would pass this suite while doing nothing.
        // Arrange
        const specials = [special('Milanesa napolitana')];

        // Act
        const result = applyGastronomyDailySpecialsGate({
            dailySpecials: specials,
            ownerGrantsDailySpecial: false
        });

        // Assert
        expect(result.dailySpecials).toBeUndefined();
    });

    it('reports an entitled venue with nothing on today as undefined, not an empty array', () => {
        // `undefined` means "nothing to render" on this schema, the same
        // convention `amenities`/`features`/`menuSections` use. An empty array
        // on the wire would read as a loaded-but-empty join.
        // Arrange & Act
        const result = applyGastronomyDailySpecialsGate({
            dailySpecials: [],
            ownerGrantsDailySpecial: true
        });

        // Assert
        expect(result.dailySpecials).toBeUndefined();
    });

    it('withholds several specials, not just the first', () => {
        // Arrange
        const specials = [special('Entrada'), special('Principal'), special('Postre')];

        // Act
        const granted = applyGastronomyDailySpecialsGate({
            dailySpecials: specials,
            ownerGrantsDailySpecial: true
        });
        const withheld = applyGastronomyDailySpecialsGate({
            dailySpecials: specials,
            ownerGrantsDailySpecial: false
        });

        // Assert
        expect(granted.dailySpecials).toHaveLength(3);
        expect(withheld.dailySpecials).toBeUndefined();
    });
});
